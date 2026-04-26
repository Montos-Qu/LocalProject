// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Student {
    address admin_address; // Who made this account
    address student_address; // Student wallet address
    string student_name;
    uint256[] credentials; // ID number of the credentials

    constructor(address _admin, address _student, string memory _studentName) {
        admin_address = _admin;
        student_address = _student;
        student_name = _studentName;
    }

    modifier StudentOnly() {
        require(msg.sender == student_address);
        _;
    }

    function getStudentInfo() public view returns (address, string memory, uint256[] memory)
    {
        return (student_address, student_name, credentials);
    }

    function editStudentInfo(string memory _name) public StudentOnly {
        student_name = _name;
    }

    function addCredential(uint256 credential_ID) public
    {
        credentials.push(credential_ID);
    }
}