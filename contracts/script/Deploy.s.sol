// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {LoyduraHub} from "../src/LoyduraHub.sol";
import {LoyduraRewards} from "../src/LoyduraRewards.sol";
import {MockToken} from "../src/MockToken.sol";

/// @notice Elysium 99801 deployment. Test asset minting is explicit and limited to testnet.
contract Deploy is Script {
    function run() external {
        require(block.chainid == 99801, "Must deploy only to Elysium Testnet 99801");
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        require(feeRecipient != address(0), "No fee recipient");
        address usdcAddress = vm.envOr("LOYDURA_TEST_USDC", address(0));
        vm.startBroadcast(key);
        if (usdcAddress == address(0)) {
            MockToken mockUsdc = new MockToken("Loydura TEST USDC - NO VALUE", "tUSDC", 6);
            usdcAddress = address(mockUsdc);
            mockUsdc.mint(vm.addr(key), 1_000_000e6);
        }
        LoyduraHub hub = new LoyduraHub(feeRecipient);
        LoyduraRewards rewards = new LoyduraRewards(address(hub), usdcAddress, feeRecipient);
        // Separate mock ERC-20s; never show them as verified Ascend tokens.
        MockToken creatorOne = new MockToken("Loydura TEST Token One", "tLOYD1", 18);
        MockToken creatorTwo = new MockToken("Loydura TEST Token Two", "tLOYD2", 18);
        creatorOne.mint(vm.addr(key), 1_000_000e18);
        creatorTwo.mint(vm.addr(key), 1_000_000e18);
        vm.stopBroadcast();
        console2.log("Chain ID", block.chainid);
        console2.log("Hub", address(hub));
        console2.log("Rewards", address(rewards));
        console2.log("Test USDC", usdcAddress);
        console2.log("Test creator token 1", address(creatorOne));
        console2.log("Test creator token 2", address(creatorTwo));
    }
}
