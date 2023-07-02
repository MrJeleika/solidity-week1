// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IVoting {
    struct Data {
        uint256 price;
        uint256 amount;
    }

    function buy() external payable;

    function sell(uint256 amount) external;

    function burnFee() external;

    function vote(uint256 index, Data memory data) external;

    function startVoting() external;

    event VotingStarted(uint256 time);
}
