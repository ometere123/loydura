// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet-only fixture. Not a real USDC or officially Ascend-launched token.
contract MockToken is ERC20 {
    uint8 private immutable localDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        localDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return localDecimals;
    }

    function mint(address to, uint256 value) external {
        _mint(to, value);
    }
}
