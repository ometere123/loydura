// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {LoyduraHub} from "./LoyduraHub.sol";

/// @title LoyduraRewards
/// @notice Creator-funded, fixed-cohort token locks with streamed USDC rewards.
/// @dev Cohorts close before the start. Early exits forfeit *all* earned/unpaid rewards.
///      Rewards are claimable only when the campaign ends. No loops over participants.
contract LoyduraRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidInput();
    error Unauthorized();
    error UnknownCampaign();
    error EntryClosed();
    error NotMemberThroughEnd();
    error AlreadyEntered();
    error NoPosition();
    error PrincipalAlreadyWithdrawn();
    error CampaignNotFinished();
    error AlreadyClaimed();
    error TransferMismatch();
    error NothingRefundable();
    error NothingToClaim();

    uint256 private constant ACC = 1e27;
    uint256 private constant BPS = 10_000;
    uint256 private constant CAMPAIGN_FEE_BPS = 100; // 1% on top of net pool
    uint256 public nextCampaignId = 1;

    LoyduraHub public immutable hub;
    IERC20 public immutable usdc;
    address public immutable feeRecipient;

    struct Campaign {
        uint256 shopId;
        address creator;
        address token;
        uint64 start;
        uint64 end;
        uint64 lastUpdate;
        uint256 budget;
        uint256 rate;
        uint256 accPerShare;
        uint256 activeStake;
        uint256 refundable; // idle emissions and stranded forfeits (not rounding dust)
        uint256 refunded;
        uint256 claimed;
        uint256 totalForfeited;
        uint256 totalLocked;
        uint256 earlyExits;
        uint256 activeLockers;
        uint256 completed;
        uint256 pendingClaims;
        bool exists;
    }

    struct Position {
        uint256 amount;
        bool exists;
        bool principalWithdrawn;
        bool earlyExited;
        bool claimed;
        bool completionRecorded;
    }

    mapping(uint256 => Campaign) private campaigns;
    mapping(uint256 => mapping(address => Position)) private positions;

    event CampaignCreated(
        uint256 indexed campaignId,
        uint256 indexed shopId,
        address indexed creator,
        uint256 budget,
        uint256 fee,
        uint64 start,
        uint64 end
    );
    event Locked(uint256 indexed campaignId, address indexed member, uint256 amount);
    event Unlocked(uint256 indexed campaignId, address indexed member, uint256 amount, bool early, uint256 forfeited);
    event RewardClaimed(uint256 indexed campaignId, address indexed member, uint256 amount);
    event CreatorReclaimed(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event RewardsAccrued(uint256 indexed campaignId, uint256 emission, bool idle);

    constructor(address hub_, address usdc_, address feeRecipient_) {
        if (hub_.code.length == 0 || usdc_.code.length == 0 || feeRecipient_ == address(0)) revert InvalidInput();
        hub = LoyduraHub(hub_);
        usdc = IERC20(usdc_);
        feeRecipient = feeRecipient_;
    }

    function createCampaign(uint256 shopId, uint256 netBudget, uint64 start, uint64 end)
        external
        nonReentrant
        returns (uint256 campaignId)
    {
        LoyduraHub.Shop memory shop = hub.getShop(shopId);
        if (shop.creator != msg.sender) revert Unauthorized();
        if (
            shop.token == address(usdc) || start <= block.timestamp || end <= start || end - start < 60
                || end - start > 90 days || netBudget == 0 || netBudget < end - start
        ) revert InvalidInput();
        // Require strictly positive reward-per-second in smallest USDC units.
        uint256 fee = Math.mulDiv(netBudget, CAMPAIGN_FEE_BPS, BPS, Math.Rounding.Ceil);
        uint256 total = netBudget + fee;
        uint256 previous = usdc.balanceOf(address(this));
        uint256 creatorBefore = usdc.balanceOf(msg.sender);
        usdc.safeTransferFrom(msg.sender, address(this), total);
        _requireExactIncrease(usdc, address(this), previous, total);
        _requireExactDecrease(usdc, msg.sender, creatorBefore, total);
        _sendExact(usdc, feeRecipient, fee);
        if (usdc.balanceOf(address(this)) != previous + netBudget) revert TransferMismatch();
        campaignId = nextCampaignId++;
        Campaign storage c = campaigns[campaignId];
        c.shopId = shopId;
        c.creator = msg.sender;
        c.token = shop.token;
        c.start = start;
        c.end = end;
        c.lastUpdate = start;
        c.budget = netBudget;
        c.rate = netBudget / (end - start);
        c.exists = true;
        emit CampaignCreated(campaignId, shopId, msg.sender, netBudget, fee, start, end);
    }

    function lock(uint256 campaignId, uint256 amount) external nonReentrant {
        Campaign storage c = _campaign(campaignId);
        if (block.timestamp >= c.start) revert EntryClosed();
        if (amount == 0 || positions[campaignId][msg.sender].exists) revert AlreadyEntered();
        if (!hub.validThrough(c.shopId, msg.sender, c.end)) revert NotMemberThroughEnd();
        IERC20 token = IERC20(c.token);
        uint256 previous = token.balanceOf(address(this));
        uint256 memberBefore = token.balanceOf(msg.sender);
        token.safeTransferFrom(msg.sender, address(this), amount);
        _requireExactIncrease(token, address(this), previous, amount);
        _requireExactDecrease(token, msg.sender, memberBefore, amount);
        positions[campaignId][msg.sender] = Position({
            amount: amount,
            exists: true,
            principalWithdrawn: false,
            earlyExited: false,
            claimed: false,
            completionRecorded: false
        });
        c.activeStake += amount;
        c.totalLocked += amount;
        c.activeLockers++;
        c.pendingClaims++;
        emit Locked(campaignId, msg.sender, amount);
    }

    function unlock(uint256 campaignId) external nonReentrant {
        Campaign storage c = _campaign(campaignId);
        Position storage p = positions[campaignId][msg.sender];
        if (!p.exists) revert NoPosition();
        if (p.principalWithdrawn) revert PrincipalAlreadyWithdrawn();
        _accrue(c, campaignId);
        bool early = block.timestamp < c.end;
        uint256 forfeit;
        uint256 amount = p.amount;
        c.activeStake -= amount;
        c.activeLockers--;
        p.principalWithdrawn = true;
        if (early) {
            // Cohorts close at start. Each active member's full unpaid accrual is their stake
            // fraction of the global accumulator. Exits redistribute that accrual in O(1).
            forfeit = Math.mulDiv(amount, c.accPerShare, ACC);
            p.earlyExited = true;
            c.pendingClaims--;
            c.earlyExits++;
            c.totalForfeited += forfeit;
            if (c.activeStake == 0) {
                c.refundable += forfeit;
            } else {
                c.accPerShare += Math.mulDiv(forfeit, ACC, c.activeStake);
            }
        } else if (!p.completionRecorded) {
            p.completionRecorded = true;
            c.completed++;
        }
        _sendExact(IERC20(c.token), msg.sender, amount);
        emit Unlocked(campaignId, msg.sender, amount, early, forfeit);
    }

    function claim(uint256 campaignId) external nonReentrant {
        Campaign storage c = _campaign(campaignId);
        if (block.timestamp < c.end) revert CampaignNotFinished();
        Position storage p = positions[campaignId][msg.sender];
        if (!p.exists || p.earlyExited) revert NoPosition();
        if (p.claimed) revert AlreadyClaimed();
        _accrue(c, campaignId);
        uint256 amount = Math.mulDiv(p.amount, c.accPerShare, ACC);
        p.claimed = true;
        c.pendingClaims--;
        if (!p.completionRecorded) {
            p.completionRecorded = true;
            c.completed++;
        }
        c.claimed += amount;
        // Zero earned rewards are valid when everyone entered right before an unoccupied start
        // (not possible under the fixed cohort rule) or when all integer rounding is dust.
        if (amount > 0) _sendExact(usdc, msg.sender, amount);
        emit RewardClaimed(campaignId, msg.sender, amount);
    }

    function reclaim(uint256 campaignId) external nonReentrant {
        Campaign storage c = _campaign(campaignId);
        if (msg.sender != c.creator) revert Unauthorized();
        _accrue(c, campaignId);
        uint256 available = c.refundable - c.refunded;
        // After everyone has forfeited or collected, the remainder is provably unowed,
        // including rate-division remainder and accumulator rounding dust.
        if (block.timestamp >= c.end && c.pendingClaims == 0) {
            available = c.budget - c.claimed - c.refunded;
        }
        if (available == 0) revert NothingRefundable();
        c.refunded += available;
        _sendExact(usdc, msg.sender, available);
        emit CreatorReclaimed(campaignId, msg.sender, available);
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        Campaign memory c = campaigns[campaignId];
        if (!c.exists) revert UnknownCampaign();
        return c;
    }

    function getPosition(uint256 campaignId, address member) external view returns (Position memory) {
        return positions[campaignId][member];
    }

    function previewEarned(uint256 campaignId, address member) external view returns (uint256) {
        Campaign memory c = campaigns[campaignId];
        if (!c.exists) revert UnknownCampaign();
        Position memory p = positions[campaignId][member];
        if (!p.exists || p.earlyExited) return 0;
        uint256 endTime = block.timestamp < c.end ? block.timestamp : c.end;
        uint256 acc = c.accPerShare;
        if (endTime > c.lastUpdate && c.activeStake != 0) {
            acc += Math.mulDiv((endTime - c.lastUpdate) * c.rate, ACC, c.activeStake);
        }
        return Math.mulDiv(p.amount, acc, ACC);
    }

    function _campaign(uint256 campaignId) private view returns (Campaign storage c) {
        c = campaigns[campaignId];
        if (!c.exists) revert UnknownCampaign();
    }

    function _sendExact(IERC20 token, address recipient, uint256 value) private {
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 beforeBalance = token.balanceOf(recipient);
        token.safeTransfer(recipient, value);
        _requireExactDecrease(token, address(this), senderBefore, value);
        _requireExactIncrease(token, recipient, beforeBalance, value);
    }

    function _requireExactIncrease(IERC20 token, address account, uint256 beforeBalance, uint256 amount) private view {
        uint256 afterBalance = token.balanceOf(account);
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert TransferMismatch();
    }

    function _requireExactDecrease(IERC20 token, address account, uint256 beforeBalance, uint256 amount) private view {
        uint256 afterBalance = token.balanceOf(account);
        if (beforeBalance < afterBalance || beforeBalance - afterBalance != amount) revert TransferMismatch();
    }

    function _accrue(Campaign storage c, uint256 campaignId) private {
        uint256 to = block.timestamp < c.end ? block.timestamp : c.end;
        if (to <= c.lastUpdate) return;
        uint256 emitted = (to - c.lastUpdate) * c.rate;
        c.lastUpdate = uint64(to);
        if (c.activeStake == 0) c.refundable += emitted;
        else c.accPerShare += Math.mulDiv(emitted, ACC, c.activeStake);
        emit RewardsAccrued(campaignId, emitted, c.activeStake == 0);
    }
}
