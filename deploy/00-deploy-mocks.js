const { config } = require("bluebird")
const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

// Base fee in LINK that is paid on every request to ChainLink network
// No sponsor for this requests :(
const BASE_FEE = ethers.utils.parseEther("0.25")
// Calculated value based on the gas price of the chain (link per gas)
const GAS_PRICE_LINK = 1e9

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK]
    if (developmentChains.includes(network.name)) {
        log("Local Network Detected! Deploying Mocks...")
        
        // Deploy Mock VRF Coordinator
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args
        })

        log("Mocks Deployed!")
        log("---------------------------------")


    }

}

module.exports.tags = ["all", "mocks"]