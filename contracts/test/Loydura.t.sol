// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {Test} from "forge-std/Test.sol";
import {LoyduraHub} from "../src/LoyduraHub.sol";
import {LoyduraRewards} from "../src/LoyduraRewards.sol";
import {MockToken} from "../src/MockToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TaxedToken is ERC20 {
    constructor() ERC20("Taxed Test Token", "TAX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value >= 10) {
            uint256 tax = value / 10;
            super._update(from, address(0), tax);
            super._update(from, to, value - tax);
        } else {
            super._update(from, to, value);
        }
    }
}

contract SenderTaxToken is ERC20 {
    constructor() ERC20("Sender Tax Test Token", "STAX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value >= 10) {
            super._update(from, address(0), value / 10);
            super._update(from, to, value);
        } else {
            super._update(from, to, value);
        }
    }
}

contract LoyduraTest is Test {
    LoyduraHub hub;
    LoyduraRewards rewards;
    MockToken creatorToken;
    MockToken usdc;
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address treasury = makeAddr("protocol-treasury");
    uint256 constant LOT = 100 ether;
    uint256 constant PRICE = 10 ether;
    uint256 constant POOL = 600_000_000; // 600 USDC with six decimals
    uint256 shopId;

    function setUp() public {
        vm.warp(1_800_000_000);
        creatorToken = new MockToken("Loydura Test Creator Token", "TLOYD", 18);
        usdc = new MockToken("Loydura Test USDC (Not Circle USDC)", "tUSDC", 6);
        hub = new LoyduraHub(treasury);
        rewards = new LoyduraRewards(address(hub), address(usdc), treasury);
        vm.startPrank(creator);
        address[] memory payees = new address[](1);
        payees[0] = creator;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10_000;
        shopId = hub.createShop(address(creatorToken), PRICE, payees, shares);
        usdc.mint(creator, 10_000_000_000);
        usdc.approve(address(rewards), type(uint256).max);
        vm.stopPrank();
        _mintAndApprove(alice);
        _mintAndApprove(bob);
        _mintAndApprove(carol);
        _mintAndApprove(dave);
    }

    function _mintAndApprove(address person) internal {
        creatorToken.mint(person, 10_000 ether);
        vm.startPrank(person);
        creatorToken.approve(address(hub), type(uint256).max);
        creatorToken.approve(address(rewards), type(uint256).max);
        vm.stopPrank();
    }

    function _buy(address person) internal {
        vm.prank(person);
        hub.buyMembership(shopId);
    }

    function _lock(address person, uint256 campaignId, uint256 amount) internal {
        _buy(person);
        vm.prank(person);
        rewards.lock(campaignId, amount);
    }

    function _campaign(uint256 pool) internal returns (uint256 id, uint64 start, uint64 end) {
        start = uint64(block.timestamp + 1 hours);
        end = start + 600;
        vm.prank(creator);
        id = rewards.createCampaign(shopId, pool, start, end);
    }

    function testShopCheckoutAndRenewal() public {
        uint256 beforeCreator = creatorToken.balanceOf(creator);
        _buy(alice);
        uint64 first = hub.membershipExpires(shopId, alice);
        assertEq(creatorToken.balanceOf(creator) - beforeCreator, PRICE * 99 / 100);
        assertEq(creatorToken.balanceOf(treasury), PRICE / 100);
        vm.warp(block.timestamp + 1 days);
        _buy(alice);
        assertEq(hub.membershipExpires(shopId, alice), first + 30 days);
        assertEq(hub.purchases(shopId), 2);
    }

    function testInvalidShopRecipientSplit() public {
        address[] memory people = new address[](2);
        people[0] = alice;
        people[1] = bob;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 7000;
        shares[1] = 2000;
        vm.expectRevert(LoyduraHub.InvalidInput.selector);
        hub.createShop(address(creatorToken), PRICE, people, shares);
    }

    function testRejectFeeOnTransferCheckout() public {
        TaxedToken taxed = new TaxedToken();
        taxed.mint(alice, 100 ether);
        address[] memory people = new address[](1);
        people[0] = creator;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10_000;
        vm.prank(creator);
        uint256 shop = hub.createShop(address(taxed), 10 ether, people, shares);
        vm.startPrank(alice);
        taxed.approve(address(hub), type(uint256).max);
        vm.expectRevert(LoyduraHub.TokenTransferMismatch.selector);
        hub.buyMembership(shop);
        vm.stopPrank();
    }

    function testRejectSenderTaxCheckout() public {
        SenderTaxToken taxed = new SenderTaxToken();
        taxed.mint(alice, 100 ether);
        address[] memory people = new address[](1);
        people[0] = creator;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10_000;
        vm.prank(creator);
        uint256 shop = hub.createShop(address(taxed), 10 ether, people, shares);
        vm.startPrank(alice);
        taxed.approve(address(hub), type(uint256).max);
        vm.expectRevert(LoyduraHub.TokenTransferMismatch.selector);
        hub.buyMembership(shop);
        vm.stopPrank();
    }

    function testUnauthorizedCannotClaimOrReclaim() public {
        (uint256 id,, uint64 end) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.warp(end);
        vm.prank(bob);
        vm.expectRevert(LoyduraRewards.NoPosition.selector);
        rewards.claim(id);
        vm.prank(bob);
        vm.expectRevert(LoyduraRewards.Unauthorized.selector);
        rewards.reclaim(id);
    }

    function testOnlyCreatorCanFundCampaign() public {
        uint64 start = uint64(block.timestamp + 3600);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.Unauthorized.selector);
        rewards.createCampaign(shopId, POOL, start, start + 600);
    }

    function testMustBuyMembershipBeforeLock() public {
        (uint256 id,,) = _campaign(POOL);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.NotMemberThroughEnd.selector);
        rewards.lock(id, LOT);
    }

    function testCannotEnterAfterStart() public {
        (uint256 id, uint64 start,) = _campaign(POOL);
        _buy(alice);
        vm.warp(start);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.EntryClosed.selector);
        rewards.lock(id, LOT);
    }

    function testRejectDuplicateLockAndZeroAmount() public {
        (uint256 id,,) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.AlreadyEntered.selector);
        rewards.lock(id, LOT);
        vm.prank(bob);
        vm.expectRevert(LoyduraRewards.AlreadyEntered.selector);
        rewards.lock(id, 0);
    }

    function testClaimThenExitBypassImpossible() public {
        (uint256 id, uint64 start, uint64 end) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.warp(start + 300);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.CampaignNotFinished.selector);
        rewards.claim(id);
        uint256 before = creatorToken.balanceOf(alice);
        vm.prank(alice);
        rewards.unlock(id);
        assertEq(creatorToken.balanceOf(alice) - before, LOT);
        vm.warp(end);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.NoPosition.selector);
        rewards.claim(id);
    }

    function testTwoEarlyExitsRedistributeToTwoStayers() public {
        (uint256 id, uint64 start, uint64 end) = _campaign(POOL);
        _lock(alice, id, LOT);
        _lock(bob, id, LOT);
        _lock(carol, id, LOT);
        _lock(dave, id, LOT);
        vm.warp(start + 300);
        vm.prank(alice);
        rewards.unlock(id);
        vm.prank(carol);
        rewards.unlock(id);
        LoyduraRewards.Campaign memory mid = rewards.getCampaign(id);
        assertEq(mid.earlyExits, 2);
        assertEq(mid.activeLockers, 2);
        assertEq(mid.totalForfeited, 175_000_000);
        vm.warp(end);
        vm.prank(bob);
        rewards.claim(id);
        vm.prank(dave);
        rewards.claim(id);
        assertApproxEqAbs(usdc.balanceOf(bob), 300_000_000, 1);
        assertApproxEqAbs(usdc.balanceOf(dave), 300_000_000, 1);
        assertEq(rewards.getCampaign(id).claimed, POOL);
        vm.prank(bob);
        rewards.unlock(id);
        vm.prank(dave);
        rewards.unlock(id);
        assertEq(rewards.getCampaign(id).completed, 2);
    }

    function testLastExitCreatorReclaimsIdleAndForfeit() public {
        (uint256 id, uint64 start, uint64 end) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.warp(start + 300);
        vm.prank(alice);
        rewards.unlock(id);
        assertEq(rewards.getCampaign(id).refundable, 300_000_000);
        uint256 before = usdc.balanceOf(creator);
        vm.prank(creator);
        rewards.reclaim(id);
        assertEq(usdc.balanceOf(creator) - before, 300_000_000);
        vm.warp(end);
        vm.prank(creator);
        rewards.reclaim(id);
        assertEq(usdc.balanceOf(creator) - before, POOL);
        assertEq(rewards.getCampaign(id).refunded, POOL);
        assertEq(usdc.balanceOf(address(rewards)), 0);
    }

    function testNoParticipantsCreatorReclaimsAll() public {
        (uint256 id,, uint64 end) = _campaign(POOL);
        vm.warp(end);
        vm.prank(creator);
        rewards.reclaim(id);
        assertEq(rewards.getCampaign(id).refunded, POOL);
    }

    function testCannotStealParticipantsRewards() public {
        (uint256 id, uint64 start,) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.warp(start + 300);
        vm.prank(creator);
        vm.expectRevert(LoyduraRewards.NothingRefundable.selector);
        rewards.reclaim(id);
    }

    function testWithdrawAfterEndPreservesClaim() public {
        (uint256 id,, uint64 end) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.warp(end);
        vm.prank(alice);
        rewards.unlock(id);
        vm.prank(alice);
        rewards.claim(id);
        assertEq(usdc.balanceOf(alice), POOL);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.AlreadyClaimed.selector);
        rewards.claim(id);
    }

    function testNoDuplicatePrincipalWithdraw() public {
        (uint256 id,, uint64 end) = _campaign(POOL);
        _lock(alice, id, LOT);
        vm.warp(end);
        vm.prank(alice);
        rewards.unlock(id);
        vm.prank(alice);
        vm.expectRevert(LoyduraRewards.PrincipalAlreadyWithdrawn.selector);
        rewards.unlock(id);
    }

    function testSameUserCampaignsDoNotShareRewardAccounting() public {
        (uint256 a,, uint64 end) = _campaign(POOL);
        (uint256 b,,) = _campaign(POOL);
        _lock(alice, a, LOT);
        _lock(alice, b, LOT);
        vm.warp(end);
        vm.prank(alice);
        rewards.claim(a);
        vm.prank(alice);
        rewards.claim(b);
        assertEq(usdc.balanceOf(alice), 2 * POOL);
    }

    function testFuzzOneLockerNeverEarnsMoreThanPool(uint96 deposit, uint96 reward) public {
        deposit = uint96(bound(deposit, 1 ether, 2_000 ether));
        reward = uint96(bound(reward, 600, 1_000_000_000));
        (uint256 id,, uint64 end) = _campaign(reward);
        _lock(alice, id, deposit);
        vm.warp(end);
        vm.prank(alice);
        rewards.claim(id);
        assertLe(usdc.balanceOf(alice), reward);
        if (rewards.getCampaign(id).claimed < reward) {
            vm.prank(creator);
            rewards.reclaim(id);
        }
        assertEq(usdc.balanceOf(alice) + rewards.getCampaign(id).refunded, reward);
    }

    function testFuzzConservationWithEarlyExit(uint96 a, uint96 b, uint16 exitAt) public {
        a = uint96(bound(a, 1 ether, 5000 ether));
        b = uint96(bound(b, 1 ether, 5000 ether));
        exitAt = uint16(bound(exitAt, 1, 599));
        (uint256 id, uint64 start, uint64 end) = _campaign(POOL);
        _lock(alice, id, a);
        _lock(bob, id, b);
        vm.warp(start + exitAt);
        vm.prank(alice);
        rewards.unlock(id);
        vm.warp(end);
        vm.prank(bob);
        rewards.claim(id);
        if (rewards.getCampaign(id).claimed < POOL) {
            vm.prank(creator);
            rewards.reclaim(id);
        }
        assertEq(usdc.balanceOf(bob) + rewards.getCampaign(id).refunded, POOL);
    }
}
