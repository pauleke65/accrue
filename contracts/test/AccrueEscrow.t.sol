// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "../src/AccrueEscrow.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
}

contract TestToken is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public fail;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function approve(address to, uint256 amount) external returns (bool) {
        allowance[msg.sender][to] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (fail) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract AccrueTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    AccrueEscrow escrow;
    TestToken token;
    address worker = address(0xB);
    address verifier = address(0xC);
    address stranger = address(0xD);
    uint256 id;
    bytes32 evidence = keccak256("evidence");

    function setUp() public {
        token = new TestToken();
        escrow = new AccrueEscrow(address(token));
        token.mint(address(this), 1e30);
        token.approve(address(escrow), type(uint256).max);
        id = create(10000, 300);
    }

    function create(uint128 amount, uint128 fee) internal returns (uint256) {
        AccrueEscrow.MilestoneInput[] memory inputs = new AccrueEscrow.MilestoneInput[](2);
        inputs[0] = AccrueEscrow.MilestoneInput(amount, fee, true, keccak256("criteria1"));
        inputs[1] = AccrueEscrow.MilestoneInput(amount, fee, true, keccak256("criteria2"));
        return escrow.create(worker, verifier, uint64(block.timestamp + 30 days), keccak256("scope"), inputs);
    }

    function fund() internal {
        bytes32 terms = escrow.getAgreement(id).termsHash;
        vm.prank(worker);
        escrow.accept(id, terms);
        vm.prank(verifier);
        escrow.accept(id, terms);
        escrow.fund(id);
    }

    function approveOne() internal {
        vm.prank(worker);
        escrow.submitEvidence(id, 0, evidence);
        vm.prank(verifier);
        escrow.approve(id, 0, evidence);
    }

    function invariantCheck() internal view {
        AccrueEscrow.Agreement memory a = escrow.getAgreement(id);
        require(a.deposit == a.reserved + a.workerEarned + a.verifierEarned + a.refunded, "conservation");
        require(a.workerWithdrawn <= a.workerEarned && a.verifierWithdrawn <= a.verifierEarned, "overdrawn");
    }

    function testAcceptancesRequired() public {
        vm.expectRevert();
        escrow.fund(id);
    }

    function testWrongTerms() public {
        vm.prank(worker);
        vm.expectRevert();
        escrow.accept(id, keccak256("wrong"));
    }

    function testOnlyParticipants() public {
        bytes32 terms = escrow.getAgreement(id).termsHash;
        vm.prank(stranger);
        vm.expectRevert();
        escrow.accept(id, terms);
    }

    function testAtomicEarnings() public {
        fund();
        approveOne();
        AccrueEscrow.Agreement memory a = escrow.getAgreement(id);
        require(a.workerEarned == 10000 && a.verifierEarned == 300, "allocation");
        invariantCheck();
    }

    function testDoubleApproval() public {
        fund();
        approveOne();
        vm.prank(verifier);
        vm.expectRevert();
        escrow.approve(id, 0, evidence);
    }

    function testWrongApprover() public {
        fund();
        vm.prank(worker);
        escrow.submitEvidence(id, 0, evidence);
        vm.prank(worker);
        vm.expectRevert();
        escrow.approve(id, 0, evidence);
    }

    function testWrongEvidence() public {
        fund();
        vm.prank(worker);
        escrow.submitEvidence(id, 0, evidence);
        vm.prank(verifier);
        vm.expectRevert();
        escrow.approve(id, 0, keccak256("stale"));
    }

    function testEvidenceResubmission() public {
        fund();
        vm.prank(worker);
        escrow.submitEvidence(id, 0, evidence);
        vm.prank(verifier);
        escrow.requestChanges(id, 0, evidence, keccak256("feedback"));
        vm.prank(worker);
        escrow.submitEvidence(id, 0, keccak256("v2"));
        vm.prank(verifier);
        vm.expectRevert();
        escrow.approve(id, 0, evidence);
        require(escrow.getMilestones(id)[0].evidenceVersion == 2, "version");
    }

    function testWithdrawalReplay() public {
        fund();
        approveOne();
        vm.prank(worker);
        escrow.withdraw(id);
        require(token.balanceOf(worker) == 10000, "paid");
        vm.prank(worker);
        vm.expectRevert();
        escrow.withdraw(id);
        invariantCheck();
    }

    function testTransferFailureRollsBack() public {
        fund();
        approveOne();
        token.setFail(true);
        vm.prank(worker);
        vm.expectRevert();
        escrow.withdraw(id);
        require(escrow.getAgreement(id).workerWithdrawn == 0, "lost earnings");
        token.setFail(false);
        vm.prank(worker);
        escrow.withdraw(id);
    }

    function testExpiryNeverRefundsEarned() public {
        fund();
        approveOne();
        vm.warp(escrow.getAgreement(id).expiry);
        escrow.refund(id);
        require(escrow.getAgreement(id).refunded == 10300, "refund");
        vm.prank(worker);
        escrow.withdraw(id);
        vm.prank(verifier);
        escrow.withdraw(id);
        require(token.balanceOf(address(escrow)) == 0, "remaining");
        invariantCheck();
    }

    function testExactExpiryRejectsApproval() public {
        fund();
        vm.prank(worker);
        escrow.submitEvidence(id, 0, evidence);
        vm.warp(escrow.getAgreement(id).expiry);
        vm.prank(verifier);
        vm.expectRevert();
        escrow.approve(id, 0, evidence);
    }

    function testCancellationRequiresAll() public {
        fund();
        approveOne();
        escrow.consentCancellation(id);
        vm.expectRevert();
        escrow.refund(id);
        vm.prank(worker);
        escrow.consentCancellation(id);
        vm.prank(verifier);
        escrow.consentCancellation(id);
        escrow.refund(id);
        invariantCheck();
    }

    function testCorrectionDoesNotClawBack() public {
        fund();
        approveOne();
        vm.prank(verifier);
        escrow.correct(id, 0, keccak256("correction"));
        require(escrow.getAgreement(id).workerEarned == 10000, "clawback");
    }

    function testCannotSpendOtherAgreement() public {
        fund();
        approveOne();
        uint256 other = create(500, 0);
        vm.prank(worker);
        vm.expectRevert();
        escrow.withdraw(other);
        require(escrow.getAgreement(id).workerEarned == 10000, "isolation");
    }

    function testFuzzConservation(uint64 amount, uint32 fee) public {
        if (amount == 0) amount = 1;
        id = create(amount, fee);
        fund();
        approveOne();
        vm.prank(worker);
        escrow.withdraw(id);
        vm.warp(escrow.getAgreement(id).expiry);
        escrow.refund(id);
        invariantCheck();
    }
}
