// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Prototype, non-upgradeable milestone escrow. NOT independently audited.
/// @dev One explicitly selected, non-rebasing, exact-transfer ERC20 per deployment.
/// Direct calls bind authorization to msg.sender and normal chain transaction replay protection.
contract AccrueEscrow {
    IERC20 public immutable token;
    uint256 public nextId;
    bool private entered;

    struct MilestoneInput {
        uint128 workerAmount;
        uint128 verifierFee;
        bool externalVerifier;
        bytes32 criteriaHash;
    }

    struct Milestone {
        uint128 workerAmount;
        uint128 verifierFee;
        bool externalVerifier;
        bytes32 criteriaHash;
        bytes32 evidenceHash;
        uint32 evidenceVersion;
        uint8 state;
    }

    struct Agreement {
        address payer;
        address worker;
        address verifier;
        uint64 expiry;
        bytes32 termsHash;
        uint8 acceptances;
        uint8 cancellationVotes;
        bool funded;
        bool cancelled;
        uint256 deposit;
        uint256 reserved;
        uint256 workerEarned;
        uint256 verifierEarned;
        uint256 workerWithdrawn;
        uint256 verifierWithdrawn;
        uint256 refunded;
        uint256 nextMilestone;
    }
    mapping(uint256 => Agreement) public agreements;
    mapping(uint256 => Milestone[]) private milestones;
    event AgreementCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed worker,
        address verifier,
        bytes32 termsHash,
        uint64 expiry
    );
    event Accepted(uint256 indexed id, address indexed participant);
    event Funded(uint256 indexed id, uint256 amount);
    event EvidenceSubmitted(uint256 indexed id, uint256 indexed milestone, uint32 version, bytes32 evidenceHash);
    event ChangesRequested(uint256 indexed id, uint256 indexed milestone, bytes32 feedbackHash);
    event Approved(
        uint256 indexed id,
        uint256 indexed milestone,
        address indexed approver,
        bytes32 evidenceHash,
        uint256 workerAmount,
        uint256 verifierFee
    );
    event Withdrawn(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event CancellationConsent(uint256 indexed id, address indexed participant, bool cancelled);
    event Refunded(uint256 indexed id, uint256 amount);
    event Correction(uint256 indexed id, uint256 indexed milestone, address indexed approver, bytes32 correctionHash);
    modifier lock() {
        require(!entered, "reentrancy");
        entered = true;
        _;
        entered = false;
    }

    constructor(address tokenAddress) {
        require(tokenAddress.code.length > 0, "invalid token");
        token = IERC20(tokenAddress);
    }

    function create(
        address worker,
        address verifier,
        uint64 expiry,
        bytes32 scopeHash,
        MilestoneInput[] calldata inputs
    ) external lock returns (uint256 id) {
        require(worker != address(0) && worker != msg.sender, "invalid worker");
        require(verifier == address(0) || (verifier != worker && verifier != msg.sender), "distinct verifier required");
        require(expiry > block.timestamp && scopeHash != bytes32(0), "invalid terms");
        require(inputs.length > 0 && inputs.length <= 12, "milestone count");
        id = nextId++;
        uint256 deposit;
        bool needsVerifier;
        for (uint256 i; i < inputs.length; i++) {
            MilestoneInput calldata m = inputs[i];
            require(m.workerAmount > 0 && m.criteriaHash != bytes32(0), "invalid milestone");
            require(m.externalVerifier ? verifier != address(0) : m.verifierFee == 0, "invalid fee or approver");
            if (m.externalVerifier) needsVerifier = true;
            deposit += uint256(m.workerAmount) + m.verifierFee;
            milestones[id].push(
                Milestone(m.workerAmount, m.verifierFee, m.externalVerifier, m.criteriaHash, bytes32(0), 0, 0)
            );
        }
        require(needsVerifier || verifier == address(0), "unused verifier");
        Agreement storage a = agreements[id];
        a.payer = msg.sender;
        a.worker = worker;
        a.verifier = verifier;
        a.expiry = expiry;
        a.deposit = deposit;
        a.acceptances = 1;
        a.termsHash =
            keccak256(
            abi.encode(block.chainid, address(this), id, msg.sender, worker, verifier, expiry, scopeHash, inputs)
        );
        emit AgreementCreated(id, msg.sender, worker, verifier, a.termsHash, expiry);
    }

    function accept(uint256 id, bytes32 termsHash) external lock {
        Agreement storage a = agreements[id];
        require(!a.funded && block.timestamp < a.expiry && termsHash == a.termsHash, "terms unavailable");
        uint8 bit = roleBit(a, msg.sender);
        require(a.acceptances & bit == 0, "already accepted");
        a.acceptances |= bit;
        emit Accepted(id, msg.sender);
    }

    function fund(uint256 id) external lock {
        Agreement storage a = agreements[id];
        require(msg.sender == a.payer && !a.funded && block.timestamp < a.expiry, "cannot fund");
        require(a.acceptances == requiredMask(a), "acceptances required");
        a.funded = true;
        a.reserved = a.deposit;
        uint256 beforeBalance = token.balanceOf(address(this));
        safeTransfer(abi.encodeCall(IERC20.transferFrom, (msg.sender, address(this), a.deposit)));
        require(token.balanceOf(address(this)) == beforeBalance + a.deposit, "unsupported token behavior");
        emit Funded(id, a.deposit);
    }

    function submitEvidence(uint256 id, uint256 index, bytes32 evidenceHash) external lock {
        Agreement storage a = agreements[id];
        requireActive(a);
        require(msg.sender == a.worker && index == a.nextMilestone, "worker or sequence");
        Milestone storage m = milestones[id][index];
        require(m.state == 0 && evidenceHash != bytes32(0), "invalid evidence state");
        m.evidenceHash = evidenceHash;
        m.evidenceVersion++;
        m.state = 1;
        emit EvidenceSubmitted(id, index, m.evidenceVersion, evidenceHash);
    }

    function requestChanges(uint256 id, uint256 index, bytes32 evidenceHash, bytes32 feedbackHash) external lock {
        Agreement storage a = agreements[id];
        requireActive(a);
        Milestone storage m = milestones[id][index];
        require(
            msg.sender == approver(a, m) && m.state == 1 && m.evidenceHash == evidenceHash
                && feedbackHash != bytes32(0),
            "invalid review"
        );
        m.state = 0;
        emit ChangesRequested(id, index, feedbackHash);
    }

    function approve(uint256 id, uint256 index, bytes32 evidenceHash) external lock {
        Agreement storage a = agreements[id];
        requireActive(a);
        Milestone storage m = milestones[id][index];
        require(
            msg.sender == approver(a, m) && index == a.nextMilestone && m.state == 1 && m.evidenceHash == evidenceHash,
            "invalid approval"
        );
        m.state = 2;
        a.nextMilestone++;
        a.reserved -= uint256(m.workerAmount) + m.verifierFee;
        a.workerEarned += m.workerAmount;
        a.verifierEarned += m.verifierFee;
        emit Approved(id, index, msg.sender, evidenceHash, m.workerAmount, m.verifierFee);
    }

    function withdraw(uint256 id) external lock {
        Agreement storage a = agreements[id];
        uint256 amount;
        if (msg.sender == a.worker) {
            amount = a.workerEarned - a.workerWithdrawn;
            a.workerWithdrawn = a.workerEarned;
        } else {
            require(msg.sender == a.verifier, "not beneficiary");
            amount = a.verifierEarned - a.verifierWithdrawn;
            a.verifierWithdrawn = a.verifierEarned;
        }
        require(amount > 0, "nothing earned");
        safeTransfer(abi.encodeCall(IERC20.transfer, (msg.sender, amount)));
        emit Withdrawn(id, msg.sender, amount);
    }

    function consentCancellation(uint256 id) external lock {
        Agreement storage a = agreements[id];
        requireActive(a);
        uint8 bit = roleBit(a, msg.sender);
        require(a.cancellationVotes & bit == 0, "already consented");
        a.cancellationVotes |= bit;
        if (a.cancellationVotes == requiredMask(a)) a.cancelled = true;
        emit CancellationConsent(id, msg.sender, a.cancelled);
    }

    function refund(uint256 id) external lock {
        Agreement storage a = agreements[id];
        require(msg.sender == a.payer && a.funded && (a.cancelled || block.timestamp >= a.expiry), "not refundable");
        uint256 amount = a.reserved;
        require(amount > 0, "nothing reserved");
        a.reserved = 0;
        a.refunded += amount;
        safeTransfer(abi.encodeCall(IERC20.transfer, (a.payer, amount)));
        emit Refunded(id, amount);
    }

    function correct(uint256 id, uint256 index, bytes32 correctionHash) external lock {
        Agreement storage a = agreements[id];
        Milestone storage m = milestones[id][index];
        require(m.state == 2 && msg.sender == approver(a, m) && correctionHash != bytes32(0), "invalid correction");
        emit Correction(id, index, msg.sender, correctionHash);
    }

    function getMilestones(uint256 id) external view returns (Milestone[] memory) {
        return milestones[id];
    }

    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return agreements[id];
    }

    function requireActive(Agreement storage a) private view {
        require(a.funded && !a.cancelled && block.timestamp < a.expiry, "not active");
    }

    function roleBit(Agreement storage a, address actor) private view returns (uint8) {
        if (actor == a.payer) return 1;
        if (actor == a.worker) return 2;
        require(actor == a.verifier && actor != address(0), "not participant");
        return 4;
    }

    function requiredMask(Agreement storage a) private view returns (uint8) {
        return a.verifier == address(0) ? 3 : 7;
    }

    function approver(Agreement storage a, Milestone storage m) private view returns (address) {
        return m.externalVerifier ? a.verifier : a.payer;
    }

    function safeTransfer(bytes memory callData) private {
        (bool success, bytes memory result) = address(token).call(callData);
        require(success && (result.length == 0 || abi.decode(result, (bool))), "token transfer failed");
    }
}
