// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Verifier {
    address admin_address; // Who made this account
    address verifier_address; // Verifier wallet address
    string verifier_name;
    
    constructor(address _admin, address _issuer, string memory name) {
        admin_address = _admin;
        verifier_address = _issuer;
        verifier_name = name;
    }

    function getIssuerInfo() public view returns (address, string memory)
    {
        return (verifier_address, verifier_name);
    }
}