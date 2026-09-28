// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../src/AccrueDigitalWork.sol";

interface DigitalVm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
}

contract DigitalToken is IDigitalWorkToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
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

contract AccrueDigitalWorkTest {
    DigitalVm constant vm = DigitalVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant WORKER = address(0xB);
    address constant JEV_OPERATOR = address(0xC);
    address constant REVIEWER = address(0xD);
    address constant THIRD = address(0xE);
    address constant STRANGER = address(0xF);
    bytes32 constant POLICY = keccak256("locked policy");
    bytes32 constant EVIDENCE = keccak256("commit and test report");
    bytes32 constant REPORT = keccak256("signed report");

    DigitalToken token;
    AccrueDigitalWork work;
    uint256 id;

    function setUp() public {
        token = new DigitalToken();
        work = new AccrueDigitalWork(address(token));
        token.mint(address(this), 10_000);
        token.approve(address(work), type(uint256).max);
        address[3] memory verifiers = [JEV_OPERATOR, REVIEWER, THIRD];
        id = work.create(WORKER, verifiers, 1_000, 90, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), POLICY);
    }

    function fundAndSubmit() internal {
        vm.prank(WORKER);
        work.accept(id, POLICY);
        work.fund(id);
        vm.prank(WORKER);
        work.submit(id, EVIDENCE);
    }

    function voteAs(address verifier, bool pass, bytes32 evidence) internal {
        vm.prank(verifier);
        work.vote(id, evidence, pass, REPORT);
    }

    function testTwoIndependentVotesSettle() public {
        fundAndSubmit();
        voteAs(JEV_OPERATOR, true, EVIDENCE);
        require(work.getJob(id).status == AccrueDigitalWork.Status.Submitted, "one vote settled");
        voteAs(REVIEWER, true, EVIDENCE);
        require(work.getJob(id).status == AccrueDigitalWork.Status.Paid, "not paid");
        require(work.claimable(WORKER) == 1_000, "wrong worker amount");
        require(work.claimable(JEV_OPERATOR) == 30 && work.claimable(REVIEWER) == 30, "wrong fees");
        require(work.claimable(address(this)) == 30, "unused fee not returned");
        vm.prank(WORKER);
        work.withdraw();
        require(token.balanceOf(WORKER) == 1_000, "worker not paid");
        require(token.balanceOf(address(work)) == 90, "balance not conserved");
    }

    function testRejectingVotesRequestCorrectionAndAllowNewEvidence() public {
        fundAndSubmit();
        voteAs(JEV_OPERATOR, false, EVIDENCE);
        voteAs(REVIEWER, false, EVIDENCE);
        require(work.getJob(id).status == AccrueDigitalWork.Status.NeedsChanges, "not returned for changes");
        vm.prank(WORKER);
        work.submit(id, keccak256("corrected"));
        vm.prank(JEV_OPERATOR);
        vm.expectRevert();
        work.vote(id, EVIDENCE, true, REPORT);
        voteAs(JEV_OPERATOR, true, keccak256("corrected"));
        voteAs(THIRD, true, keccak256("corrected"));
        require(work.claimable(JEV_OPERATOR) == 30, "repeat vote earned twice");
        require(work.getJob(id).status == AccrueDigitalWork.Status.Paid, "corrected work not paid");
    }

    function testNoFakeOrDuplicateQuorum() public {
        fundAndSubmit();
        vm.prank(STRANGER);
        vm.expectRevert();
        work.vote(id, EVIDENCE, true, REPORT);
        voteAs(JEV_OPERATOR, true, EVIDENCE);
        vm.prank(JEV_OPERATOR);
        vm.expectRevert();
        work.vote(id, EVIDENCE, true, REPORT);
        require(work.getJob(id).status == AccrueDigitalWork.Status.Submitted, "duplicate vote settled");
    }

    function testDeadlineRefundKeepsEarnedVerifierFees() public {
        fundAndSubmit();
        voteAs(JEV_OPERATOR, false, EVIDENCE);
        vm.warp(block.timestamp + 2 days + 1);
        work.expire(id);
        require(work.getJob(id).status == AccrueDigitalWork.Status.Refunded, "not refunded");
        require(work.claimable(address(this)) == 1_060, "wrong refund");
        require(work.claimable(JEV_OPERATOR) == 30, "reviewer fee erased");
        vm.expectRevert();
        work.expire(id);
    }

    function testCannotFundWithoutWorkerAcceptance() public {
        vm.expectRevert();
        work.fund(id);
    }

    function testCannotSubmitAfterDeliveryDeadline() public {
        vm.prank(WORKER);
        work.accept(id, POLICY);
        work.fund(id);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(WORKER);
        vm.expectRevert();
        work.submit(id, EVIDENCE);
    }

    function testRejectsDuplicateVerifierAtCreation() public {
        address[3] memory verifiers = [JEV_OPERATOR, JEV_OPERATOR, THIRD];
        vm.expectRevert();
        work.create(WORKER, verifiers, 1_000, 90, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), POLICY);
    }
}
