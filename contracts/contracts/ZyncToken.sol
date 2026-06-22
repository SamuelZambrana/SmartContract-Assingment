// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZyncToken — ZYNC utility token for AureLexa (Zync)
/// @notice Public mint: send ETH at `mintPriceWei` per 1 full token (18 decimals).
///         Owner can treasury-mint, set price, and withdraw sale proceeds.
///         Holders can burn their own tokens (`burn`) or burn an approved
///         allowance from another account (`burnFrom`) via OpenZeppelin's
///         ERC20Burnable extension.
contract ZyncToken is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    /// Price in wei for 1e18 wei of tokens (one full ZYNC with 18 decimals).
    uint256 public mintPriceWei;

    /// @notice Emitted whenever tokens are burned via `burn` or `burnFrom`.
    /// @param from   the account whose balance was reduced
    /// @param amount the number of tokens burned (18 decimals)
    event Burned(address indexed from, uint256 amount);

    error CapExceeded();
    error ZeroAmount();

    constructor(uint256 initialMintPriceWei) ERC20("Zync", "ZYNC") Ownable(msg.sender) {
        mintPriceWei = initialMintPriceWei;
    }

    function setMintPrice(uint256 newPriceWei) external onlyOwner {
        mintPriceWei = newPriceWei;
    }

    /// @notice Treasury / airdrops — does not require ETH; capped by MAX_SUPPLY.
    function mintTo(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert CapExceeded();
        _mint(to, amount);
    }

    /// @notice Buy ZYNC with native currency on the same chain.
    function mintWithEth() external payable nonReentrant {
        if (mintPriceWei == 0) revert ZeroAmount();
        if (msg.value == 0) revert ZeroAmount();

        uint256 tokenAmount = (msg.value * 10 ** 18) / mintPriceWei;
        if (tokenAmount == 0) revert ZeroAmount();
        if (totalSupply() + tokenAmount > MAX_SUPPLY) revert CapExceeded();

        uint256 costWei = (tokenAmount * mintPriceWei) / 10 ** 18;
        _mint(msg.sender, tokenAmount);

        uint256 refund = msg.value - costWei;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    /// @notice Burn `amount` of the caller's own tokens.
    /// @dev Delegates to OpenZeppelin's ERC20Burnable (which reverts on
    ///      insufficient balance) and emits {Burned}.
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit Burned(_msgSender(), amount);
    }

    /// @notice Burn `amount` from `account`, spending the caller's allowance.
    /// @dev Delegates to OpenZeppelin's ERC20Burnable (which spends the
    ///      allowance and reverts on insufficient allowance/balance) and emits
    ///      {Burned} for the account whose balance was reduced.
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit Burned(account, amount);
    }

    function withdraw() external onlyOwner nonReentrant {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    receive() external payable {
        revert("use mintWithEth");
    }
}
