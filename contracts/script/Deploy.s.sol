// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DeFiAgentDelegate} from "../src/DeFiAgentDelegate.sol";

/**
 * Deploy DeFiAgentDelegate via CREATE2 for deterministic address on every chain.
 *
 * Usage (single chain):
 *   export SEPOLIA_RPC_URL=https://rpc.sepolia.org
 *   export PRIVATE_KEY=0x...
 *   forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
 *
 * Multi-chain: use Makefile in contracts/ with CHAINS="sepolia base"
 */
contract Deploy is Script {
    function run() external returns (DeFiAgentDelegate) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey == 0) revert("PRIVATE_KEY not set");
        vm.startBroadcast(deployerPrivateKey);
        bytes32 saltNonce = vm.envOr("DEPLOY_SALT", bytes32(0));
        bytes32 salt = keccak256(abi.encodePacked("DeFiAgentDelegate.v1", saltNonce));
        DeFiAgentDelegate delegate = new DeFiAgentDelegate{salt: salt}();
        console.log("DeFiAgentDelegate deployed at:", address(delegate));
        vm.stopBroadcast();
        return delegate;
    }
}
