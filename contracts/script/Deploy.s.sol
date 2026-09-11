// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "../src/AccrueEscrow.sol";

interface DeploymentVm {
    function envAddress(string calldata) external returns (address);
    function envUint(string calldata) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    DeploymentVm constant vm = DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (AccrueEscrow escrow) {
        require(block.chainid == vm.envUint("ACCRUE_EXPECTED_CHAIN_ID"), "Unexpected network");
        address token = vm.envAddress("ACCRUE_TOKEN_ADDRESS");
        require(token.code.length > 0, "Token is not a contract");
        vm.startBroadcast();
        escrow = new AccrueEscrow(token);
        vm.stopBroadcast();
    }
}
