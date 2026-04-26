// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Student.sol";
import "./Issuer.sol";
import "./Verifier.sol";

contract Admin {
    address public owner;

    // Constructor when the contract is deployed
    constructor() {
        owner = msg.sender;
    }

    modifier OwnerOnly() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // This is for quick lookup
    mapping(address => address) public wallet_to_student_map; // Map wallet address to the student contract address
    mapping(address => address) public wallet_to_issuer_map; // Map wallet to issuer contract address
    mapping(address => address) public wallet_to_verifier_map; // Map wallet to verifier contract address

    // Wallet list
    address[] public registered_students; // List of students
    address[] public approved_issuers; // List of issuers
    address[] public verifiers; // List of verifier

    // Add new account to network, the type will be based on number
    // 1 - Student
    // 2 - Issuer
    // 3 - Verifier
    function addUserAccount(address userAddress, string memory name, uint256 accountType) public OwnerOnly 
    {
        require(userAddress != address(0), "Invalid user address");
        require(accountType >= 1 && accountType <= 3, "Invalid account type");

        if (accountType == 1) {
            Student new_student = new Student(owner, userAddress, name);
            wallet_to_student_map[userAddress] = address(new_student);
            registered_students.push(userAddress);
        } 
        else if (accountType == 2) {
            Issuer new_issuer = new Issuer(owner, userAddress, name);
            wallet_to_issuer_map[userAddress] = address(new_issuer);
            approved_issuers.push(userAddress);
        } 
        else {
            Verifier new_verifier = new Verifier(owner, userAddress, name);
            wallet_to_verifier_map[userAddress] = address(new_verifier);
            verifiers.push(userAddress);
        }
    }

    // Remove the issuer
    function removeIssuer(uint256 _index, address userAddress) public OwnerOnly returns (bool) {
        if (_index >= approved_issuers.length) {
            return false;
        }

        for (uint i = _index; i < approved_issuers.length - 1; i++) {
            approved_issuers[i] = approved_issuers[i + 1];
        }
        approved_issuers.pop();

        delete wallet_to_issuer_map[userAddress];

        return true;
    }
}