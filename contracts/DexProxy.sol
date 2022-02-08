//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./FeeInfo.sol";
import "./libraries/FullMath.sol";
import "./Withdrawable.sol";

contract DexProxy is Withdrawable {
    using Address for address;
    using SafeERC20 for IERC20;
    using FullMath for uint;

    uint public constant FEE_DIVISOR = 100000;
    /**
     * @dev Promoter fee in range 0 to feeDivisor (1 means 1/feeDivisor), so range is 0.00001 (0.001%) to 1
     */
    uint public promoterFee;

    /**
     * @dev Contract owner fee (if no promocode passed) in range 0 to feeDivisor (1 means 1/feeDivisor), so range is 0.00001 (0.001%) to 1
     */
    uint public providerBaseFee;

    /**
     * @dev Contract owner discount fee in range 0 to feeDivisor (1 means 1/feeDivisor), so range is 0.00001 (0.001%) to 1
     */
    uint public providerDiscountFee;

    address public providerFeeTarget;

    mapping(address => bool) public dexes;

    mapping(uint => bool) public availableFeeValues;

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

    receive() external payable {}

    function swap(
        address fromToken,
        address toToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters,
        FeeInfo calldata feeInfo
    ) external payable {
        uint tokensReceived = _swap(fromToken, toToken, value, targetDex, encodedParameters, feeInfo);

        _sendReceivedTokens(toToken, tokensReceived, feeInfo);
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

        _sendReceivedTokens(toToken, tokensReceived, feeInfo, promoterAddress);
    }

    function _swap(
        address fromToken,
        address toToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters,
        FeeInfo calldata feeInfo
    ) private returns (uint) {
        require(dexes[targetDex], "Passed dex is not supported.");
        require(availableFeeValues[feeInfo.fee], "Passed fee value is not supported.");
        uint fromTokenBalanceBefore;
        uint toTokenBalanceBefore = _getBalance(toToken);

        if (fromToken == address(0)) {
            fromTokenBalanceBefore = _getBalance(fromToken);
            _swapFromNativeToken(value, targetDex, encodedParameters);
        } else {
            IERC20(fromToken).safeTransferFrom(_msgSender(), address(this), value);
            fromTokenBalanceBefore = _getBalance(fromToken);
            _swapFromErc20Token(fromToken, value, targetDex, encodedParameters);
        }

        uint fromTokenBalanceAfter = _getBalance(fromToken);
        uint tokensPaid = fromTokenBalanceBefore - fromTokenBalanceAfter;
        require(tokensPaid == value, "Value parameter is not equal to swap data amount parameter.");

        uint toTokenBalanceAfter = _getBalance(toToken);
        uint tokensReceived = toTokenBalanceAfter - toTokenBalanceBefore;
        require(tokensReceived > 0, "Swapped to zero tokens.");

        return tokensReceived;
    }

    function _swapFromNativeToken(
        uint value,
        address targetDex,
        bytes calldata encodedParameters
    ) private {
        require(msg.value == value, "Transaction value must be equal to value parameter.");
        targetDex.functionCallWithValue(encodedParameters, value);
    }

    function _swapFromErc20Token(
        address fromToken,
        uint value,
        address targetDex,
        bytes calldata encodedParameters
    ) private {
        _safeApproveToInfinityIfNeeded(IERC20(fromToken), targetDex, value);
        targetDex.functionCall(encodedParameters);
    }

    function _getBalance(address tokenAddress) private view returns (uint balance) {
        if (tokenAddress == address(0)) {
            balance = address(this).balance;
        } else {
            balance = IERC20(tokenAddress).balanceOf(address(this));
        }
    }

    function _sendReceivedTokens(
        address toToken,
        uint tokensReceived,
        FeeInfo calldata feeInfo
    ) private {
        uint integratorAmount = tokensReceived.mulDiv(feeInfo.fee, FEE_DIVISOR);
        uint providerAmount = tokensReceived.mulDiv(providerBaseFee, FEE_DIVISOR);
        uint userAmount = tokensReceived - integratorAmount - providerAmount;

        _transferTokenOrNativeCoin(toToken, feeInfo.feeTarget, integratorAmount);
        _transferTokenOrNativeCoin(toToken, providerFeeTarget, providerAmount);
        _transferTokenOrNativeCoin(toToken, _msgSender(), userAmount);
    }

    function _sendReceivedTokens(
        address toToken,
        uint tokensReceived,
        FeeInfo calldata feeInfo,
        address promoterAddress
    ) private {
        uint integratorFeeBonus = providerBaseFee - providerDiscountFee - promoterFee;
        uint integratorFee = feeInfo.fee + integratorFeeBonus;

        uint integratorAmount = tokensReceived.mulDiv(integratorFee, FEE_DIVISOR);
        uint providerAmount = tokensReceived.mulDiv(providerDiscountFee, FEE_DIVISOR);
        uint promoterAmount = tokensReceived.mulDiv(promoterFee, FEE_DIVISOR);
        uint userAmount = tokensReceived - integratorAmount - promoterAmount - providerAmount;

        _transferTokenOrNativeCoin(toToken, feeInfo.feeTarget, integratorAmount);
        _transferTokenOrNativeCoin(toToken, providerFeeTarget, providerAmount);
        _transferTokenOrNativeCoin(toToken, promoterAddress, promoterAmount);
        _transferTokenOrNativeCoin(toToken, _msgSender(), userAmount);
    }

    function _transferTokenOrNativeCoin(
        address tokenAddress,
        address receiver,
        uint amount
    ) private {
        if (tokenAddress == address(0)) {
            payable(receiver).transfer(amount);
        } else {
            IERC20(tokenAddress).safeTransfer(receiver, amount);
        }
    }

    function _safeApproveToInfinityIfNeeded(
        IERC20 token,
        address target,
        uint requiredAmount
    ) private {
        uint allowance = token.allowance(address(this), target);

        if (allowance < requiredAmount) {
            if (allowance == 0) {
                token.safeApprove(target, type(uint).max);
            } else {
                try token.approve(target, type(uint).max) returns (bool res) {
                    require(res, "Approve failed");
                } catch {
                    token.safeApprove(target, 0);
                    token.safeApprove(target, type(uint).max);
                }
            }
        }
    }

    function setPromoterFee(uint _promoterFee) external onlyOwner {
        _setPromoterFee(_promoterFee);
    }

    function _setPromoterFee(uint _promoterFee) private {
        require(_promoterFee <= FEE_DIVISOR, "Fee can not be greater than feeDivisor.");
        promoterFee = _promoterFee;
    }

    function setProviderBaseFee(uint _providerBaseFee) external onlyOwner {
        _setProviderBaseFee(_providerBaseFee);
    }

    function _setProviderBaseFee(uint _providerBaseFee) private {
        require(_providerBaseFee <= FEE_DIVISOR, "Fee can not be greater than feeDivisor.");
        require(
            _providerBaseFee - promoterFee >= providerDiscountFee,
            "Base fee minus promoter fee must be gte than discount fee."
        );
        providerBaseFee = _providerBaseFee;
    }

    function setProviderDiscountFee(uint _providerDiscountFee) external onlyOwner {
        _setProviderDiscountFee(_providerDiscountFee);
    }

    function _setProviderDiscountFee(uint _providerDiscountFee) private {
        require(_providerDiscountFee <= FEE_DIVISOR, "Fee can not be greater than feeDivisor.");
        require(
            _providerDiscountFee + promoterFee <= providerBaseFee,
            "Discount fee plus promoter fee must be lte than base fee."
        );
        providerDiscountFee = _providerDiscountFee;
    }

    function setProviderFeeTarget(address _providerFeeTarget) external onlyOwner {
        _setProviderFeeTarget(_providerFeeTarget);
    }

    function _setProviderFeeTarget(address _providerFeeTarget) private {
        require(
            _providerFeeTarget != providerFeeTarget,
            "New providerFeeTarget value should not be equal to previous."
        );
        providerFeeTarget = _providerFeeTarget;
    }

    function setAvailableFeeValues(uint[] memory _availableFeeValues) external onlyOwner {
        _setAvailableFeeValues(_availableFeeValues);
    }

    function _setAvailableFeeValues(uint[] memory _availableFeeValues) private {
        uint _availableFeeValuesLength = _availableFeeValues.length;
        for (uint i = 0; i < _availableFeeValuesLength; i++) {
            require(_availableFeeValues[i] <= FEE_DIVISOR, "Fee can not be greater than feeDivisor.");
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
        uint _dexesLength = _dexes.length;
        for (uint i = 0; i < _dexesLength; i++) {
            dexes[_dexes[i]] = true;
        }
    }

    function removeDex(address dex) external onlyOwner {
        dexes[dex] = false;
    }
}
