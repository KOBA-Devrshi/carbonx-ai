// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CarbonDNARegistry
/// @notice Records immutable lifecycle events for CarbonX carbon credits —
///         Carbon DNA fingerprint hashes, verification timestamps, and
///         ownership/lifecycle transitions. This contract does NOT itself
///         certify, issue, or cancel carbon credits; it is an append-only
///         log of CarbonX platform events for a given credit ID, anchored
///         on-chain for tamper-evidence.
/// @dev    Deploy to Polygon (Amoy testnet for development, Polygon PoS for
///         production once the platform is ready). The backend adapter at
///         backend/services/blockchain.py only calls this contract when
///         POLYGON_RPC_URL, POLYGON_PRIVATE_KEY and
///         CARBON_DNA_CONTRACT_ADDRESS are all configured — otherwise it
///         reports "Demo Mode" and never fabricates a transaction.
contract CarbonDNARegistry {
    enum EventType {
        ISSUED,
        DNA_GENERATED,
        AUDITED,
        STRESS_TESTED,
        REVALIDATED,
        INTEGRITY_FLAGGED,
        INTEGRITY_CLEARED,
        TRANSFERRED,
        RETIRED
    }

    struct LifecycleEvent {
        string creditId;
        bytes32 dnaFingerprint;
        EventType eventType;
        address recordedBy;
        uint256 timestamp;
    }

    address public owner;
    mapping(address => bool) public authorizedRecorders;

    LifecycleEvent[] public events;
    mapping(string => uint256[]) private eventsByCreditId; // creditId => indices into `events`
    mapping(string => bytes32) public latestFingerprint;   // creditId => most recent DNA hash

    event LifecycleEventRecorded(
        string indexed creditId,
        bytes32 dnaFingerprint,
        EventType eventType,
        address indexed recordedBy,
        uint256 timestamp
    );
    event RecorderAuthorized(address indexed recorder);
    event RecorderRevoked(address indexed recorder);

    modifier onlyOwner() {
        require(msg.sender == owner, "CarbonDNARegistry: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedRecorders[msg.sender] || msg.sender == owner,
            "CarbonDNARegistry: caller is not authorized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedRecorders[msg.sender] = true;
    }

    function authorizeRecorder(address recorder) external onlyOwner {
        authorizedRecorders[recorder] = true;
        emit RecorderAuthorized(recorder);
    }

    function revokeRecorder(address recorder) external onlyOwner {
        authorizedRecorders[recorder] = false;
        emit RecorderRevoked(recorder);
    }

    /// @notice Append a lifecycle event for a credit. Only the CarbonX
    ///         backend's authorized wallet(s) may call this.
    function recordEvent(
        string calldata creditId,
        bytes32 dnaFingerprint,
        EventType eventType
    ) external onlyAuthorized {
        events.push(LifecycleEvent({
            creditId: creditId,
            dnaFingerprint: dnaFingerprint,
            eventType: eventType,
            recordedBy: msg.sender,
            timestamp: block.timestamp
        }));
        eventsByCreditId[creditId].push(events.length - 1);

        if (dnaFingerprint != bytes32(0)) {
            latestFingerprint[creditId] = dnaFingerprint;
        }

        emit LifecycleEventRecorded(creditId, dnaFingerprint, eventType, msg.sender, block.timestamp);
    }

    function getEventCount(string calldata creditId) external view returns (uint256) {
        return eventsByCreditId[creditId].length;
    }

    function getEvent(string calldata creditId, uint256 index) external view returns (LifecycleEvent memory) {
        uint256[] storage indices = eventsByCreditId[creditId];
        require(index < indices.length, "CarbonDNARegistry: index out of range");
        return events[indices[index]];
    }

    function verifyFingerprint(string calldata creditId, bytes32 fingerprint) external view returns (bool) {
        return latestFingerprint[creditId] == fingerprint;
    }
}
