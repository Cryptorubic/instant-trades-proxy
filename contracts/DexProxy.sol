//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./FeeInfo.sol";

contract DexProxy is Ownable {
    using Address for address;
    using SafeERC20 for IERC20;

    uint constant feeDivisor = 100000;
    /**
     * @dev Promoter fee in range 1 to feeDivisor (1 means 1/feeDivisor), so range is 0.00001 (0.001%) to 1
     */
    uint promoterFee;

    /**
     * @dev Contract owner fee (if no promocode passed) in range 1 to feeDivisor (1 means 1/feeDivisor), so range is 0.00001 (0.001%) to 1
     */
    uint providerBaseFee;

    /**
     * @dev Contract owner discount fee in range 1 to feeDivisor (1 means 1/feeDivisor), so range is 0.00001 (0.001%) to 1
     */
    uint providerDiscountFee;

    address providerFeeTarget;

    mapping(address => bool) dexes;

    mapping(uint => bool) availableFeeValues;

    constructor(
        uint _promoterFee,
        uint _providerBaseFee,
        uint _providerDiscountFee,
        address _providerFeeTarget,
        uint[] memory _availableFeeValues,
        address[] memory _dexes
    ) {
        _setPromoterFee(_promoterFee);
        _setProviderBaseFee(_providerBaseFee);
        _setProviderDiscountFee(_providerDiscountFee);
        _setProviderFeeTarget(_providerFeeTarget);
        _setAvailableFeeValues(_availableFeeValues);
        _setDexes(_dexes);
    }

    function swap(
        address fromToken,
        address toToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters,
        FeeInfo calldata feeInfo
    ) external payable {
        uint tokensReceived = _swap(fromToken, toToken, value, targetDex, encodedParameters, feeInfo);

        sendReceivedTokens(toToken, tokensReceived, feeInfo);
    }

    function swapWithPromoter(
        address fromToken,
        address toToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters,
        FeeInfo calldata feeInfo,
        address promoterAddress
    ) external payable {
        uint tokensReceived = _swap(fromToken, toToken, value, targetDex, encodedParameters, feeInfo);

        sendReceivedTokens(toToken, tokensReceived, feeInfo, promoterAddress);
    }

    function _swap(
        address fromToken,
        address toToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters,
        FeeInfo calldata feeInfo
    ) private returns(uint) {
        require(dexes[targetDex], "Passed dex is not supported.");
        require(availableFeeValues[feeInfo.fee], "Passed fee value is not supported.");
        uint fromTokenBalanceBefore = getBalance(fromToken);
        uint toTokenBalanceBefore = getBalance(toToken);

        if (fromToken == address(0)) {
            swapFromNativeToken(value, targetDex, encodedParameters);
        } else {
            swapFromErc20Token(fromToken, value, targetDex, encodedParameters);
        }

        uint fromTokenBalanceAfter = getBalance(fromToken);
        uint tokensPaid = fromTokenBalanceBefore - fromTokenBalanceAfter;
        require(tokensPaid == value, 'Value parameter is not equal to swap data amount parameter.');

        uint toTokenBalanceAfter = getBalance(toToken);
        uint tokensReceived = toTokenBalanceAfter - toTokenBalanceBefore;
        require(tokensReceived > 0, 'Swapped to zero tokens.');

        return tokensReceived;
    }

    function swapFromNativeToken(
        uint value,
        address targetDex,
        bytes calldata encodedParameters
    ) private {
        require(msg.value == value, "Transaction value must be equal to value parameter.");
        targetDex.functionCallWithValue(encodedParameters, value);
    }

    function swapFromErc20Token(
        address fromToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters
    ) private {
        IERC20(fromToken).safeTransferFrom(_msgSender(), address(this), value);
        IERC20(fromToken).safeApprove(targetDex, value);
        targetDex.functionCall(encodedParameters);
    }

    function getBalance(address tokenAddress) private view returns (uint balance) {
        if (tokenAddress == address(0)) {
            balance = address(this).balance;
        } else {
            balance = IERC20(tokenAddress).balanceOf(address(this));
        }
    }

    function sendReceivedTokens(
        address toToken,
        uint tokensReceived,
        FeeInfo calldata feeInfo
    ) private {
        uint integratorAmount = tokensReceived * feeInfo.fee / feeDivisor;
        uint providerAmount = tokensReceived * providerBaseFee / feeDivisor;
        uint userAmount = tokensReceived - integratorAmount - providerAmount;

        transferTokenOrNativeCoin(toToken, feeInfo.feeTarget, integratorAmount);
        transferTokenOrNativeCoin(toToken, providerFeeTarget, providerAmount);
        transferTokenOrNativeCoin(toToken, _msgSender(), userAmount);
    }

    function sendReceivedTokens(
        address toToken,
        uint tokensReceived,
        FeeInfo calldata feeInfo,
        address promoterAddress
    ) private {
        uint integratorFeeBonus = providerBaseFee - providerDiscountFee - promoterFee;
        uint integratorFee = feeInfo.fee + integratorFeeBonus;

        uint integratorAmount = tokensReceived * integratorFee / feeDivisor;
        uint providerAmount = tokensReceived * providerDiscountFee / feeDivisor;
        uint promoterAmount = tokensReceived * promoterFee / feeDivisor;
        uint userAmount = tokensReceived - integratorAmount - promoterAmount - providerAmount;

        transferTokenOrNativeCoin(toToken, feeInfo.feeTarget, integratorAmount);
        transferTokenOrNativeCoin(toToken, providerFeeTarget, providerAmount);
        transferTokenOrNativeCoin(toToken, promoterAddress, promoterAmount);
        transferTokenOrNativeCoin(toToken, _msgSender(), userAmount);
    }

    function transferTokenOrNativeCoin(address tokenAddress, address receiver, uint amount) private {
        if (tokenAddress == address(0)) {
            payable(receiver).transfer(amount);
        } else {
            IERC20(tokenAddress).safeTransfer(receiver, amount);
        }
    }

    function setPromoterFee(uint _promoterFee) external onlyOwner {
        _setPromoterFee(_promoterFee);
    }

    function _setPromoterFee(uint _promoterFee) private {
        require(_promoterFee <= feeDivisor, 'Fee can not be grow than feeDivisor');
        promoterFee = _promoterFee;
    }

    function setProviderBaseFee(uint _providerBaseFee) external onlyOwner {
        _setProviderBaseFee(_providerBaseFee);
    }

    function _setProviderBaseFee(uint _providerBaseFee) private {
        require(_providerBaseFee <= feeDivisor, 'Fee can not be grow than feeDivisor');
        require(_providerBaseFee - promoterFee >= providerDiscountFee, 'Base fee minus promoter fee must be grow or equal than discount fee');
        providerBaseFee = _providerBaseFee;
    }

    function setProviderDiscountFee(uint _providerDiscountFee) external onlyOwner {
        _setProviderDiscountFee(_providerDiscountFee);
    }

    function _setProviderDiscountFee(uint _providerDiscountFee) private {
        require(_providerDiscountFee <= feeDivisor, 'Fee can not be grow than feeDivisor');
        require(_providerDiscountFee + promoterFee <= providerBaseFee, 'Discount fee plus promoter fee must be less or equal than base fee');
        providerDiscountFee = _providerDiscountFee;
    }

    function setProviderFeeTarget(address _providerFeeTarget) external onlyOwner {
        _setProviderFeeTarget(_providerFeeTarget);
    }

    function _setProviderFeeTarget(address _providerFeeTarget) private {
        providerFeeTarget = _providerFeeTarget;
    }

    function setAvailableFeeValues(uint[] memory _availableFeeValues) external onlyOwner {
        _setAvailableFeeValues(_availableFeeValues);
    }

    function _setAvailableFeeValues(uint[] memory _availableFeeValues) private {
        for (uint i=0; i < _availableFeeValues.length; i++) {
            availableFeeValues[_availableFeeValues[i]] = true;
        }
    }

    function removeFeeValue(uint feeValue) external onlyOwner {
        availableFeeValues[feeValue] = false;
    }

    function setDexes(address[] memory _dexes) external onlyOwner {
        _setDexes(_dexes);
    }

    function _setDexes(address[] memory _dexes) private {
        for (uint i=0; i < _dexes.length; i++) {
            dexes[_dexes[i]] = true;
        }
    }

    function removeDex(address dex) external onlyOwner {
        dexes[dex] = false;
    }
}
