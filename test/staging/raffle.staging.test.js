const { EtherscanProvider } = require("@ethersproject/providers")
const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { start } = require("repl")
const { t } = require("tar")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function() {
        let raffle, raffleEntranceFee, deployer
        
        beforeEach(async function() {
            deployer = (await getNamedAccounts()).deployer
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
        })

        describe("fullfillRandomWords", function() {
            it("works with live chainlink keepers and chainlink vrf, we get a random winner", async function() {
                // enter raffle:
                const startingTimestamp = await raffle.getLatestTimestamp()
                const accounts = await ethers.getSigners()

                // Setup listener before enter the raffle just in case blockchain is fast!
                // await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("Winner Picked Event Fired!")
                        try {
                            
                            // get latest data:
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerEndingBalance = await accounts[0].getBalance() // since we entered only with the deployer
                            const endingTimestamp = await raffle.getLatestTimestamp()
                            
                            // test players reset
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            // test recent winner:
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            
                            // test raffle state:
                            assert.equal(raffleState, 0)

                            // test that winner got the money back:
                            assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString())
                            
                            // test timestamps:
                            assert(endingTimestamp > startingTimestamp)
                            
                            resolve()
                        
                        } catch (e) {
                            reject(e)
                        }                      
                    })
                    
                    // Enter the raffle:
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    const winnerStartingBalance = await accounts[0].getBalance() 
                    // this code wont complete until the listener has finished listening-
                })
            })
        })
    })