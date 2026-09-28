// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IDigitalWorkToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice One deliverable, three independent verifiers, and conditional AUSD settlement.
/// @dev Prototype for testnet use. The token must transfer exact amounts without rebasing.
contract AccrueDigitalWork {
    enum Status { Draft, Funded, Submitted, NeedsChanges, Paid, Refunded }

    struct Job {
        address payer;
        address worker;
        address[3] verifiers;
        uint128 reward;
        uint128 feePool;
        uint128 remainingFees;
        uint64 deliveryDeadline;
        uint64 reviewDeadline;
        bytes32 policyHash;
        bytes32 evidenceHash;
        uint32 version;
        uint8 passVotes;
        uint8 failVotes;
        bool workerAccepted;
        Status status;
    }

    struct Vote {
        uint32 version;
        bool pass;
        bytes32 reportHash;
    }

    IDigitalWorkToken public immutable token;
    uint256 public nextId;
    bool private entered;

    mapping(uint256 => Job) private jobs;
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(uint256 => mapping(address => bool)) public feeEarned;
    mapping(address => uint256) public claimable;

    event JobCreated(uint256 indexed id, address indexed payer, address indexed worker, bytes32 policyHash);
    event WorkerAccepted(uint256 indexed id);
    event Funded(uint256 indexed id, uint256 amount);
    event EvidenceSubmitted(uint256 indexed id, uint32 indexed version, bytes32 evidenceHash);
    event VerificationVoted(uint256 indexed id, uint32 indexed version, address indexed verifier, bool pass, bytes32 reportHash);
    event ChangesRequested(uint256 indexed id, uint32 indexed version);
    event Settled(uint256 indexed id, bytes32 evidenceHash, uint256 workerAmount);
    event Refunded(uint256 indexed id, uint256 payerAmount);
    event Withdrawn(address indexed beneficiary, uint256 amount);

    modifier lock() {
        require(!entered, "reentrancy");
        entered = true;
        _;
        entered = false;
    }

    constructor(address tokenAddress) {
        require(tokenAddress.code.length > 0, "invalid token");
        token = IDigitalWorkToken(tokenAddress);
    }

    function create(
        address worker,
        address[3] calldata verifiers,
        uint128 reward,
        uint128 feePool,
        uint64 deliveryDeadline,
        uint64 reviewDeadline,
        bytes32 policyHash
    ) external returns (uint256 id) {
        require(worker != address(0) && worker != msg.sender, "invalid worker");
        require(reward > 0 && feePool >= 3, "invalid amounts");
        require(deliveryDeadline > block.timestamp && reviewDeadline > deliveryDeadline, "invalid deadlines");
        require(policyHash != bytes32(0), "invalid policy");
        for (uint256 i; i < 3; ++i) {
            address verifier = verifiers[i];
            require(verifier != address(0) && verifier != worker && verifier != msg.sender, "invalid verifier");
            for (uint256 j; j < i; ++j) require(verifier != verifiers[j], "duplicate verifier");
        }

        id = nextId++;
        Job storage job = jobs[id];
        job.payer = msg.sender;
        job.worker = worker;
        job.verifiers = verifiers;
        job.reward = reward;
        job.feePool = feePool;
        job.remainingFees = feePool;
        job.deliveryDeadline = deliveryDeadline;
        job.reviewDeadline = reviewDeadline;
        job.policyHash = policyHash;
        emit JobCreated(id, msg.sender, worker, policyHash);
    }

    function accept(uint256 id, bytes32 policyHash) external {
        Job storage job = jobs[id];
        require(msg.sender == job.worker && job.status == Status.Draft, "cannot accept");
        require(block.timestamp < job.deliveryDeadline && policyHash == job.policyHash, "policy unavailable");
        require(!job.workerAccepted, "already accepted");
        job.workerAccepted = true;
        emit WorkerAccepted(id);
    }

    function fund(uint256 id) external lock {
        Job storage job = jobs[id];
        require(msg.sender == job.payer && job.status == Status.Draft, "cannot fund");
        require(job.workerAccepted && block.timestamp < job.deliveryDeadline, "acceptance required");
        job.status = Status.Funded;
        uint256 amount = uint256(job.reward) + job.feePool;
        uint256 beforeBalance = token.balanceOf(address(this));
        _safeTransfer(abi.encodeCall(IDigitalWorkToken.transferFrom, (msg.sender, address(this), amount)));
        require(token.balanceOf(address(this)) == beforeBalance + amount, "unsupported token");
        emit Funded(id, amount);
    }

    function submit(uint256 id, bytes32 evidenceHash) external {
        Job storage job = jobs[id];
        require(msg.sender == job.worker && block.timestamp <= job.deliveryDeadline, "delivery closed");
        require(job.status == Status.Funded || job.status == Status.NeedsChanges, "cannot submit");
        require(evidenceHash != bytes32(0), "invalid evidence");
        job.version++;
        job.evidenceHash = evidenceHash;
        job.passVotes = 0;
        job.failVotes = 0;
        job.status = Status.Submitted;
        emit EvidenceSubmitted(id, job.version, evidenceHash);
    }

    function vote(uint256 id, bytes32 evidenceHash, bool pass, bytes32 reportHash) external {
        Job storage job = jobs[id];
        require(job.status == Status.Submitted && block.timestamp <= job.reviewDeadline, "review closed");
        require(evidenceHash == job.evidenceHash && reportHash != bytes32(0), "evidence mismatch");
        require(_isVerifier(job, msg.sender), "not verifier");
        require(votes[id][msg.sender].version != job.version, "already voted");

        votes[id][msg.sender] = Vote(job.version, pass, reportHash);
        if (!feeEarned[id][msg.sender]) {
            uint256 fee = uint256(job.feePool) / 3;
            feeEarned[id][msg.sender] = true;
            job.remainingFees -= uint128(fee);
            claimable[msg.sender] += fee;
        }
        emit VerificationVoted(id, job.version, msg.sender, pass, reportHash);

        if (pass) job.passVotes++;
        else job.failVotes++;

        if (job.passVotes == 2) {
            job.status = Status.Paid;
            claimable[job.worker] += job.reward;
            claimable[job.payer] += job.remainingFees;
            job.remainingFees = 0;
            emit Settled(id, evidenceHash, job.reward);
        } else if (job.failVotes == 2) {
            job.status = Status.NeedsChanges;
            emit ChangesRequested(id, job.version);
        }
    }

    function expire(uint256 id) external {
        Job storage job = jobs[id];
        require(block.timestamp > job.reviewDeadline, "review still open");
        require(
            job.status == Status.Funded || job.status == Status.Submitted || job.status == Status.NeedsChanges,
            "not refundable"
        );
        job.status = Status.Refunded;
        uint256 amount = uint256(job.reward) + job.remainingFees;
        job.remainingFees = 0;
        claimable[job.payer] += amount;
        emit Refunded(id, amount);
    }

    function withdraw() external lock {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, "nothing earned");
        claimable[msg.sender] = 0;
        _safeTransfer(abi.encodeCall(IDigitalWorkToken.transfer, (msg.sender, amount)));
        emit Withdrawn(msg.sender, amount);
    }

    function getJob(uint256 id) external view returns (Job memory) {
        return jobs[id];
    }

    function _isVerifier(Job storage job, address actor) private view returns (bool) {
        for (uint256 i; i < 3; ++i) if (job.verifiers[i] == actor) return true;
        return false;
    }

    function _safeTransfer(bytes memory callData) private {
        (bool ok, bytes memory result) = address(token).call(callData);
        require(ok && (result.length == 0 || abi.decode(result, (bool))), "token transfer failed");
    }
}
