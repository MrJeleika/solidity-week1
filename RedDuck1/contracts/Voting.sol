
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC20.sol";
import "./utils/SafeMath.sol";
import "./IVoting.sol";
import "./LinkedList.sol";

contract Voting is ERC20, DoublyLinkedList {
    using SafeMath for uint;

    event VotingStarted(uint256 time);

    DoublyLinkedList linkedList;

    uint8 public feeDivider = 100;
    address public _owner;
    uint256 public minTokenAmount;
    uint256 public price = 1;
    uint256 public fee;
    uint256 public feeToBurn;
    uint256 public constant timeToVote = 500;
    uint256 public votingStartedTime;
    uint256 public lastTimeBurnFee = 0;

    mapping(address => bool) public isVoted;
    mapping(address => uint) public votePower;
    mapping(address => uint) public votePrice;
    mapping(uint => uint) public voteIndex;

    constructor(string memory name, string memory symbol, uint256 totalSupply, uint256 _price, uint256 _fee) ERC20(name, symbol, totalSupply) {
        _owner = msg.sender;
        minTokenAmount = totalSupply.mul(5).div(10000); // 0.05%
        fee = _fee;
        price = _price;
    }

    // Исправить fee
    function buy() public payable {
        require(msg.value / price >= 20, "Too small amount");
        uint _fee = (msg.value * fee) / feeDivider;
        uint _amount = (msg.value) - (_fee);
        mint(_amount / price, msg.sender);
        votePower[msg.sender] += _amount;
        feeToBurn += (_fee) / price;
        balances[_owner] += (_fee) / price;
    }

    // Исправить fee
    function sell(uint256 _amount) public {
        require(balanceOf(msg.sender) >= _amount, "Not enough tokens to sell");
        uint _fee = (_amount * fee) / feeDivider;
        burn(_amount - _fee, msg.sender);
        if(balanceOf(msg.sender) < votePower[msg.sender]){
            uint index = voteIndex[votePrice[msg.sender]];
            votePower[msg.sender] = balanceOf(msg.sender);
        }else{
            votePower[msg.sender] -= _amount;
        }
        feeToBurn += fee;
        balances[_owner] += fee;
        payable(msg.sender).transfer(((_amount - _fee) * price));
    }

    function vote(uint256 index, Data calldata data, bool existingNode) public returns (bool) {
        require(votePower[msg.sender] >= data.amount, "Not enough voting power");
        require(data.price > 0 && data.amount > 0, "Data should be positive");
        require(!isVoted[msg.sender], "Already voted");
        if (votingStartedTime == 0) {
            votingStartedTime = block.timestamp;
            emit VotingStarted(votingStartedTime);
        }

        if (existingNode) {
            increaseAmount(index, data);
        } else {
            require(balanceOf(msg.sender) >= minTokenAmount, "Hold at least 0.05% of all tokens to start voting");
            insertAfter(index, data);
        }

        isVoted[msg.sender] = true;
        votePower[msg.sender] -= data.amount;
        return true;
    }

    function burnFee() public onlyOwner {
        require(lastTimeBurnFee + 1 weeks < block.timestamp, "Wait 1 week since last burn");
        burn(feeToBurn, _owner);
        feeToBurn = 0;
        lastTimeBurnFee = block.timestamp;
    }

    function endVoting() external {
        require(block.timestamp > votingStartedTime + timeToVote, "Voting hasn't ended yet");
        votingStartedTime = 0;
        Node[] memory nodes = getNodes();
        price = nodes[tail].data.price == 0 ? price : nodes[tail].data.amount;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        require(balanceOf(msg.sender) >= amount, "Not enough tokens");
        require(votePower[msg.sender] >= amount, "Tokens in voting");
        balances[msg.sender] -= amount;
        balances[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "You aren't an owner");
        _;
    }
}
