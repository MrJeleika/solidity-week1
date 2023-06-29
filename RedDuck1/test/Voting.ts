import {
  expect
} from 'chai';
import {
  Voting
} from './../typechain-types/Voting';
import {
  ethers
} from "hardhat";
import {
  HardhatEthersSigner
} from '@nomicfoundation/hardhat-ethers/signers';


describe('Voting', () => {
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let voting: Voting;


  const getIndex = async (amount: number): Promise<number> => {
    const nodes = await voting.getNodes();
    let index = 0;
    let currentNode = nodes[index];

    for (let i = 0; i < nodes.length; i++) {
      if (currentNode.data.amount >= BigInt(amount)) {
        index = Number(currentNode.prev)
        break;
      }
      if(nodes[index].next > BigInt(Number.MAX_SAFE_INTEGER)){
        break
      }
      index = Number(nodes[index].next);
      currentNode = nodes[index];
    }
  
    return index;
  };
  

  const vote = async (data: any) => {
    const nodes = await voting.getNodes();
    const indexOfExistingNode = nodes.findIndex(node => node[0].price === BigInt(data.price));
    
    let isExisting = false;

    if (indexOfExistingNode >= 0) {
      await voting.vote(indexOfExistingNode, data, true);
      return
    }

    const index = await getIndex(data.amount)
    console.log('index of element '+ index);

    await voting.vote(index, data, false)
  }



  beforeEach(async () => {
    [owner, user, user2] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory('Voting', owner)
    voting = await Voting.deploy('Jaba', "JABA", 1000000);

  })

  it('should be deployed', async () => {
    expect(await voting.getAddress()).to.be.properAddress;
  })

  it('should have proper name and symbol', async () => {
    await expect(await voting.name()).to.be.equal('Jaba');
    await expect(await voting.symbol()).to.be.equal('JABA');
  })

  describe('Voting', async () => {
    it('should revert transaction when user don"t have tokens', async () => {
      // const tx = voting.connect(user).vote(50, 50)
      // await expect(tx).to.be.revertedWith("You have to hold at least 0.05% of all tokens to vote")
    })

    it('should let users to mint tokens', async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1')
      })
      const userBalance = await voting.balanceOf(user)
      expect(userBalance).to.be.gt(5)
    })

    it("shouldn't allow to vote if voting haven't started", async () => {
      await voting.connect(user).buy({
        value: ethers.parseEther('1')
      })

      // const tx = voting.connect(user).vote(50, 50)
      // await expect(tx).to.be.revertedWith("Voting haven't started yet")
    })
    describe('Buy', async () => {
      it('Should change voting power of user', async () => {
        await voting.connect(user).buy({
          value: ethers.parseEther('1')
        })
        const power = await voting.connect(user).votePower(user.address)
        expect(power).to.be.gt(50n);
      })

      it('Should change fee', async () => {
        await voting.connect(user).buy({
          value: ethers.parseEther('1')
        })
        const fee = await voting.connect(user).feeToBurn()
        expect(fee).to.be.gt(50n);
      })

      it('Should revert transaction on too small amount', async () => {
        await expect(voting.connect(user).buy({
            value: 5
          }))
          .to.be.revertedWith('Too small amount');
      })
    })




    describe('Sell', async () => {
      it('Should decrease user balance on sell', async () => {
        await voting.connect(user).buy({
          value: ethers.parseEther('1')
        })
        const balance = await voting.connect(user).balanceOf(user.address)

        await voting.connect(user).sell(50000)

        expect(await voting.connect(user).balanceOf(user.address)).to.be.lt(balance);
      })

      it('Should decrease user voting power on sell', async () => {
        await voting.connect(user).buy({
          value: ethers.parseEther('1')
        })
        const votePover = await voting.connect(user).votePower(user.address)

        await voting.connect(user).sell(50000)

        expect(await voting.connect(user).votePower(user.address)).to.be.lt(votePover);
      })

      it('Should change fee', async () => {
        await voting.connect(user).buy({
          value: ethers.parseEther('1')
        })
        const fee = await voting.connect(user).feeToBurn()
        expect(fee).to.be.gt(50n);
      })

      it("Should be reverted when not enought tokens to sell", async () => {
        await voting.connect(user).buy({
          value: 500000
        })
        await expect(voting.connect(user).sell(6000000)).to.be.revertedWith("You don't have enough tokens to sell")
      })

      it("Should be reverted when user try to sell voted tokens", async () => {
        await voting.connect(user).buy({
          value: 500000
        })
        console.log(await voting.connect(user).votePower(user.address));
        
        const data = {
          amount: 400000,
          price: 5
        }
        // await vote(data, user)
        await expect(voting.connect(user).sell(400000)).to.be.revertedWith("You can't withdraw tokens while you're voting")
      })
    })

    describe('Getting items', async () => {


      it("should return biggest amount", async () => {
        const data = {
          amount: 20,
          price: 60
        }
        const data2 = {
          amount: 50,
          price: 60
        }
        const data3 = {
          amount: 500,
          price: 10
        }
        const data4 ={
          amount: 6000,
          price: 8000
        }
        await voting.buy({
          value: ethers.parseEther('1')
        })

        await vote(data3)
        await vote(data)
        await vote(data2)
        await vote(data4)
        await vote(data3)
        await vote(data)
        await vote(data2)
        await vote(data4)

        const nodes = await voting.getNodes();
        console.log(nodes);
        const tail = Number(await voting.tail())
        await expect(await nodes[tail].data.amount).to.equal(12000n)
      })
      // const mintTokens = async () => {
      //   await voting.connect(user).buy({value: ethers.parseEther('1')})
      //   await voting.connect(user2).buy({value: ethers.parseEther('0.5')})
      //   await voting.startVoting()
      //   await voting.connect(user).vote(100, 50)
      //   await voting.connect(user2).vote(10, 60)
      // }

      // const prepareVoting = async (price: bigint, amount: number) => {
      //   const prices = await voting.getPrices()
      //   if(prices.includes(price)) 
      // }

      // it('should return all items,', async () => {
      //   mintTokens()
      //   const prices = await voting.getPrices()
      //   let maxVotes = 0n;
      //   let indexOfPriceWithMaxVotes = 0;
      //   for (let i = 0; i < prices.length; i++) {
      //     voting.getVotesNumByPrice(i).then(res => {
      //       if(maxVotes < res){ 
      //         maxVotes = res;
      //         indexOfPriceWithMaxVotes = i;
      //       }
      //     })
      //   }

      //   expect(maxVotes).to.equal(60)
      // })
    })
  })
})