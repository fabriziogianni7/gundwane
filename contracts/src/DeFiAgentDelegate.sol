// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * EIP-7702 delegate contract for non-custodial DeFi agent.
 * When delegated to an EOA, allows an operator (bot) to execute calls on behalf of the account.
 * Uses ERC-7201 namespaced storage to avoid collisions across delegations.
 */
contract DeFiAgentDelegate {
    /// @custom:storage-location erc7201:defi.agent.delegate.v1
    struct DelegateStorage {
        mapping(address => bool) operators;
        bool initialized;
    }

    // erc7201("defi.agent.delegate.v1"): namespace slot to avoid storage collisions
    bytes32 private constant DELEGATE_STORAGE_LOCATION = bytes32(
        uint256(keccak256(abi.encode(uint256(keccak256(abi.encodePacked("defi.agent.delegate.v1"))) - 1))) & ~uint256(0xff)
    );

    error OnlyOwner();
    error OnlyOperator();
    error AlreadyInitialized();
    error CallFailed(uint256 index);

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    function _getDelegateStorage() private pure returns (DelegateStorage storage s) {
        bytes32 loc = DELEGATE_STORAGE_LOCATION;
        assembly {
            s.slot := loc
        }
    }

    modifier onlyOwner() {
        if (msg.sender != address(this)) revert OnlyOwner();
        _;
    }

    modifier onlyOperator() {
        DelegateStorage storage s = _getDelegateStorage();
        if (!s.operators[msg.sender]) revert OnlyOperator();
        _;
    }

    /**
     * Called once during EIP-7702 setup (same tx as delegation).
     * The bot's EOA submits the type-4 tx; after auth processing, this call runs with msg.sender = bot.
     */
    function initializeOperator(address operator) external {
        DelegateStorage storage s = _getDelegateStorage();
        if (s.initialized) revert AlreadyInitialized();
        s.initialized = true;
        s.operators[operator] = true;
    }

    function addOperator(address operator) external onlyOwner {
        DelegateStorage storage s = _getDelegateStorage();
        s.operators[operator] = true;
    }

    function removeOperator(address operator) external onlyOwner {
        DelegateStorage storage s = _getDelegateStorage();
        s.operators[operator] = false;
    }

    function isOperator(address account) external view returns (bool) {
        return _getDelegateStorage().operators[account];
    }

    function isInitialized() external view returns (bool) {
        return _getDelegateStorage().initialized;
    }

    function execute(address to, uint256 value, bytes calldata data) external onlyOperator returns (bytes memory) {
        (bool ok, bytes memory result) = to.call{value: value}(data);
        if (!ok) {
            if (result.length > 0) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            revert CallFailed(0);
        }
        return result;
    }

    function executeBatch(Call[] calldata calls) external onlyOperator returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!ok) {
                if (result.length > 0) {
                    assembly {
                        revert(add(result, 32), mload(result))
                    }
                }
                revert CallFailed(i);
            }
            results[i] = result;
        }
    }

    receive() external payable {}
}
