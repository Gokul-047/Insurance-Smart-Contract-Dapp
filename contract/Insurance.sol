// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleInsurance {
    address public insurer;
    uint public nextPolicyId;
    uint public nextClaimId;

    struct Policy {
        uint id;
        address holder;
        uint premium;
        uint coverage;
        uint endTime;
        bool active;
    }

    struct Claim {
        uint id;
        uint policyId;
        address claimant;
        uint amount;
        bool approved;
        bool paid;
    }

    mapping(uint => Policy) public policies;
    mapping(uint => Claim) public claims;

    event PolicyIssued(uint policyId, address holder);
    event PremiumPaid(uint policyId, address holder);
    event ClaimSubmitted(uint claimId, uint policyId, uint amount);
    event ClaimApproved(uint claimId);
    event ClaimPaid(uint claimId, uint amount);

    modifier onlyInsurer() {
        require(msg.sender == insurer, "Not insurer");
        _;
    }

    constructor() {
        insurer = msg.sender; // deployer is insurer
    }

    function issuePolicy(address _holder, uint _premium, uint _coverage, uint _durationDays) external onlyInsurer {
        nextPolicyId++;
        policies[nextPolicyId] = Policy(nextPolicyId, _holder, _premium, _coverage, block.timestamp + (_durationDays * 1 days), true);
        emit PolicyIssued(nextPolicyId, _holder);
    }

    function payPremium(uint _policyId) external payable {
        Policy storage p = policies[_policyId];
        require(p.active, "Policy not active");
        require(msg.sender == p.holder, "Not holder");
        require(msg.value == p.premium, "Wrong premium");
        emit PremiumPaid(_policyId, msg.sender);
    }

    function submitClaim(uint _policyId, uint _amount) external {
        Policy storage p = policies[_policyId];
        require(p.active && block.timestamp <= p.endTime, "Policy expired/inactive");
        require(msg.sender == p.holder, "Not holder");
        nextClaimId++;
        claims[nextClaimId] = Claim(nextClaimId, _policyId, msg.sender, _amount, false, false);
        emit ClaimSubmitted(nextClaimId, _policyId, _amount);
    }

    function approveClaim(uint _claimId) external onlyInsurer {
        Claim storage c = claims[_claimId];
        c.approved = true;
        emit ClaimApproved(_claimId);
    }

    function payClaim(uint _claimId) external onlyInsurer {
        Claim storage c = claims[_claimId];
        require(c.approved && !c.paid, "Not approved or already paid");
        Policy storage p = policies[c.policyId];
        require(address(this).balance >= c.amount && c.amount <= p.coverage, "Not enough balance or exceeds coverage");
        c.paid = true;
        payable(c.claimant).transfer(c.amount);
        emit ClaimPaid(_claimId, c.amount);
    }

    // Insurer can add funds for payouts
    function fundContract() external payable onlyInsurer {}
}
