const {frontEndContractsFile, frontEndAbiFile} = require("../helper-hardhat-config")
const fs = require("fs")
const {network, ethers} = require("hardhat")

module.exports = async () => {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Writing to front end...")
        console.log(frontEndAbiFile)
        console.log(frontEndContractsFile)
        await updateContractAddresses()
        await updateAbi()
        console.log("Front end written!")
    }
}
/**
 * Updates the ABI file.
 */
async function updateAbi() {
    console.log("Writing ABI...")
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(frontEndAbiFile, raffle.interface.format(ethers.utils.FormatTypes.json))
}

/**
 * Updates the contract addresses file for the front end.
 */
async function updateContractAddresses() {
    console.log("Writing addresssesclaer...")
    const raffle = await ethers.getContract("Raffle")
    const chainID = network.config.chainId.toString()
    console.log("chain ID ------" + chainID)
    const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"))
    if (chainID in contractAddresses) {
        if (! contractAddresses[chainID].includes(raffle.address)) {
            contractAddresses[chainID].push(raffle.address)
        }
    } else {
        contractAddresses[network.config.chainId.toString()] = [raffle.address]
        console.log("LOL " + contractAddresses)
    } fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses))
}
module.exports.tags = ["all", "frontend"]
