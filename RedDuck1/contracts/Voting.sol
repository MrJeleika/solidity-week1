
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC20.sol";
import './utils/SafeMath.sol'; // using
import './IVoting.sol';
import './LinkedList.sol';

contract Voting is ERC20, DoublyLinkedList{
    using SafeMath for uint;

    event VotingStarted(uint256 time);
    
    DoublyLinkedList linkedList;

    uint8 private feeDivider = 100;
    address private _owner;
    uint256 public minTokenAmount;
    uint256 public  _price = 1;
    uint256 private fee;
    uint256 public feeToBurn;
    uint256 private constant timeToVote = 50;
    uint256 public votingStartedTime;

    mapping(address => bool) public isVoted;
    mapping(address => uint) public votePower;

    constructor(
        string memory name, 
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol, totalSupply) {
        _owner = msg.sender;
        minTokenAmount = totalSupply.mul(5).div(10000); // 0.05% 
        fee = 5; 
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Only the contract owner can call this function");
        _;
    }
    
    // С переменной на 500 газа меньше когда 2 вызова
    // modifier canStartVoting(){ 
    //     uint balance = balanceOf(msg.sender); 
    //     require(balance >= minTokenAmount, "You have to hold at least 0.05% of all tokens to start voting");
    //     _;
    // }

    function buy() public payable {
        require(msg.value / _price >= 20, 'Too small amount');
        uint _amount = (msg.value) - (msg.value * fee / feeDivider);
        mint(_amount / _price, msg.sender); 
        votePower[msg.sender] = balanceOf(msg.sender);
        feeToBurn += (msg.value * fee / feeDivider) / _price;
    }

    function sell(uint256 _amount) public {
        require(balanceOf(msg.sender) >= _amount, "You don't have enough tokens to sell");
        require(votePower[msg.sender] >= _amount, "You can't withdraw tokens while you're voting");
        uint _fee = _amount * fee / feeDivider;
        burn(_amount - _fee, msg.sender);
        votePower[msg.sender] = balanceOf(msg.sender);
        feeToBurn += fee;
        payable(msg.sender).transfer(((_amount - _fee) * _price)); 
    }
    
    function vote(uint256 index, Data calldata data, bool existingNode) public {
        require(votePower[msg.sender] >= data.amount, "You don't have enough voting power");
        if(votingStartedTime == 0){
            votingStartedTime = block.timestamp;
            emit VotingStarted(votingStartedTime);
        }
        if (existingNode) {
            updateData(index, data);
        } else {
            require(balanceOf(msg.sender) >= minTokenAmount, "You have to hold at least 0.05% of all tokens to start new voting");
            insertAfter(index, data);
        }

        isVoted[msg.sender] = true;
        votePower[msg.sender] -= data.amount;
    }
    // TODO
    // Should change winning price
    // Require занимает очень много газа, не лучше ли 
    function burnFee() public onlyOwner{
        burn(feeToBurn, msg.sender);
        feeToBurn = 0;
    }
    
    function endVoting() public onlyOwner{
        votingStartedTime = 0;
        emit VotingStarted(0);
    }
}