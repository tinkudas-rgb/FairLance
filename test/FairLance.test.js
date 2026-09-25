const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FairLance", function () {
  let fair, client, freelancer, j1, j2, j3, outsider;
  const one = ethers.parseEther("1");
  beforeEach(async () => {
    [client, freelancer, j1, j2, j3, outsider] = await ethers.getSigners();
    fair = await ethers.deployContract("FairLance");
    await fair.waitForDeployment();
  });
  async function createAndSubmit() {
    await fair.connect(client).createProject(freelancer.address, "ipfs://job", [one], { value: one });
    const hash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-v1"));
    await fair.connect(freelancer).submitWork(1, 0, hash, "ipfs://work");
  }
  it("funds, submits and releases a milestone", async () => {
    await createAndSubmit();
    await expect(() => fair.connect(client).approveMilestone(1, 0)).to.changeEtherBalance(freelancer, one);
    const m = await fair.milestones(1, 0);
    expect(m.state).to.equal(2);
  });
  it("rejects invalid roles and funding", async () => {
    await expect(fair.connect(client).createProject(freelancer.address, "x", [one], {value: 1})).to.be.revertedWith("Funding mismatch");
    await fair.connect(client).createProject(freelancer.address, "x", [one], {value: one});
    await expect(fair.connect(outsider).submitWork(1, 0, ethers.ZeroHash, "x")).to.be.revertedWith("Not freelancer");
  });
  it("selects jurors, resolves majority freelancer vote, rewards honest jurors and slashes loser", async () => {
    const stake = ethers.parseEther("0.1");
    for (const j of [j1,j2,j3]) await fair.connect(j).stakeAsJuror({value: stake});
    await createAndSubmit();
    await fair.connect(client).openDispute(1, 0, "ipfs://evidence");
    const d = await fair.getDispute(1);
    const byAddress = new Map([[j1.address,j1],[j2.address,j2],[j3.address,j3]]);
    await fair.connect(byAddress.get(d.selectedJurors[0])).castVote(1, true);
    await fair.connect(byAddress.get(d.selectedJurors[1])).castVote(1, true);
    await fair.connect(byAddress.get(d.selectedJurors[2])).castVote(1, false);
    const after = await fair.getDispute(1);
    expect(after.resolved).to.equal(true);
    expect((await fair.milestones(1,0)).state).to.equal(4);
    expect((await fair.jurors(d.selectedJurors[0])).stake).to.be.greaterThan(stake);
  });
  it("returns disputed funds to client when client wins", async () => {
    for (const j of [j1,j2,j3]) await fair.connect(j).stakeAsJuror({value: ethers.parseEther("0.1")});
    await createAndSubmit();
    await fair.connect(freelancer).openDispute(1,0,"ipfs://e");
    const d = await fair.getDispute(1);
    const byAddress = new Map([[j1.address,j1],[j2.address,j2],[j3.address,j3]]);
    const before = await ethers.provider.getBalance(client.address);
    await fair.connect(byAddress.get(d.selectedJurors[0])).castVote(1,false);
    await fair.connect(byAddress.get(d.selectedJurors[1])).castVote(1,false);
    await fair.connect(byAddress.get(d.selectedJurors[2])).castVote(1,true);
    const after = await ethers.provider.getBalance(client.address);
    expect(after).to.be.greaterThan(before);
  });
  it("allows jurors to unstake", async () => {
    const stake = ethers.parseEther("0.1");
    await fair.connect(j1).stakeAsJuror({value: stake});
    await fair.connect(j1).unstake(stake);
    expect((await fair.jurors(j1.address)).stake).to.equal(0);
  });
  it("does not add a re-staking juror to the pool twice", async () => {
    const stake = ethers.parseEther("0.1");
    await fair.connect(j1).stakeAsJuror({value: stake});
    await fair.connect(j1).unstake(stake);
    await fair.connect(j1).stakeAsJuror({value: stake});
    expect(await fair.jurorPoolLength()).to.equal(1);
    await fair.connect(j2).stakeAsJuror({value: stake});
    await createAndSubmit();
    await expect(fair.connect(client).openDispute(1, 0, "ipfs://e")).to.be.revertedWith("Need 3 eligible jurors");
  });
});
