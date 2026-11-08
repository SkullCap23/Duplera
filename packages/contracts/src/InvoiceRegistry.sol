// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Synthetic invoice claims. No funds, authenticity or legal priority are established.
contract InvoiceRegistry is AccessControl, EIP712 {
    bytes32 public constant LENDER_ROLE = keccak256("LENDER_ROLE");
    uint64 public constant RESERVATION_PERIOD = 15 minutes;
    address public immutable analysisSigner;
    enum State { NONE, RESERVED, FINANCED, CANCELLED, EXPIRED, RELEASED }
    struct Claim {
        uint256 id; bytes32 matchingToken; address lender; bytes32 evidenceRoot;
        bytes32 evidenceContext; uint32 schemaVersion; uint64 createdAt;
        uint64 reservationDeadline; State state; uint64 transitionedAt;
    }
    struct Attestation {
        uint32 schemaVersion; bytes32 matchingToken; bytes32 evidenceRoot; address lenderAddress;
        bytes32 evidenceContext; bytes32 analysisId; bytes32 attestationNonce; uint64 validUntil;
    }
    bytes32 private constant ATTESTATION_TYPEHASH = keccak256("Attestation(uint32 schemaVersion,bytes32 matchingToken,bytes32 evidenceRoot,address lenderAddress,bytes32 evidenceContext,bytes32 analysisId,bytes32 attestationNonce,uint64 validUntil)");
    uint256 public claimCount;
    mapping(uint256 => Claim) private claims;
    mapping(bytes32 => uint256) public currentClaim;
    mapping(bytes32 => bool) public consumedNonces;
    event ClaimReserved(uint256 indexed claimId, bytes32 indexed matchingToken, address indexed lender, bytes32 evidenceRoot, bytes32 evidenceContext, uint64 deadline);
    event FinancingConfirmed(uint256 indexed claimId);
    event ReservationCancelled(uint256 indexed claimId);
    event ReservationExpired(uint256 indexed claimId);
    event FinancingReleased(uint256 indexed claimId);
    error InvalidApproval();
    error ActiveConflict(uint256 claimId);
    error InvalidTransition();
    error NotClaimLender();
    constructor(address admin, address signer) EIP712("DupleraRegistry", "1") {
        require(admin != address(0) && signer != address(0), "Zero authority");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        analysisSigner = signer;
    }
    function grantLender(address lender) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(lender != address(0), "Zero lender"); _grantRole(LENDER_ROLE, lender);
    }
    function revokeLender(address lender) external onlyRole(DEFAULT_ADMIN_ROLE) { _revokeRole(LENDER_ROLE, lender); }
    function reserve(Attestation calldata a, bytes calldata signature) external onlyRole(LENDER_ROLE) returns (uint256 id) {
        if (a.schemaVersion != 1 || a.lenderAddress != msg.sender || a.validUntil <= block.timestamp ||
            a.matchingToken == bytes32(0) || a.evidenceRoot == bytes32(0) || a.evidenceContext == bytes32(0) ||
            a.analysisId == bytes32(0) || a.attestationNonce == bytes32(0) || consumedNonces[a.attestationNonce]) revert InvalidApproval();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ATTESTATION_TYPEHASH,
            a.schemaVersion,a.matchingToken,a.evidenceRoot,a.lenderAddress,a.evidenceContext,a.analysisId,a.attestationNonce,a.validUntil)));
        if (ECDSA.recover(digest, signature) != analysisSigner) revert InvalidApproval();
        uint256 previous = currentClaim[a.matchingToken];
        State effective = getEffectiveStatus(previous);
        if (effective == State.RESERVED || effective == State.FINANCED) revert ActiveConflict(previous);
        if (previous != 0 && claims[previous].state == State.RESERVED) _expire(previous);
        consumedNonces[a.attestationNonce] = true;
        id = ++claimCount;
        claims[id] = Claim(id,a.matchingToken,msg.sender,a.evidenceRoot,a.evidenceContext,a.schemaVersion,
            uint64(block.timestamp),uint64(block.timestamp)+RESERVATION_PERIOD,State.RESERVED,uint64(block.timestamp));
        currentClaim[a.matchingToken] = id;
        emit ClaimReserved(id,a.matchingToken,msg.sender,a.evidenceRoot,a.evidenceContext,uint64(block.timestamp)+RESERVATION_PERIOD);
    }
    function getClaim(uint256 id) external view returns (Claim memory) { require(id>0 && id<=claimCount,"Unknown claim"); return claims[id]; }
    function getEffectiveStatus(uint256 id) public view returns (State) {
        Claim storage c = claims[id];
        if (c.state == State.RESERVED && block.timestamp >= c.reservationDeadline) return State.EXPIRED;
        return c.state;
    }
    function confirmFinancing(uint256 id) external onlyRole(LENDER_ROLE) {
        Claim storage c = _owned(id);
        if (getEffectiveStatus(id) != State.RESERVED) revert InvalidTransition();
        c.state=State.FINANCED; c.transitionedAt=uint64(block.timestamp); emit FinancingConfirmed(id);
    }
    function cancelReservation(uint256 id) external {
        Claim storage c = _owned(id);
        if (getEffectiveStatus(id) != State.RESERVED) revert InvalidTransition();
        c.state=State.CANCELLED; c.transitionedAt=uint64(block.timestamp); emit ReservationCancelled(id);
    }
    function releaseFinancing(uint256 id) external {
        Claim storage c = _owned(id);
        if (c.state != State.FINANCED) revert InvalidTransition();
        c.state=State.RELEASED; c.transitionedAt=uint64(block.timestamp); emit FinancingReleased(id);
    }
    function expireReservation(uint256 id) external {
        if (claims[id].state != State.RESERVED || getEffectiveStatus(id) != State.EXPIRED) revert InvalidTransition();
        _expire(id);
    }
    function _expire(uint256 id) private { claims[id].state=State.EXPIRED; claims[id].transitionedAt=uint64(block.timestamp); emit ReservationExpired(id); }
    function _owned(uint256 id) private view returns (Claim storage c) {
        c=claims[id]; if(c.lender != msg.sender) revert NotClaimLender();
    }
}
