// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Issuer {
    address admin_address;
    address issuer_address;
    string issuer_name;

    constructor(address _admin, address _issuer, string memory name) {
        admin_address = _admin;
        issuer_address = _issuer;
        issuer_name = name;
    }

    function getIssuerInfo() public view returns (address, string memory) {
        return (issuer_address, issuer_name);
    }

    struct Credential {
        address issuer;
        address user;
        string credentialType;
        bytes32 documentHash;
        bool isRevoked;
        uint256 issuedAt;
    }

    mapping(uint256 => Credential) public credentials;
    uint256 public credentialCount;

    event CredentialIssued(
        uint256 indexed credentialId,
        address indexed issuer,
        address indexed user,
        string credentialType,
        bytes32 documentHash
    );
    event CredentialRevoked(uint256 indexed credentialId);
    event CredentialRestored(uint256 indexed credentialId);
    event CredentialVerified(uint256 indexed credentialId, bool isValid);

    function IssueCredential(address user, string calldata credentialType, bytes32 documentHash)
        external returns (uint256 credentialId)
    {
        require(user != address(0), "Invalid user address");
        require(documentHash != bytes32(0), "Document hash required");

        credentialId = ++credentialCount;
        credentials[credentialId] = Credential({
            issuer: msg.sender,
            user: user,
            credentialType: credentialType,
            documentHash: documentHash,
            isRevoked: false,
            issuedAt: block.timestamp
        });

        emit CredentialIssued(credentialId, msg.sender, user, credentialType, documentHash);
    }

    function RevokeCredential(uint256 credentialId) external {
        Credential storage cred = credentials[credentialId];
        require(cred.issuer == msg.sender, "Only the issuing issuer can revoke");
        require(!cred.isRevoked, "Already revoked");

        cred.isRevoked = true;
        emit CredentialRevoked(credentialId);
    }

    function RestoreCredential(uint256 credentialId) external {
        Credential storage cred = credentials[credentialId];
        require(cred.issuer == msg.sender, "Only the issuing issuer can restore");
        require(cred.isRevoked, "Credential is not revoked");

        cred.isRevoked = false;
        emit CredentialRestored(credentialId);
    }

    function VerifyCredential(uint256 credentialId, bytes32 documentHash) external returns (bool isValid) {
        Credential storage cred = credentials[credentialId];
        require(cred.issuer != address(0), "Credential does not exist");

        isValid = (cred.documentHash == documentHash) && !cred.isRevoked;
        emit CredentialVerified(credentialId, isValid);
        return isValid;
    }

    function GetCredential(uint256 credentialId) external view returns (Credential memory) {
        require(credentials[credentialId].issuer != address(0), "Credential does not exist");
        return credentials[credentialId];
    }
}
