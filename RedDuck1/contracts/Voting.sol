// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC20.sol";
import "./utils/SafeMath.sol";
import "../node_modules/hardhat/console.sol";
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

    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 _price,
        uint256 _fee
    ) ERC20(name, symbol, totalSupply) {
        _owner = msg.sender;
        minTokenAmount = totalSupply.mul(5).div(10000); // 0.05%
        fee = _fee;
        price = _price;
    }

    // Исправить fee у минт
    function buy() public payable {
        require(msg.value / price >= 20, "Too small amount");
        uint _fee = (msg.value * fee) / feeDivider;
        uint _amount = msg.value - _fee;
        mint(_amount / price, msg.sender);
        mint(_fee / price, _owner);
        votePower[msg.sender] += _amount;
        feeToBurn += _fee / price;
    }

    function sell(uint256 _amount) public {
        uint256 balance = balanceOf(msg.sender);
        console.log(balance);
        require(balance >= _amount, "Not enough tokens to sell");
        require(votePower[msg.sender] >= _amount, "Use voterSell for voted tokens");
        require(_amount >= 20, "Too small amount");
        votePower[msg.sender] -= _amount;
        uint _fee = (_amount * fee) / feeDivider;
        burn(_amount, msg.sender);
        mint(_fee, _owner);
        feeToBurn += fee;
        payable(msg.sender).transfer(((_amount - _fee) * price));
    }

    function voterSell(uint256 _amount, uint256 indexToInsert, uint256 currAmount) public {
        uint256 balance = balanceOf(msg.sender);
        require(balance >= _amount, "Not enough tokens to sell");
        require(_amount >= 20, "Too small amount");
        checkVoteDecreaseAmount(_amount, indexToInsert, currAmount, msg.sender);
        uint _fee = (_amount * fee) / feeDivider;
        burn(_amount, msg.sender);
        mint(_fee, _owner);
        feeToBurn += fee;
        payable(msg.sender).transfer(((_amount - _fee) * price));
    }

    function vote(
        uint256 indexToInsert,
        uint256 indexOfExisting,
        Data memory data,
        bool existingNode
    ) public returns (bool) {
        require(votePower[msg.sender] >= data.amount, "Not enough voting power");
        require(data.price > 0 && data.amount > 0, "Data should be positive");
        if (votingStartedTime == 0) {
            votingStartedTime = block.timestamp;
            emit VotingStarted(votingStartedTime);
        }
        uint index;
        if (existingNode) {
            require(votePrice[msg.sender] == data.price || votePrice[msg.sender] == 0, "Already voted");
            if (indexToInsert == indexOfExisting) {
                increaseAmount(indexOfExisting, data);
                index = indexOfExisting;
            } else {
                remove(indexOfExisting);
                index = insertAfter(indexToInsert, data);
            }
        } else {
            require(votePrice[msg.sender] == 0, "Already voted");
            require(balanceOf(msg.sender) >= minTokenAmount, "Hold at least 0.05% of all tokens to start voting");
            index = insertAfter(indexToInsert, data);
        }

        votePrice[msg.sender] = data.price;
        voteIndex[data.price] = index;
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

    function transfer(address recipient, uint256 _amount) external override returns (bool) {
        uint256 balance = balanceOf(msg.sender);
        require(balance >= _amount, "Not enough tokens");
        require(votePower[msg.sender] >= _amount, "Use voteTranser for voted tokens");
        balances[msg.sender] -= _amount;
        balances[recipient] += _amount;
        votePower[recipient] += _amount;
        emit Transfer(msg.sender, recipient, _amount);
        return true;
    }

    function voterTransfer(address recipient, uint256 _amount, uint256 indexToInsert, uint256 currAmount) external {
        uint256 balance = balanceOf(msg.sender);
        require(balance >= _amount, "Not enough tokens");
        checkVoteDecreaseAmount(_amount, indexToInsert, currAmount, msg.sender);
        balances[msg.sender] -= _amount;
        balances[recipient] += _amount;
        votePower[recipient] += _amount;
        emit Transfer(msg.sender, recipient, _amount);
    }

    function checkVoteDecreaseAmount(uint256 _amount, uint256 indexToInsert, uint256 currAmount, address sender) internal {
        uint256 power = votePower[sender];
        if (power < _amount) {
            uint _price = votePrice[sender];
            uint index = voteIndex[_price];
            if (indexToInsert == index) {
                decreaseAmount(index, Data(_price, _amount - power));
            } else {
                remove(index);
                insertAfter(indexToInsert, Data(_price, currAmount));
                voteIndex[_price] = indexToInsert;
            }
            votePower[sender] = 0;
        } else {
            votePower[sender] -= _amount;
        }
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "You aren't an owner");
        _;
    }
}
