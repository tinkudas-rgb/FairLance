// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FairLance
 * @notice Milestone escrow with a staked 3-juror dispute layer.
 * @dev Hackathon MVP. Native test ETH only; randomness is demo-grade and not production safe.
 */
contract FairLance {
    uint256 public constant MIN_JUROR_STAKE = 0.01 ether;
    uint256 public constant JUROR_FEE_BPS = 100; // 1% of disputed milestone
    uint256 public constant SLASH_BPS = 1000; // 10% of a losing juror's stake
    uint256 public constant BPS = 10_000;

    enum MilestoneState { Funded, Submitted, Approved, Disputed, Resolved, Refunded }

    struct Project {
        address client;
        address freelancer;
        string metadataURI;
        uint256 milestoneCount;
        bool exists;
    }

    struct Milestone {
        uint256 amount;
        MilestoneState state;
        bytes32 workHash;
        string workURI;
        uint256 disputeId;
    }

    struct Juror {
        uint256 stake;
        bool active;
    }

    struct Dispute {
        uint256 projectId;
        uint256 milestoneId;
        address opener;
        string evidenceURI;
        address[3] jurors;
        uint8 clientVotes;
        uint8 freelancerVotes;
        uint8 voteCount;
        bool resolved;
        mapping(address => bool) hasVoted;
        mapping(address => bool) votedForFreelancer;
    }

    uint256 public nextProjectId = 1;
    uint256 public nextDisputeId = 1;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => Juror) public jurors;
    mapping(address => uint256) public activeAssignments;
    address[] public jurorPool;
    mapping(address => bool) private inJurorPool;
    mapping(uint256 => Dispute) private disputes;

    bool private locked;
    modifier nonReentrant() {
        require(!locked, "Reentrancy");
        locked = true;
        _;
        locked = false;
    }
    modifier onlyClient(uint256 projectId) {
        require(msg.sender == projects[projectId].client, "Not client");
        _;
    }
    modifier onlyFreelancer(uint256 projectId) {
        require(msg.sender == projects[projectId].freelancer, "Not freelancer");
        _;
    }

    event ProjectCreated(uint256 indexed projectId, address indexed client, address indexed freelancer, string metadataURI);
    event MilestoneFunded(uint256 indexed projectId, uint256 indexed milestoneId, uint256 amount);
    event WorkSubmitted(uint256 indexed projectId, uint256 indexed milestoneId, bytes32 workHash, string workURI);
    event MilestoneApproved(uint256 indexed projectId, uint256 indexed milestoneId, uint256 payout);
    event DisputeOpened(uint256 indexed disputeId, uint256 indexed projectId, uint256 indexed milestoneId, address[3] jurors, string evidenceURI);
    event VoteCast(uint256 indexed disputeId, address indexed juror, bool forFreelancer);
    event DisputeResolved(uint256 indexed disputeId, bool freelancerWon, uint256 recipientPayout, uint256 jurorRewards);
    event JurorStaked(address indexed juror, uint256 totalStake);
    event JurorUnstaked(address indexed juror, uint256 amount);

    function createProject(address freelancer, string calldata metadataURI, uint256[] calldata amounts)
        external payable returns (uint256 projectId)
    {
        require(freelancer != address(0) && freelancer != msg.sender, "Bad freelancer");
        require(amounts.length > 0 && amounts.length <= 20, "Bad milestone count");
        uint256 total;
        for (uint256 i; i < amounts.length; ++i) {
            require(amounts[i] > 0, "Zero milestone");
            total += amounts[i];
        }
        require(msg.value == total, "Funding mismatch");
        projectId = nextProjectId++;
        projects[projectId] = Project(msg.sender, freelancer, metadataURI, amounts.length, true);
        emit ProjectCreated(projectId, msg.sender, freelancer, metadataURI);
        for (uint256 i; i < amounts.length; ++i) {
            milestones[projectId][i] = Milestone(amounts[i], MilestoneState.Funded, bytes32(0), "", 0);
            emit MilestoneFunded(projectId, i, amounts[i]);
        }
    }

    function submitWork(uint256 projectId, uint256 milestoneId, bytes32 workHash, string calldata workURI)
        external onlyFreelancer(projectId)
    {
        Milestone storage m = _milestone(projectId, milestoneId);
        require(m.state == MilestoneState.Funded, "Not funded");
        require(workHash != bytes32(0), "Empty hash");
        m.workHash = workHash;
        m.workURI = workURI;
        m.state = MilestoneState.Submitted;
        emit WorkSubmitted(projectId, milestoneId, workHash, workURI);
    }

    function approveMilestone(uint256 projectId, uint256 milestoneId)
        external onlyClient(projectId) nonReentrant
    {
        Milestone storage m = _milestone(projectId, milestoneId);
        require(m.state == MilestoneState.Submitted, "Not submitted");
        m.state = MilestoneState.Approved;
        uint256 payout = m.amount;
        _send(projects[projectId].freelancer, payout);
        emit MilestoneApproved(projectId, milestoneId, payout);
    }

    function stakeAsJuror() external payable {
        require(msg.value > 0, "No stake");
        Juror storage j = jurors[msg.sender];
        j.stake += msg.value;
        if (!j.active && j.stake >= MIN_JUROR_STAKE) {
            j.active = true;
            if (!inJurorPool[msg.sender]) {
                inJurorPool[msg.sender] = true;
                jurorPool.push(msg.sender);
            }
        }
        emit JurorStaked(msg.sender, j.stake);
    }

    function unstake(uint256 amount) external nonReentrant {
        Juror storage j = jurors[msg.sender];
        require(activeAssignments[msg.sender] == 0, "Active dispute");
        require(amount > 0 && amount <= j.stake, "Bad amount");
        j.stake -= amount;
        if (j.stake < MIN_JUROR_STAKE) j.active = false;
        _send(msg.sender, amount);
        emit JurorUnstaked(msg.sender, amount);
    }

    function openDispute(uint256 projectId, uint256 milestoneId, string calldata evidenceURI)
        external returns (uint256 disputeId)
    {
        Project storage p = projects[projectId];
        require(msg.sender == p.client || msg.sender == p.freelancer, "Not party");
        Milestone storage m = _milestone(projectId, milestoneId);
        require(m.state == MilestoneState.Submitted, "Not disputable");
        address[3] memory selected = _selectJurors(projectId, milestoneId);
        disputeId = nextDisputeId++;
        Dispute storage d = disputes[disputeId];
        d.projectId = projectId;
        d.milestoneId = milestoneId;
        d.opener = msg.sender;
        d.evidenceURI = evidenceURI;
        d.jurors = selected;
        m.state = MilestoneState.Disputed;
        m.disputeId = disputeId;
        for (uint256 i; i < 3; ++i) activeAssignments[selected[i]]++;
        emit DisputeOpened(disputeId, projectId, milestoneId, selected, evidenceURI);
    }

    function castVote(uint256 disputeId, bool forFreelancer) external {
        Dispute storage d = disputes[disputeId];
        require(!d.resolved && d.projectId != 0, "Inactive dispute");
        require(_isSelected(d.jurors, msg.sender), "Not selected");
        require(!d.hasVoted[msg.sender], "Already voted");
        d.hasVoted[msg.sender] = true;
        d.votedForFreelancer[msg.sender] = forFreelancer;
        d.voteCount++;
        if (forFreelancer) d.freelancerVotes++; else d.clientVotes++;
        emit VoteCast(disputeId, msg.sender, forFreelancer);
        if (d.voteCount == 3) _resolve(disputeId);
    }

    function getDispute(uint256 disputeId) external view returns (
        uint256 projectId, uint256 milestoneId, address opener, string memory evidenceURI,
        address[3] memory selectedJurors, uint8 clientVotes, uint8 freelancerVotes, uint8 voteCount, bool resolved
    ) {
        Dispute storage d = disputes[disputeId];
        return (d.projectId, d.milestoneId, d.opener, d.evidenceURI, d.jurors, d.clientVotes, d.freelancerVotes, d.voteCount, d.resolved);
    }

    function hasVoted(uint256 disputeId, address juror) external view returns (bool, bool) {
        Dispute storage d = disputes[disputeId];
        return (d.hasVoted[juror], d.votedForFreelancer[juror]);
    }

    function jurorPoolLength() external view returns (uint256) { return jurorPool.length; }

    function _resolve(uint256 disputeId) internal nonReentrant {
        Dispute storage d = disputes[disputeId];
        d.resolved = true;
        bool freelancerWon = d.freelancerVotes > d.clientVotes;
        Project storage p = projects[d.projectId];
        Milestone storage m = milestones[d.projectId][d.milestoneId];
        m.state = MilestoneState.Resolved;

        uint256 maxFee = (m.amount * JUROR_FEE_BPS) / BPS;
        uint256 totalSlashed;
        uint256 winners;
        for (uint256 i; i < 3; ++i) {
            address juror = d.jurors[i];
            activeAssignments[juror]--;
            bool winner = d.votedForFreelancer[juror] == freelancerWon;
            if (winner) winners++;
            else {
                uint256 slash = (jurors[juror].stake * SLASH_BPS) / BPS;
                if (slash > jurors[juror].stake) slash = jurors[juror].stake;
                jurors[juror].stake -= slash;
                if (jurors[juror].stake < MIN_JUROR_STAKE) jurors[juror].active = false;
                totalSlashed += slash;
            }
        }
        uint256 fee = maxFee < m.amount ? maxFee : 0;
        uint256 jurorRewards = fee + totalSlashed;
        uint256 eachReward = winners == 0 ? 0 : jurorRewards / winners;
        if (eachReward > 0) {
            for (uint256 i; i < 3; ++i) {
                address juror = d.jurors[i];
                if (d.votedForFreelancer[juror] == freelancerWon) {
                    jurors[juror].stake += eachReward;
                    if (jurors[juror].stake >= MIN_JUROR_STAKE) jurors[juror].active = true;
                }
            }
        }
        uint256 distributed = eachReward * winners;
        uint256 payout = m.amount - fee + (jurorRewards - distributed);
        _send(freelancerWon ? p.freelancer : p.client, payout);
        emit DisputeResolved(disputeId, freelancerWon, payout, distributed);
    }

    function _selectJurors(uint256 projectId, uint256 milestoneId) internal view returns (address[3] memory out) {
        uint256 eligible;
        for (uint256 i; i < jurorPool.length; ++i) {
            address a = jurorPool[i];
            if (jurors[a].active && a != projects[projectId].client && a != projects[projectId].freelancer) eligible++;
        }
        require(eligible >= 3, "Need 3 eligible jurors");
        uint256 seed = uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, projectId, milestoneId, msg.sender)));
        uint256 found;
        for (uint256 offset; found < 3 && offset < jurorPool.length * 4; ++offset) {
            address candidate = jurorPool[(seed + offset * 7919) % jurorPool.length];
            if (!jurors[candidate].active || candidate == projects[projectId].client || candidate == projects[projectId].freelancer) continue;
            bool duplicate;
            for (uint256 j; j < found; ++j) if (out[j] == candidate) duplicate = true;
            if (!duplicate) out[found++] = candidate;
        }
        require(found == 3, "Selection failed");
    }

    function _milestone(uint256 projectId, uint256 milestoneId) internal view returns (Milestone storage m) {
        Project storage p = projects[projectId];
        require(p.exists && milestoneId < p.milestoneCount, "Bad milestone");
        m = milestones[projectId][milestoneId];
    }
    function _isSelected(address[3] storage selected, address who) internal view returns (bool) {
        return selected[0] == who || selected[1] == who || selected[2] == who;
    }
    function _send(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
