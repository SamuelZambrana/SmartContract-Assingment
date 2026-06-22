const { expect } = require("chai");
const hre = require("hardhat");

const PRICE = () => hre.ethers.parseEther("0.001");

// Deploy the token and seed `holder` with a treasury-minted balance.
async function deployWithBalance() {
  const [owner, holder, spender] = await hre.ethers.getSigners();
  const Z = await hre.ethers.getContractFactory("ZyncToken");
  const token = await Z.deploy(PRICE());
  await token.waitForDeployment();

  const amount = hre.ethers.parseEther("100");
  await (await token.mintTo(holder.address, amount)).wait();

  return { token, owner, holder, spender, amount };
}

describe("ZyncToken — burn / burnFrom", function () {
  it("burns the caller's own tokens, reduces supply and emits Burned", async function () {
    const { token, holder } = await deployWithBalance();
    const burnAmt = hre.ethers.parseEther("30");

    const balBefore = await token.balanceOf(holder.address);
    const supplyBefore = await token.totalSupply();

    await expect(token.connect(holder).burn(burnAmt))
      .to.emit(token, "Burned")
      .withArgs(holder.address, burnAmt);

    expect(await token.balanceOf(holder.address)).to.equal(balBefore - burnAmt);
    expect(await token.totalSupply()).to.equal(supplyBefore - burnAmt);
  });

  it("reverts when burning more than the balance", async function () {
    const { token, holder, amount } = await deployWithBalance();

    await expect(token.connect(holder).burn(amount + 1n))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("burnFrom spends the allowance, reduces supply and emits Burned for the account", async function () {
    const { token, holder, spender } = await deployWithBalance();
    const burnAmt = hre.ethers.parseEther("40");

    await (await token.connect(holder).approve(spender.address, burnAmt)).wait();

    const balBefore = await token.balanceOf(holder.address);
    const supplyBefore = await token.totalSupply();

    await expect(token.connect(spender).burnFrom(holder.address, burnAmt))
      .to.emit(token, "Burned")
      .withArgs(holder.address, burnAmt);

    expect(await token.balanceOf(holder.address)).to.equal(balBefore - burnAmt);
    expect(await token.totalSupply()).to.equal(supplyBefore - burnAmt);
    expect(await token.allowance(holder.address, spender.address)).to.equal(0n);
  });

  it("burnFrom reverts without sufficient allowance", async function () {
    const { token, holder, spender } = await deployWithBalance();
    const burnAmt = hre.ethers.parseEther("10");

    // No approval granted to spender.
    await expect(token.connect(spender).burnFrom(holder.address, burnAmt))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });
});
