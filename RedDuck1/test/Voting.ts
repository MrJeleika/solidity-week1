import { DoublyLinkedList } from './../typechain-types/LinkedList.sol/DoublyLinkedList';
import { expect } from 'chai';
import { Voting } from './../typechain-types/Voting';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Voting', () => {
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
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

  // Replaces nodes data value changed to bigger than next
  const recountNodes = async (indexOfExistingNode: number) => {
    let nodes = await voting.getNodes();
    let currentNode = nodes[indexOfExistingNode];
    if (!nodes[Number(currentNode.next)]) return;

    let nodeToCompare = nodes[Number(currentNode.next)];
    if (!nodeToCompare.data) return;

    while (
      nodeToCompare &&
      nodeToCompare.data.amount <= currentNode.data.amount
    ) {
      if (currentNode.data.amount > nodeToCompare.data.amount) {
        await voting.swapNodesData(
          indexOfExistingNode,
          Number(currentNode.next),
        );
      }

      if (nodeToCompare.next >= BigInt(nodes.length)) {
        break;
      }

      currentNode = nodeToCompare;
      nodeToCompare = nodes[Number(nodeToCompare.next)];
    }
  };

  const vote = async (
    data: any,
    user: HardhatEthersSigner,
  ): Promise<boolean> => {
    const nodes = await voting.getNodes();
    // Check if node with this price already exists
    const indexOfExistingNode = nodes.findIndex(
      (node) => node[0].price === BigInt(data.price),
    );

    // If yes add amount to it and recount
    if (indexOfExistingNode >= 0) {
      await voting.connect(user).vote(indexOfExistingNode, data, true);
      await recountNodes(indexOfExistingNode);
      return true;
    }
    // Else, get index to insert new node and add it
    const index = await getIndex(data.amount);
    await voting.connect(user).vote(index, data, false);
    return true;
  };

  const name = 'Jaba';
  const symbol = 'JAB';
  const supply = 1000000000;
  const price = 1;
  const fee = 5;

  beforeEach(async () => {
    [owner, user, user2] = await ethers.getSigners();
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

    it('Should be reverted when user try to sell voted tokens', async () => {
      await voting.connect(user).buy({
        value: 5000000,
      });

      const data = {
        amount: 4000000,
        price: 5,
      };
      await vote(data, user);
      await expect(voting.connect(user).sell(4000000)).to.be.revertedWith(
        "Can't withdraw tokens while voting",
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
        price: 600,
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
        value: ethers.parseEther('1'),
      });
      await voting.connect(owner).buy({
        value: ethers.parseEther('1'),
      });
      await voting.connect(user2).buy({
        value: ethers.parseEther('1'),
      });

      await vote(data3, user);
      await vote(data, user2);
      await vote(data2, owner);

      const nodes = await voting.getNodes();
      console.log(nodes);

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
      await expect(vote(data, user)).to.be.revertedWith(
        'Data should be positive',
      );
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
    it('should revert tx on out of bound index', async () => {
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
        voting.connect(user2).vote(5, data, true),
      ).to.be.revertedWith('Invalid index');
    });
    it('should revert tx on fake index update', async () => {
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
        voting.connect(user2).vote(2, data2, true),
      ).to.be.revertedWith('Invalid data');
    });
    it('should revert tx on out of bound index', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      const data = {
        price: 20,
        amount: 50,
      };

      await expect(
        voting.connect(user).vote(1, data, false),
      ).to.be.revertedWith('Invalid index');
    });
  });
  describe('Transfer', async () => {
    it("should revert tx when user don't have tokens to transfer", async () => {
      await expect(
        voting.connect(user).transfer(user2.address, 3000000),
      ).to.be.revertedWith('Not enough tokens');
    });

    it('should revert tx when tokens in voting', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });
      const data = {
        price: 20,
        amount: 3000000,
      };
      await vote(data, user);
      await expect(
        voting.connect(user).transfer(user2.address, 3000000),
      ).to.be.revertedWith('Tokens in voting');
    });

    it('Should send tokens to other user', async () => {
      await voting.connect(user).buy({
        value: 4000000,
      });

      await voting.connect(user).transfer(user2.address, 400000);

      const user2Balance = await voting.balanceOf(user2.address);

      await expect(user2Balance).to.equal(400000);
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
});
