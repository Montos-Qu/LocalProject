// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Student.sol";
import "./Issuer.sol";
import "./Verifier.sol";

contract Admin {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier OwnerOnly() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    mapping(address => address) public wallet_to_student_map;
    mapping(address => address) public wallet_to_issuer_map;
    mapping(address => address) public wallet_to_verifier_map;

    address[] public registered_students;
    address[] public approved_issuers;
    address[] public verifiers;

    function addUserAccount(address userAddress, string memory name, uint256 accountType) public OwnerOnly {
        require(userAddress != address(0), "Invalid user address");
        require(accountType >= 1 && accountType <= 3, "Invalid account type");

        if (accountType == 1) {
            require(wallet_to_student_map[userAddress] == address(0), "Student already registered");
            Student new_student = new Student(owner, userAddress, name);
            wallet_to_student_map[userAddress] = address(new_student);
            registered_students.push(userAddress);
        } else if (accountType == 2) {
            require(wallet_to_issuer_map[userAddress] == address(0), "Issuer already registered");
            Issuer new_issuer = new Issuer(owner, userAddress, name);
            wallet_to_issuer_map[userAddress] = address(new_issuer);
            approved_issuers.push(userAddress);
        } else {
            require(wallet_to_verifier_map[userAddress] == address(0), "Verifier already registered");
            Verifier new_verifier = new Verifier(owner, userAddress, name);
            wallet_to_verifier_map[userAddress] = address(new_verifier);
            verifiers.push(userAddress);
        }
    }

    function getStudentCount() public view returns (uint256) {
        return registered_students.length;
    }

    function getIssuerCount() public view returns (uint256) {
        return approved_issuers.length;
    }

    function getVerifierCount() public view returns (uint256) {
        return verifiers.length;
    }

    function removeStudent(uint256 _index, address userAddress) public OwnerOnly returns (bool) {
        if (_index >= registered_students.length || registered_students[_index] != userAddress) {
            return false;
        }

        for (uint i = _index; i < registered_students.length - 1; i++) {
            registered_students[i] = registered_students[i + 1];
        }
        registered_students.pop();
        delete wallet_to_student_map[userAddress];
        return true;
    }

    function removeIssuer(uint256 _index, address userAddress) public OwnerOnly returns (bool) {
        if (_index >= approved_issuers.length || approved_issuers[_index] != userAddress) {
            return false;
        }

        for (uint i = _index; i < approved_issuers.length - 1; i++) {
            approved_issuers[i] = approved_issuers[i + 1];
        }
        approved_issuers.pop();
        delete wallet_to_issuer_map[userAddress];
        return true;
    }

    function removeVerifier(uint256 _index, address userAddress) public OwnerOnly returns (bool) {
        if (_index >= verifiers.length || verifiers[_index] != userAddress) {
            return false;
        }

        for (uint i = _index; i < verifiers.length - 1; i++) {
            verifiers[i] = verifiers[i + 1];
        }
        verifiers.pop();
        delete wallet_to_verifier_map[userAddress];
        return true;
    }
}
