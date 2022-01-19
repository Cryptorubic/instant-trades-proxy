//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Withdrawable is Ownable {
    function withdraw(
        address token,
        uint amount,
        address payable receiver
    ) external onlyOwner {
        if (token == address(0)) {
            receiver.transfer(amount);
        } else {
            IERC20(token).transfer(receiver, amount);
        }
    }
}
