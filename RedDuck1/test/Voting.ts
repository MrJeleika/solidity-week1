import { DoublyLinkedList } from './../typechain-types/LinkedList.sol/DoublyLinkedList';
import { expect } from 'chai';
import { Voting } from './../typechain-types/Voting';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

interface IData {
  price: number | bigint;
  amount: number | bigint;
}

describe('Voting', () => {
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let voting: Voting;

  // Get index to insert new node
  const getIndex = async (amount: number): Promise<number> => {
    const nodes = await voting.getNodes();
    let index = 0;
    let currentNode = nodes[index];

    for (let i = 0; i < nodes.length; i++) {
      if (currentNode.data.amount >= BigInt(amount)) {
        index = Number(currentNode.prev);
        break;
      }
      if (nodes[index].next === ethers.MaxUint256) {
        break;
      }

      index = Number(nodes[index].next);
      currentNode = nodes[index];
    }

    return index;
  };

  /**
   * Recount nodes to make list in right sorted order
   * @param indexOfExistingNode - index of node have to be recounted
   * @param data - data of that node
   * @returns [index, amount] - new index to insert data
   */
  const recountNodes = async (indexOfExistingNode: number, amount: number) => {
    let nodes = await voting.getNodes();
    let currentNode = nodes[indexOfExistingNode];
    let index = 0;
    const currAmount = Number(currentNode.data.amount) + amount;

    let prevNode, nextNode;

    if (currentNode[2] === ethers.MaxUint256) {
      index = Number(nodes[Number(currentNode[1])][2]);
      prevNode = nodes[Number(currentNode[1])];
      nextNode = currentNode;
    } else if (currentNode[1] === ethers.MaxUint256) {
      index = Number(nodes[Number(currentNode[2])][1]);
      prevNode = currentNode;
      nextNode = nodes[Number(currentNode[2])];
    } else {
      prevNode = nodes[Number(currentNode[1])];
      nextNode = nodes[Number(currentNode[2])];
    }

    if (nextNode.data.amount < currAmount) {
      while (nextNode.data.amount < currAmount) {
        if (nextNode.next === ethers.MaxUint256) {
          currentNode = nextNode;
          break;
        }
        currentNode = nextNode;
        nextNode = nodes[Number(currentNode.next)];
      }
      index = Number(nodes[Number(currentNode.prev)].next);
    } else if (prevNode.data.amount > currAmount) {
      while (prevNode.data.amount > currAmount) {
        if (prevNode.prev === ethers.MaxUint256) {
          index = Number(currentNode.prev);
          currentNode = prevNode;
          break;
        }
        currentNode = prevNode;
        prevNode = nodes[Number(currentNode.prev)];
      }
      index = Number(nodes[Number(currentNode.next)].prev);
    }

    return [index, currAmount];
  };

  const vote = async (
    data: IData,
    _user: HardhatEthersSigner,
  ): Promise<boolean> => {
    if (data.amount < 1 || data.price < 1) return false;
    const nodes = await voting.getNodes();
    // Check if node with this price already exists
    const indexOfExistingNode = nodes.findIndex(
      (node) => node.data.price === BigInt(data.price),
    );

    // If yes add amount to it and recount
    if (indexOfExistingNode >= 0) {
      const [indexToInsert, amount] = await recountNodes(
        indexOfExistingNode,
        Number(data.amount),
      );
      if (indexToInsert == indexOfExistingNode) {
        await voting
          .connect(_user)
          .vote(indexToInsert, indexOfExistingNode, data, true);
      } else {
        data.amount = amount;
        await voting
          .connect(_user)
          .vote(indexToInsert, indexOfExistingNode, data, true);
      }

      return true;
    }

    // Else, get index to insert new node and add it
    const index = await getIndex(Number(data.amount));
    // 0 just any value
    await voting.connect(_user).vote(index, 0, data, false);
    return true;
  };

  const findIndexToInsert = async (
    indexOfExistingNode: number,
    amount: number,
  ) => {
    if (indexOfExistingNode == 0) return [ethers.MaxUint256, 0];
    const nodes = await voting.getNodes();
    let currentNode = nodes[indexOfExistingNode];
    const currAmount = Number(currentNode.data.amount) - amount;
    if (currentNode.prev === ethers.MaxUint256)
      return [indexOfExistingNode, currAmount];
    let index = indexOfExistingNode;
    let prevNode = nodes[Number(currentNode.prev)];

    if (prevNode.data.amount > currAmount) {
      while (prevNode.data.amount > currAmount) {
        if (prevNode.prev === ethers.MaxUint256) {
          currentNode = prevNode;
          break;
        }
        currentNode = prevNode;
        prevNode = nodes[Number(currentNode.prev)];
      }
      index = Number(currentNode.prev);
    }
    return [index, currAmount];
  };

  const voterSell = async (amount: number, user: HardhatEthersSigner) => {
    const votePower = await voting.votePower(user.address);
    const price = Number(await voting.votePrice(user.address));
    const indexOfExistingNode = Number(await voting.voteIndex(price));
    const [indexToInsert, currAmount] = await findIndexToInsert(
      indexOfExistingNode,
      amount - Number(votePower),
    );
    if (votePower < BigInt(amount)) {
      if (indexToInsert === ethers.MaxUint256) return;
      await voting.connect(user).voterSell(amount, indexToInsert, currAmount);
    } else {
      await voting.connect(user).voterSell(amount, 0, currAmount);
    }
  };

  const voterTransfer = async (
    amount: number,
    recipient: string,
    user: HardhatEthersSigner,
  ) => {
    const votePower = await voting.votePower(user.address);
    const price = Number(await voting.votePrice(user.address));
    const indexOfExistingNode = Number(await voting.voteIndex(price));
    const [indexToInsert, currAmount] = await findIndexToInsert(
      indexOfExistingNode,
      amount - Number(votePower),
    );

    if (votePower < BigInt(amount)) {
      if (indexToInsert === ethers.MaxUint256) return;
      await voting
        .connect(user)
        .voterTransfer(recipient, amount, indexToInsert, currAmount);
    } else {
      await voting
        .connect(user)
        .voterTransfer(recipient, amount, 0, currAmount);
    }
  };

  const name = 'Jaba';
  const symbol = 'JAB';
  const supply = 1000000000;
  const price = 1;
  const fee = 5;

  beforeEach(async () => {
    [owner, user, user2, user3] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory('Voting', owner);

    voting = await Voting.deploy(name, symbol, supply, price, fee);
  });

  it('should be deployed', async () => {
    expect(await voting.getAddress()).to.be.properAddress;
  });

  it('should have proper name, symbol and supply', async () => {
    expect(await voting.name()).to.be.equal(name);
    expect(await voting.symbol()).to.be.equal(symbol);
    expect(await voting.totalSupply()).to.be.equal(supply);
  });

  it('should have proper min token amount to vote', async () => {
    expect(await voting.minTokenAmount()).to.be.equal(supply * 0.0005);
  });

  describe('Buy', async () => {
    it('Should change user ETH balance', async () => {
      const initialBalance = await ethers.provider.getBalance(user.address);

      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const updatedBalance = await ethers.provider.getBalance(user.address);
      expect(updatedBalance).to.be.lt(initialBalance);
    });
    it('Should change voting power of user', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      const power = await voting.connect(user).votePower(user.address);
      expect(power).to.be.gt(50n);
    });

    it('Should change total supply on mint', async () => {
      const initialSupply = await voting.totalSupply();
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      const currentSupply = await voting.totalSupply();
      expect(currentSupply).to.be.gt(initialSupply);
    });

    it('Should change fee', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      const fee = await voting.connect(user).feeToBurn();
      expect(fee).to.be.gt(50n);
    });

    it('Should revert transaction on too small amount', async () => {
      await expect(
        voting.connect(user).buy({
          value: 5,
        }),
      ).to.be.revertedWith('Too small amount');
    });
  });

  describe('Sell', async () => {
    it('Should decrease user balance on sell', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const balance = await voting.connect(user).balanceOf(user.address);

      await voting.connect(user).sell(50000);

      expect(await voting.connect(user).balanceOf(user.address)).to.be.lt(
        balance,
      );
    });

    it('Should decrease user voting power on sell', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      const votePover = await voting.connect(user).votePower(user.address);

      await voting.connect(user).sell(50000);

      expect(await voting.connect(user).votePower(user.address)).to.be.lt(
        votePover,
      );
    });

    it('Should change fee', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      const fee = await voting.connect(user).feeToBurn();
      expect(fee).to.be.gt(50n);
    });

    it('Should be reverted when not enought tokens to sell', async () => {
      await voting.connect(user).buy({
        value: 500000,
      });
      await expect(voting.connect(user).sell(6000000)).to.be.revertedWith(
        'Not enough tokens to sell',
      );
    });

    it('Should be reverted try to sell voted tokens', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });

      const data = {
        amount: 5000,
        price: 100,
      };

      await vote(data, user);
      await expect(voting.connect(user).sell(4748000)).to.be.revertedWith(
        'Use voterSell for voted tokens',
      );
    });

    it('Should be reverted to small amount', async () => {
      await voting.connect(user).buy({
        value: 500000,
      });
      await expect(voting.connect(user).sell(19)).to.be.revertedWith(
        'Too small amount',
      );
    });
  });

  describe('Voting result', async () => {
    it('should return biggest amount', async () => {
      const data = {
        amount: 20,
        price: 60,
      };
      const data2 = {
        amount: 50,
        price: 60,
      };
      const data3 = {
        amount: 5000,
        price: 10,
      };

      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(owner).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(user2).buy({
        value: ethers.parseEther('1'),
      });

      await vote(data, user2);
      await vote(data3, user);
      await vote(data2, owner);

      const nodes = await voting.getNodes();
      const tail = Number(await voting.tail());
      expect(await nodes[tail].data.amount).to.equal(5000n);
    });

    it('should have right voting list order', async () => {
      const data = {
        amount: 20,
        price: 60,
      };
      const data2 = {
        amount: 50,
        price: 60,
      };
      const data3 = {
        amount: 5000,
        price: 10,
      };

      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(owner).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(user2).buy({
        value: ethers.parseEther('1'),
      });

      await vote(data, user2);
      await vote(data3, user);
      await vote(data2, owner);

      const nodes = await voting.getNodes();
      const tail = Number(await voting.tail());
      const head = Number(await voting.head());

      await expect(nodes[tail].data.amount).to.equal(5000n);
      await expect(nodes[Number(nodes[tail].prev)].data.amount).to.equal(70n);
      await expect(nodes[head].data.amount).to.equal(0n);
    });

    it('should have right voting list order', async () => {
      const data = {
        amount: 20,
        price: 604,
      };
      const data2 = {
        amount: 6000,
        price: 60,
      };
      const data3 = {
        amount: 5000,
        price: 10,
      };

      await voting.connect(user).buy({
        value: 5000000,
      });
      await voting.connect(user3).buy({
        value: 5000000,
      });
      await voting.connect(user2).buy({
        value: ethers.parseEther('1'),
      });
      await vote(data, user2);
      await vote(data3, user);
      await vote(data2, user3);

      await voterSell(4749000, user3);
      await voterSell(4748000, user);
      const tail = Number(await voting.tail());
      const nodes = await voting.getNodes();
      await expect(nodes[tail].data.amount).to.equal(2000n);
    });

    it('should have right voting list order', async () => {
      const data = {
        amount: 20,
        price: 604,
      };
      const data2 = {
        amount: 6000,
        price: 60,
      };
      const data3 = {
        amount: 5000,
        price: 10,
      };

      await voting.connect(user).buy({
        value: 5000000,
      });
      await voting.connect(user3).buy({
        value: 5000000,
      });
      await voting.connect(user2).buy({
        value: ethers.parseEther('1'),
      });

      await vote(data, user2);
      await vote(data3, user);
      await vote(data2, user3);

      await voterSell(4749000, user3);
      await voterSell(4748000, user);
      await voterSell(1200, user);
      const tail = Number(await voting.tail());
      const nodes = await voting.getNodes();
      await expect(nodes[tail].data.amount).to.equal(1000n);
      await expect(nodes[Number(nodes[tail].prev)].data.amount).to.equal(800);
    });

    it('should have right voting list order', async () => {
      const data: IData = {
        amount: 20,
        price: 600,
      };
      const data2: IData = {
        amount: 6000,
        price: 60,
      };
      const data3: IData = {
        amount: 5000,
        price: 10,
      };

      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(owner).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(user2).buy({
        value: ethers.parseEther('1'),
      });

      await vote(data2, owner);
      await vote(data3, user);
      await vote(data, user2);

      const index = await voting.voteIndex(
        await voting.votePrice(owner.address),
      );

      const nodes = await voting.getNodes();

      const tail = Number(await voting.tail());
      const head = Number(await voting.head());
      await expect(nodes[tail].data.amount).to.equal(6000n);
      await expect(nodes[Number(nodes[tail].prev)].data.amount).to.equal(5000n);
      await expect(nodes[head].data.amount).to.equal(0n);
    });
  });

  describe('Voting', async () => {
    it('should let user to vote', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };
      const tx = await vote(data, user);
      expect(tx).to.equal(true);
    });

    it('should let vote for same amount', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };
      const data2 = {
        amount: 2550,
        price: 60,
      };

      await vote(data, user);
      await vote(data2, user);

      expect(await voting.votePrice(user.address)).to.equal(60);
    });

    it('should change voting started time', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };
      await vote(data, user);

      const currentBlock = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber(),
      );
      const currentTimestamp = currentBlock?.timestamp;

      expect(await voting.votingStartedTime()).to.equal(currentTimestamp);
    });

    it('should revert tx when trying to stop voting to early', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };

      await vote(data, user);
      await expect(voting.endVoting()).to.be.revertedWith(
        "Voting hasn't ended yet",
      );
    });

    it('Should revert tx on negative data', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 0,
      };
      await expect(
        voting.connect(user).vote(0, 0, data, true),
      ).to.be.revertedWith('Data should be positive');
    });

    it('should stop voting when it possible', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };

      await vote(data, user);

      const currentBlock = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber(),
      );
      const currentTimestamp = currentBlock?.timestamp;
      await ethers.provider.send('evm_setNextBlockTimestamp', [
        currentTimestamp! + 600,
      ]);
      await voting.endVoting();

      expect(await voting.votingStartedTime()).to.equal(0);
    });

    it('Should change price to new on voting end', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };

      await vote(data, user);

      const currentBlock = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber(),
      );
      const currentTimestamp = currentBlock?.timestamp;
      await ethers.provider.send('evm_setNextBlockTimestamp', [
        currentTimestamp! + 600,
      ]);
      await voting.endVoting();

      const nodes = await voting.getNodes();
      const tail = Number(await voting.tail());
      expect(await voting.price()).to.equal(nodes[tail].data.amount);
    });

    it("Shouldn't change price when zero price win", async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const currentBlock = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber(),
      );
      const currentTimestamp = currentBlock?.timestamp;
      await ethers.provider.send('evm_setNextBlockTimestamp', [
        currentTimestamp! + 600,
      ]);

      const price = await voting.price();
      await voting.endVoting();
      expect(price).to.equal(await voting.price());
    });

    it('should revert tx if user already voted', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const data = {
        amount: 20,
        price: 60,
      };

      const data2 = {
        amount: 20,
        price: 650,
      };

      await vote(data, user);
      await expect(vote(data2, user)).to.be.revertedWith('Already voted');
    });

    it('Should revert tx without voting power', async () => {
      const data = {
        amount: 20,
        price: 60,
      };

      await expect(vote(data, user)).to.be.revertedWith(
        'Not enough voting power',
      );
    });

    it('Should revert tx if tokens under 0.05%', async () => {
      await voting.connect(user).buy({
        value: 40000,
      });

      const data = {
        amount: 20,
        price: 60,
      };

      await expect(vote(data, user)).to.be.revertedWith(
        'Hold at least 0.05% of all tokens to start voting',
      );
    });

    it('Should change user isVoted to true on vote', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      const data = {
        amount: 20,
        price: 60,
      };
      await vote(data, user);
      expect(await voting.isVoted(user)).to.be.true;
    });
    it('Should decrease voting power', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      const data = {
        amount: 20,
        price: 60,
      };
      const votingPower = await voting.votePower(user);
      await vote(data, user);
      expect(Number(votingPower) - data.amount).to.be.equal(
        await voting.votePower(user),
      );
    });
  });

  describe('Fake data', async () => {
    it('should revert tx on out of bound id', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      await voting.connect(user2).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };
      await vote(data, user);
      await expect(
        voting.connect(user2).vote(5, 5, data, true),
      ).to.be.revertedWith('Invalid id');
    });

    it('should revert tx on out of bound id', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      await voting.connect(user2).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };
      await vote(data, user);
      await expect(
        voting.connect(user2).vote(5, 5, data, true),
      ).to.be.revertedWith('Invalid id');
    });

    it('should revert tx on fake data update', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      await voting.connect(user2).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };
      const data2 = {
        price: 25,
        amount: 55,
      };
      await vote(data, user);

      await expect(
        voting.connect(user2).vote(1, 1, data2, true),
      ).to.be.revertedWith('Invalid data');
    });

    it('should revert tx on out of bound id', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };

      await expect(
        voting.connect(user).vote(1, 5, data, false),
      ).to.be.revertedWith('Invalid id');
    });

    it('should revert tx on voting for not same node', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      await voting.connect(user2).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };

      const data2 = {
        price: 205,
        amount: 500,
      };

      await vote(data, user);
      await vote(data2, user2);

      await expect(
        voting.connect(user).vote(1, 1, data2, true),
      ).to.be.revertedWith('Already voted');
    });

    it('should revert tx invalid insert id', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      await voting.connect(user2).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };

      const data2 = {
        price: 205,
        amount: 500,
      };

      await vote(data, user2);

      await expect(
        voting.connect(user).vote(0, 0, data2, false),
      ).to.be.revertedWith('Invalid id');
    });

    it('should revert tx invalid insert id', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      await voting.connect(user2).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };

      const data2 = {
        price: 205,
        amount: 500,
      };

      await vote(data2, user2);
      await expect(
        voting.connect(user).vote(1, 1, data, false),
      ).to.be.revertedWith('Invalid id');
    });
  });

  describe('Transfer', async () => {
    it("should revert tx when user don't have tokens to transfer", async () => {
      await expect(
        voting.connect(user).transfer(user2.address, 3000000),
      ).to.be.revertedWith('Not enough tokens');
    });

    it('Should send tokens to other user', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await voting.connect(user).transfer(user2.address, 400000);

      const user2Balance = await voting.balanceOf(user2.address);

      await expect(user2Balance).to.equal(400000);
    });

    it('shouldnt transfer tokens if they in voting', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });
      const data: IData = {
        amount: 6000,
        price: 50,
      };
      await vote(data, user);

      await expect(
        voting.connect(user).transfer(user2.address, 4749000),
      ).to.be.revertedWith('Use voteTranser for voted tokens');
    });

    it('Should emit transfer event', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await expect(voting.connect(user).transfer(user2.address, 400000))
        .to.emit(voting, 'Transfer')
        .withArgs(user.address, user2.address, 400000);
    });
    it('Should decrease token amount of sender', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      const initialBalance = await voting.balanceOf(user.address);

      await voting.connect(user).transfer(user2.address, 400000);

      const currentBalance = await voting.balanceOf(user.address);

      await expect(initialBalance - currentBalance).to.equal(400000);
    });
  });

  describe('Fee', async () => {
    it('Should burn fee', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await voting.burnFee();

      expect(await voting.feeToBurn()).to.equal(0);
    });

    it('Should revert ts if not an owner', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await expect(voting.connect(user2).burnFee()).to.be.revertedWith(
        "You aren't an owner",
      );
    });

    it('Should revert tx when trying to burn < than 1 week since last', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await voting.burnFee();

      await voting.connect(user).buy({
        value: 4000000,
      });

      await expect(voting.burnFee()).to.be.rejectedWith(
        'Wait 1 week since last burn',
      );
    });
    it('Should change lastTimeBurnFee to current timestamp', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await voting.burnFee();
      const currentBlock = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber(),
      );
      const currentTimestamp = currentBlock?.timestamp;

      expect(await voting.lastTimeBurnFee()).to.equal(currentTimestamp);
    });
  });

  describe('Double spend', async () => {
    it('Should prevent double spend', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });

      await voting.connect(user2).buy({
        value: 10000000,
      });

      const data: IData = {
        amount: 4750000,
        price: 500,
      };

      const data2: IData = {
        amount: 13000000,
        price: 200,
      };

      await vote(data, user);

      await voterTransfer(4750000, user2.address, user);

      expect(await voting.votePower(user.address)).to.equal(0);

      await vote(data2, user2);

      const nodes = await voting.getNodes();
      const tail = await voting.tail();

      const prevNode = nodes[Number(nodes[Number(tail)].prev)];

      await expect(nodes[Number(tail)].data.amount).to.equal(data2.amount);
      await expect(prevNode.data.amount).to.equal(0);
    });
  });

  describe('Vote Sell', async () => {
    it('Sell', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });
      const data: IData = {
        amount: 5000,
        price: 500,
      };
      await vote(data, user);

      await voterSell(4740000, user);
      expect(await voting.votePower(user.address)).to.equal(5000);
    });

    it('Vote and sell', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });
      await voting.connect(user2).buy({
        value: 5000000,
      });
      const data: IData = {
        amount: 5000,
        price: 500,
      };
      const data2: IData = {
        amount: 4000,
        price: 200,
      };
      await vote(data, user);
      await vote(data2, user2);
      await voterSell(4748000, user);

      expect(await voting.votePower(user.address)).to.equal(0);
    });

    it('Vote more and sell more', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });
      await voting.connect(user3).buy({
        value: 5000000,
      });
      await voting.connect(user2).buy({
        value: 5000000,
      });
      const data: IData = {
        amount: 5000,
        price: 500,
      };
      const data2: IData = {
        amount: 4000,
        price: 200,
      };
      await vote(data, user);
      await voterSell(4748000, user);
      await vote(data, user3);
      await vote(data2, user2);

      expect(await voting.votePower(user.address)).to.equal(0);
    });
  });

  describe('Vote transfer', async () => {
    it('should transfer while in vote', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });

      const data: IData = {
        amount: 5000,
        price: 500,
      };
      await vote(data, user);

      await voterTransfer(4748000, user2.address, user);

      expect(await voting.balanceOf(user2.address)).to.equal(4748000);
      const nodes = await voting.getNodes();
      const tail = await voting.tail();
      expect(nodes[Number(tail)].data.amount).to.equal(2000);
    });

    it('should revert tx when not enough tokens to transfer', async () => {
      await voting.connect(user).buy({
        value: 50000000000,
      });

      await await expect(
        voting.voterTransfer(user2.address, 500000000000, 0, 500),
      ).to.be.revertedWith('Not enough tokens');
    });

    it('should transfer while in vote', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });

      await voting.connect(user2).buy({
        value: 5000000,
      });

      const data: IData = {
        amount: 5000,
        price: 500,
      };

      const data2: IData = {
        amount: 4000,
        price: 5000,
      };

      await vote(data, user);
      await vote(data2, user2);

      await voterTransfer(4748000, user3.address, user);

      expect(await voting.balanceOf(user3.address)).to.equal(4748000);
      const nodes = await voting.getNodes();
      const tail = await voting.tail();
      expect(nodes[Number(tail)].data.amount).to.equal(4000);
    });

    it('should transfer while not in vote', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });

      await voting.connect(user).voterTransfer(user3.address, 4748000, 0, 300);

      expect(await voting.balanceOf(user3.address)).to.equal(4748000);
    });
  });

  describe('Vote sell', async () => {
    it('should sell tokens that not in voting', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1'),
      });

      const initialBalance = await ethers.provider.getBalance(user.address);

      await voterSell(500000000000000, user);

      expect(await ethers.provider.getBalance(user.address)).be.gt(
        initialBalance,
      );
    });

    it('should revert tx when not enough tokens to sell', async () => {
      await voting.connect(user).buy({
        value: 50000000000,
      });

      await await expect(
        voting.connect(user).voterSell(500000000000, 0, 500),
      ).to.be.revertedWith('Not enough tokens to sell');
    });

    it('should revert tx when too small amount', async () => {
      await voting.connect(user).buy({
        value: 50000000000,
      });

      await await expect(
        voting.connect(user).voterSell(19, 0, 500),
      ).to.be.revertedWith('Too small amount');
    });
  });
});
