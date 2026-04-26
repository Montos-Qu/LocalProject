// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Issuer {
    address admin_address; // Who made this account
    address issuer_address; // Issuer wallet address
    string issuer_name;
    
    constructor(address _admin, address _issuer, string memory name) {
        admin_address = _admin;
        issuer_address = _issuer;
        issuer_name = name;
    }

    function getIssuerInfo() public view returns (address, string memory)
    {
        return (issuer_address, issuer_name);
    }

    // Credential Issuing Stuff
    // A credential record to store everything about a issued credential
    struct Credential 
    {
        address issuer;         // who issued it, e.g. universities, education institutes, certificate providers 
        address user;           // who received it, e.g. students, degree holders, alumnus
        string  credentialType; // type of credential, e.g. "Diploma", "Transcript"
        bytes32 documentHash;   // keccak256 hash of the off-chain document
        bool    isRevoked;      // true if the issuer revoked it
        uint256 issuedAt;       // timestamp of the issuance
    }

    // Storage for all credentials using credential ID as key and credentialCount to track latest/next ID
    mapping(uint256 => Credential) public credentials;

    // Credential counter for unique IDs
    uint256 public credentialCount;

    // Event when a credential is issued
    event CredentialIssued(
        uint256 indexed credentialId,
        address indexed issuer,
        address indexed user,
        string  credentialType,
        bytes32 documentHash
    );

    // Event when a credential is revoked
    event CredentialRevoked(uint256 indexed credentialId);

    // Event when someone verifies a credential
    event CredentialVerified(uint256 indexed credentialId, bool isValid);

    // Issue a new credential for a user
    function IssueCredential(address user, string calldata credentialType, bytes32 documentHash) 
    external returns (uint256 credentialId) 
    {
        require(user != address(0), "Invalid user address");            // Validate user address
        require(documentHash != bytes32(0), "Document hash required");  // Check document hash

        // Assign the next available ID
        credentialId = ++credentialCount;

        // Store the credential on-chain
        credentials[credentialId] = Credential({
            issuer: msg.sender,
            user: user,
            credentialType: credentialType,
            documentHash: documentHash,
            isRevoked: false,
            issuedAt: block.timestamp
        });

        emit CredentialIssued(
            credentialId,
            msg.sender,
            user,
            credentialType,
            documentHash
        );
    }

    // Revoke an issued credential
    function RevokeCredential(uint256 credentialId) external {
        Credential storage cred = credentials[credentialId];
        require(cred.issuer == msg.sender, "Only the issuing issuer can revoke");   // Verify the issuer permission
        require(!cred.isRevoked, "Already revoked");                                // Check credential revoke status
        
        // Revoke the credential, but the record is still kept on chain
        cred.isRevoked = true;
        emit CredentialRevoked(credentialId);
    }

    // Verify that a credential is authentic and active
    function VerifyCredential(uint256 credentialId, bytes32 documentHash) external returns (bool isValid) {
        Credential storage cred = credentials[credentialId];

        require(cred.issuer != address(0), "Credential does not exist");    // Validate credential

        // Valid = hash matches what was issued AND not revoked
        isValid = (cred.documentHash == documentHash) && !cred.isRevoked;

        emit CredentialVerified(credentialId, isValid);
        return isValid;
    }

    // Get all stored details about a credential
    function GetCredential(uint256 credentialId) external view returns (Credential memory) {
        require(credentials[credentialId].issuer != address(0), "Credential does not exist");   // Verify that the credetial exists
        return credentials[credentialId];
    }
}