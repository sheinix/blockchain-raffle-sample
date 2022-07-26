const { EtherscanProvider } = require("@ethersproject/providers")
const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { t } = require("tar")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function() {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
        const chainId = network.config.chainId
        
        beforeEach(async function() {
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe("constructor", function() {
            it("initializes the raffle correctly", async function() {
                // ideally we make our tests have just 1 assert per "it"

                const raffleState = await raffle.getRaffleState()
                const interval = await raffle.getInterval()
                
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
            })
        })


        describe("enter raffle", function() {
            it("revers when you dont pay enough", async function() {
               await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEthEntered")
            })

            it("records players when they enter", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const playerFromContract = await raffle.getPlayerAt(0)
                assert.equal(playerFromContract, deployer)
             })

             it("Emits event on enter", async function() {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter")
             })

             it("doesnt allow entrance when raffle is calculating", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })

                //Increase the blockchain time and mine another block:
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                
                //We pretend to be a chainlink keeper now:
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen")
             })
        })

        describe("checkUpKeep", function() {
            it("returns false if people haven't sent any eth", async function() {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])

                const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upKeepNeeded)
            })

            it("returns false if raffle isn't open", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                await raffle.performUpkeep([])  // change the state to calculating
                const raffleState = await raffle.getRaffleState()
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)

                assert.equal(raffleState.toString(), "1", upkeepNeeded == false) // raffle state calculating..
           })

           it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) 
                assert(!upkeepNeeded, true)
            })

            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") 
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", function() {
            it("can only run if checkupkeep is true", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })

            it("reverts when checkupUpkeep is false", async function() {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded") // can specify the values we are looking for if we want.
            })

            it("udpates the raffle state emits an event and calls the vrf coordinator", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.events[1].args.requestId
                const raffleState = await raffle.getRaffleState()
                assert(requestId.toNumber() > 0)
                assert(raffleState.toString() == "1")
            })
        })

        describe("fullfill random words", function() {
            // Before testing thee fullfill random words we want someone entered the lottery and moved to the next block:
            this.beforeEach(async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
            })

            it("can only be called after performUpkeep", async function() {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
            })

            // this test might be too big, and need to be broken down
            it("picks the winner, resets the lottery, and send money", async function() {
                const additionalEntrants = 3
                const startingAccountIndex = 1  // deployer = 0
                const accounts = await ethers.getSigners()

                for(let i = startingAccountIndex; i<startingAccountIndex + additionalEntrants ; i++) {
                    const accountConnectedRaffle = raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                }

                const startingTimestamp = await raffle.getLatestTimestamp()
                // peform upkeep
                // fullfill random words (mock being the VRF)
                
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("Found the event!")
                        try {
                            const recentWinner = await raffle.getRecentWinner()

                            console.log("recentWinner: " + recentWinner)
                            console.log(accounts[0].address)
                            console.log(accounts[1].address) //account one is winner
                            console.log(accounts[2].address)
                            console.log(accounts[3].address)

                            const raffleState = await raffle.getRaffleState()
                            const endingTimestamp = await raffle.getLatestTimestamp()
                            const numPlayers = await raffle.getNumberOfPlayer()
                            const winnerEndingBalance = await accounts[1].getBalance()
                            assert.equal(numPlayers.toString(), "0")
                            assert.equal(raffleState.toString(), "0")

                            assert(endingTimestamp > startingTimestamp)

                            // assert account1 gets the pot
                            assert.equal(
                                winnerEndingBalance.toString(),
                                winnerStartingBalance.add(
                                    raffleEntranceFee
                                        .mul(additionalEntrants)
                                        .add(raffleEntranceFee)
                                        .toString()
                                )
                            )
                            resolve()
                        
                        } catch (e) {
                            reject(e)
                        }                      
                    })

                    const tx = await raffle.performUpkeep([])
                    const txReceipt = await tx.wait(1)
                    const winnerStartingBalance = await accounts[1].getBalance()
                    await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)
                })
            })
        })
})