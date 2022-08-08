// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "hardhat/console.sol";

// Error Declarations:
error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**@title A sample Raffle Contract
 * @author Juan Nuvreni
 * @notice This contract is for creating a sample raffle contract
 * @dev This implements the Chainlink VRF Version 2
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    
    // Type Declarations:
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // Chainlink VRF Variables:
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // State Variables:
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    
    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    // Events:
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,  // contract address
        uint64 subscriptionId,
        bytes32 gasLane, // keyHash
        uint256 interval,
        uint32 callbackGasLimit,
        uint256 entranceFee) VRFConsumerBaseV2(vrfCoordinatorV2) {

        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_interval = interval;
        i_subscriptionId = subscriptionId;
        i_entranceFee = entranceFee;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_callbackGasLimit = callbackGasLimit;
    }

    /**
    * @dev Enters the raffle, emits RaffleEnter event.
     */
    function enterRaffle() public payable {
        //require msg.value > i_entrancefee
        if(msg.value < i_entranceFee) { 
            revert Raffle__NotEnoughEthEntered();
        }

        if(s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
    * @dev This is the function that the chainlink keepers nodes call
    * they look for the `upkeepNeeded` to return true.
    * The following should be true to return true:
    * 1. Time interval should have passed
    * 2. Lotter should have at least 1 player and have some ETH
    * 3. Subscription is funded with LINK
    * 4. The lottery should not be in Open State
    */
    function checkUpkeep(bytes memory /* checkData */) 
    public 
    view
    override
    returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        bool upKeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upKeepNeeded, "0x0"); // can we comment this out?
    }

    function performUpkeep(bytes calldata /* performData */)
    external
    override {

        (bool upKeepNeeded, ) = checkUpkeep("");
        if(!upKeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance, 
                s_players.length,
                uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, //keyHash
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS);
            
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /* requestId, */
        uint256[] memory randomWords)
        internal 
        override {
        
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        // store the recent winner:
        s_recentWinner = recentWinner;
        // Reset players array:
        s_players = new address payable[](0);
        // Reset last timestamp:
        s_lastTimeStamp = block.timestamp;
        // Reopen raffle:
        s_raffleState = RaffleState.OPEN;
        // Pay to winner:
        (bool success, ) = recentWinner.call{ value: address(this).balance }("");
        
        if(!success){
            revert Raffle__TransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    // View/pure functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayerAt(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayer() public view returns(uint256) {
        return s_players.length;
    }
    
    function getLatestTimestamp() public view returns(uint256) {
        return s_lastTimeStamp;
    }
    function getRequestConfirmations() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }
    
    function getInterval() public view returns(uint256) {
        return i_interval;
    }
}