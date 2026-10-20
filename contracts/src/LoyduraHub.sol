// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title LoyduraHub
/// @notice Fixed-price 30-day membership shops, paid in a shop's ERC-20 token.
/// @dev No upgradeability or administrative custody. Shop payout splits are immutable.
contract LoyduraHub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidInput();
    error UnknownShop();
    error InactiveShop();
    error TokenTransferMismatch();
    error WrongBuyer();
    error Overflow();

    uint256 public constant MEMBERSHIP_PERIOD = 30 days;
    uint256 public constant BPS = 10_000;
    uint256 public constant PLATFORM_BPS = 100; // 1%
    uint256 public nextShopId = 1;
    address public immutable feeRecipient;

    struct Shop {
        address creator;
        address token;
        uint256 price;
        bool exists;
    }

    mapping(uint256 => Shop) private shops;
    mapping(uint256 => address[]) private recipients;
    mapping(uint256 => uint16[]) private weights;
    mapping(uint256 => mapping(address => uint64)) public membershipExpires;
    mapping(uint256 => uint256) public purchases;
    mapping(uint256 => uint256) public grossSales;

    event ShopCreated(uint256 indexed shopId, address indexed creator, address indexed token, uint256 price);
    event MembershipPurchased(
        uint256 indexed shopId, address indexed buyer, uint64 expiresAt, uint256 grossAmount, uint256 fee
    );
    event ShopPayout(uint256 indexed shopId, address indexed recipient, uint256 amount);

    constructor(address feeRecipient_) {
        if (feeRecipient_ == address(0)) revert InvalidInput();
        feeRecipient = feeRecipient_;
    }

    function createShop(address token, uint256 price, address[] calldata payoutRecipients, uint16[] calldata payoutBps)
        external
        returns (uint256 shopId)
    {
        if (
            token.code.length == 0 || price == 0 || payoutRecipients.length == 0 || payoutRecipients.length > 5
                || payoutRecipients.length != payoutBps.length
        ) revert InvalidInput();
        uint256 sum;
        for (uint256 i; i < payoutRecipients.length; ++i) {
            if (payoutRecipients[i] == address(0) || payoutRecipients[i] == address(this) || payoutBps[i] == 0) {
                revert InvalidInput();
            }
            for (uint256 j; j < i; ++j) {
                if (payoutRecipients[i] == payoutRecipients[j]) revert InvalidInput();
            }
            sum += payoutBps[i];
        }
        if (sum != BPS) revert InvalidInput();
        shopId = nextShopId++;
        shops[shopId] = Shop({creator: msg.sender, token: token, price: price, exists: true});
        for (uint256 i; i < payoutRecipients.length; ++i) {
            recipients[shopId].push(payoutRecipients[i]);
            weights[shopId].push(payoutBps[i]);
        }
        emit ShopCreated(shopId, msg.sender, token, price);
    }

    function getShop(uint256 shopId) external view returns (Shop memory) {
        if (!shops[shopId].exists) revert UnknownShop();
        return shops[shopId];
    }

    function shopPayouts(uint256 shopId) external view returns (address[] memory, uint16[] memory) {
        if (!shops[shopId].exists) revert UnknownShop();
        return (recipients[shopId], weights[shopId]);
    }

    function validThrough(uint256 shopId, address member, uint256 endTimestamp) external view returns (bool) {
        if (!shops[shopId].exists) return false;
        return membershipExpires[shopId][member] >= endTimestamp;
    }

    function buyMembership(uint256 shopId) external nonReentrant returns (uint64 expiry) {
        Shop memory shop = shops[shopId];
        if (!shop.exists) revert UnknownShop();

        IERC20 token = IERC20(shop.token);
        uint256 beforeBalance = token.balanceOf(address(this));
        uint256 buyerBefore = token.balanceOf(msg.sender);
        token.safeTransferFrom(msg.sender, address(this), shop.price);
        _requireExactIncrease(token, address(this), beforeBalance, shop.price);
        _requireExactDecrease(token, msg.sender, buyerBefore, shop.price);

        uint256 fee = Math.mulDiv(shop.price, PLATFORM_BPS, BPS);
        uint256 net = shop.price - fee;
        uint256 remaining = net;
        uint256 length = recipients[shopId].length;
        for (uint256 i; i < length; ++i) {
            // Give the final recipient all rounding dust: exact conservation.
            uint256 portion = i + 1 == length ? remaining : Math.mulDiv(net, weights[shopId][i], BPS);
            remaining -= portion;
            if (portion > 0) {
                _transferExact(token, recipients[shopId][i], portion);
                emit ShopPayout(shopId, recipients[shopId][i], portion);
            }
        }
        if (fee > 0) _transferExact(token, feeRecipient, fee);
        // Reject tokens that debit sender more than transferred or silently retain balance.
        if (token.balanceOf(address(this)) != beforeBalance) revert TokenTransferMismatch();

        uint256 previous = membershipExpires[shopId][msg.sender];
        uint256 base = previous > block.timestamp ? previous : block.timestamp;
        uint256 ends = base + MEMBERSHIP_PERIOD;
        if (ends > type(uint64).max) revert Overflow();
        expiry = uint64(ends);
        membershipExpires[shopId][msg.sender] = expiry;
        purchases[shopId]++;
        grossSales[shopId] += shop.price;
        emit MembershipPurchased(shopId, msg.sender, expiry, shop.price, fee);
    }

    function _transferExact(IERC20 token, address recipient, uint256 value) private {
        uint256 senderBefore = token.balanceOf(address(this));
        uint256 previous = token.balanceOf(recipient);
        token.safeTransfer(recipient, value);
        _requireExactDecrease(token, address(this), senderBefore, value);
        _requireExactIncrease(token, recipient, previous, value);
    }

    function _requireExactIncrease(IERC20 token, address account, uint256 beforeBalance, uint256 amount) private view {
        uint256 afterBalance = token.balanceOf(account);
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert TokenTransferMismatch();
    }

    function _requireExactDecrease(IERC20 token, address account, uint256 beforeBalance, uint256 amount) private view {
        uint256 afterBalance = token.balanceOf(account);
        if (beforeBalance < afterBalance || beforeBalance - afterBalance != amount) revert TokenTransferMismatch();
    }
}
