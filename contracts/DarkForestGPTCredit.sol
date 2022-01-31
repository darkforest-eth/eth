// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

// Import base Initializable contract
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

contract DarkForestGPTCredit is Initializable {
    // storage
    mapping(address => uint256) public credits;
    uint256 public creditPrice;
    address admin;

    // events
    event ChangedCreditPrice(uint256 newPrice);
    event BoughtCredits(address buyer, uint256 amount, uint256 cost);
    event DeductedCredits(address player, uint256 amount);
    event GiftedCredits(address player, uint256 amount);

    // administrative
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only administrator can perform this action");
        _;
    }

    // initialization functions are only called once during deployment. They are not called during upgrades.
    function initialize(address _admin) public initializer {
        creditPrice = 0.1 ether; // default price is 0.10 xDAI
        admin = _admin;
    }

    function changeAdmin(address _newAdmin) public onlyAdmin {
        admin = _newAdmin;
    }

    function changeCreditPrice(uint256 newPrice) public onlyAdmin {
        // newPrice is in wei
        require(newPrice > 0, "invalid newPrice");
        creditPrice = newPrice;
        emit ChangedCreditPrice(newPrice);
    }

    function giftPlayerCredits(address player, uint256 amount) public onlyAdmin {
        require(amount > 0, "Invalid amount");
        uint256 newBalance = credits[player] + amount;
        require(newBalance >= credits[player], "addition overflow");
        credits[player] = newBalance;
        emit GiftedCredits(player, amount);
    }

    function decreasePlayerCredits(address player, uint256 amount) public onlyAdmin {
        require(amount > 0, "Invalid amount");
        require(credits[player] >= amount, "Not enough credits");
        uint256 remaining = credits[player] - amount;
        credits[player] = remaining;
        emit DeductedCredits(player, amount);
    }

    function withdraw() public onlyAdmin {
        msg.sender.transfer(address(this).balance);
    }

    // allow player to buy credits
    function buyCredits(uint256 amount) public payable {
        require(amount > 0, "Invalid amount");

        uint256 cost = amount * creditPrice;
        require(cost / amount == creditPrice, "multiplication overflow");
        require(msg.value == cost, "Wrong value sent");

        require(credits[msg.sender] + amount >= credits[msg.sender], "addition overflow");
        credits[msg.sender] = credits[msg.sender] + amount;

        emit BoughtCredits(msg.sender, amount, cost);
    }

    function receiveEther() external payable {}

    receive() external payable {}
}
