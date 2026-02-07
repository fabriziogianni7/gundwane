// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console} from "forge-std/Test.sol";
import {DeFiAgentDelegate} from "../src/DeFiAgentDelegate.sol";

contract DeFiAgentDelegateTest is Test {
    DeFiAgentDelegate public delegate;
    address public user;
    address public operator;

    function setUp() public {
        delegate = new DeFiAgentDelegate();
        user = makeAddr("user");
        operator = makeAddr("operator");
    }

    function test_initializeOperator() public {
        vm.prank(operator);
        delegate.initializeOperator(operator);
        assertTrue(delegate.isOperator(operator));
        assertTrue(delegate.isInitialized());
    }

    function test_initializeOperator_RevertWhen_AlreadyInitialized() public {
        vm.startPrank(operator);
        delegate.initializeOperator(operator);
        vm.expectRevert(DeFiAgentDelegate.AlreadyInitialized.selector);
        delegate.initializeOperator(makeAddr("other"));
        vm.stopPrank();
    }

    function test_receive() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(delegate).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(delegate).balance, 1 ether);
    }
}
