// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoyduraHub} from "../src/LoyduraHub.sol";
import {LoyduraRewards} from "../src/LoyduraRewards.sol";
import {MockToken} from "../src/MockToken.sol";

/// @notice A deliberately separate, small accounting model for a fixed two-member cohort.
/// It models economic rules from first principles instead of reading the Rewards accumulator.
contract LoyduraReferenceModelTest is Test {
    uint256 private constant ACC = 1e27;
    uint256 private constant DURATION = 600;
    uint256 private constant POOL = 600_000_000;

    LoyduraHub private hub;
    LoyduraRewards private rewards;
    MockToken private token;
    MockToken private usdc;
    address private creator = makeAddr("reference-creator");
    address private alice = makeAddr("reference-alice");
    address private bob = makeAddr("reference-bob");
    address private treasury = makeAddr("reference-treasury");
    uint256 private shopId;

    function setUp() public {
        vm.warp(1_900_000_000);
        token = new MockToken("Reference creator token", "rTOK", 18);
        usdc = new MockToken("Reference test USDC", "rUSDC", 6);
        hub = new LoyduraHub(treasury);
        rewards = new LoyduraRewards(address(hub), address(usdc), treasury);
        vm.startPrank(creator);
        address[] memory recipients = new address[](1);
        recipients[0] = creator;
        uint16[] memory weights = new uint16[](1);
        weights[0] = 10_000;
        shopId = hub.createShop(address(token), 10 ether, recipients, weights);
        usdc.mint(creator, POOL * 2);
        usdc.approve(address(rewards), type(uint256).max);
        vm.stopPrank();
        _fundMember(alice);
        _fundMember(bob);
    }

    function _fundMember(address member) private {
        token.mint(member, 10_000 ether);
        vm.prank(member);
        token.approve(address(hub), type(uint256).max);
        vm.prank(member);
        token.approve(address(rewards), type(uint256).max);
    }

    function _createCampaign() private returns (uint256 campaignId, uint64 start, uint64 end) {
        start = uint64(block.timestamp + 1 hours);
        end = start + uint64(DURATION);
        vm.prank(creator);
        campaignId = rewards.createCampaign(shopId, POOL, start, end);
    }

    function _buyAndLock(address member, uint256 campaignId, uint256 amount) private {
        vm.prank(member);
        hub.buyMembership(shopId);
        vm.prank(member);
        rewards.lock(campaignId, amount);
    }

    function testFuzzIndependentModelMatchesEarlyExitSettlement(uint96 aliceStake, uint96 bobStake, uint16 elapsed) public {
        aliceStake = uint96(bound(aliceStake, 1 ether, 2_000 ether));
        bobStake = uint96(bound(bobStake, 1 ether, 2_000 ether));
        elapsed = uint16(bound(elapsed, 1, DURATION - 1));
        (uint256 campaignId, uint64 start, uint64 end) = _createCampaign();
        _buyAndLock(alice, campaignId, aliceStake);
        _buyAndLock(bob, campaignId, bobStake);

        uint256 totalStake = uint256(aliceStake) + uint256(bobStake);
        uint256 rate = POOL / DURATION;
        uint256 emittedBeforeExit = uint256(elapsed) * rate;
        uint256 accumulatorBeforeExit = (emittedBeforeExit * ACC) / totalStake;
        uint256 expectedForfeit = (uint256(aliceStake) * accumulatorBeforeExit) / ACC;
        uint256 redistributed = (expectedForfeit * ACC) / uint256(bobStake);
        uint256 accumulatorAfterExit = accumulatorBeforeExit + redistributed;
        uint256 emittedAfterExit = (DURATION - uint256(elapsed)) * rate;
        accumulatorAfterExit += (emittedAfterExit * ACC) / uint256(bobStake);
        uint256 expectedBobReward = (uint256(bobStake) * accumulatorAfterExit) / ACC;

        vm.warp(start + elapsed);
        vm.prank(alice);
        rewards.unlock(campaignId);
        LoyduraRewards.Campaign memory afterExit = rewards.getCampaign(campaignId);
        assertEq(afterExit.totalForfeited, expectedForfeit, "reference forfeiture mismatch");

        vm.warp(end);
        vm.prank(bob);
        rewards.claim(campaignId);
        LoyduraRewards.Campaign memory settled = rewards.getCampaign(campaignId);
        assertEq(settled.claimed, expectedBobReward, "reference claim mismatch");
        assertLe(settled.claimed + settled.refunded, POOL, "funded pool overallocated");
        assertEq(usdc.balanceOf(address(rewards)), POOL - settled.claimed - settled.refunded, "contract balance is not conserved");
    }
}
