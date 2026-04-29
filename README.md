# Team19_2026SpringB_CSE540_UniversityCredentialSystem_SmartContractDesign

## Abstract
With the rise of digital information, it is getting increasingly difficult for companies and organizations to verify the authenticity of students' degrees and transcripts. As a result, many cases of degree fraud and falsified transcripts have occurred over the years, and even more so in recent years. Thus, our team seeks to address the issue with a blockchain-based solution to verify authenticity and safely manage student degrees and transcripts.

## Project Overview
This project is a blockchain-based university credential system built with Solidity, Truffle, Ganache, Web3.js, and a static HTML/CSS/JavaScript frontend.

The system supports four roles:

- Admin: deploys and manages user accounts.
- Issuer: issues and revokes credentials.
- Student: views issued credential records.
- Verifier: validates a credential by checking its credential ID and document hash.

## Contract Design
The `Admin` contract is the entry point. It creates role-specific contracts for students, issuers, and verifiers, then maps each wallet address to its deployed role contract.

The `Issuer` contract stores credential records. Each credential contains:

- issuer wallet address
- student wallet address
- credential type
- document hash
- revoked status
- issued timestamp

The frontend calculates the document hash from uploaded PDF files using SHA-256. The resulting 32-byte hash is stored on-chain as `bytes32`; the PDF itself remains off-chain.

## Local Setup
1. Install Truffle if it is not already installed:

```bash
npm install -g truffle
```

2. Start Ganache on `http://127.0.0.1:7545`.

3. Compile and migrate the contracts:

```bash
truffle compile
truffle migrate --reset
```

4. Copy the generated contract artifacts from `build/contracts` into `frontend/contracts` if the artifacts changed after deployment.

5. Serve the frontend from the repository root. For example:

```bash
python -m http.server 8080
```

6. Open the app in the browser:

```text
http://localhost:8080/frontend/index.html
```

## Demo Workflow
1. Log in with the Ganache account that deployed `Admin`. This wallet is the admin.
2. On the Admin page, add one Student wallet, one Issuer wallet, and one Verifier wallet.
3. Log in with the Issuer wallet.
4. Issue a credential to the Student wallet by selecting a credential type and uploading the credential PDF. The frontend automatically calculates the PDF's SHA-256 document hash and stores that hash in the Issuer contract.
5. Copy the displayed credential ID and Issuer contract address.
6. Log in with the Student wallet and view the credential by entering the Issuer contract address and credential ID.
7. Log in with the Verifier wallet and verify the credential by entering the Issuer contract address, credential ID, and uploading the PDF being verified.
8. To demonstrate invalid credentials, verify with a different PDF file or revoke the credential from the Issuer page and verify again.

## Usage idea draft
The idea here is to have a web page that people can go to and log in to their respective accounts and interact with whatever their user type are allowed to do with the credentials. This way, we can ease the need for people to install and set up the program on their machines.

![Interaction_Idea](https://github.com/user-attachments/assets/7ed4f606-fedb-47ac-a347-5e15e267647b)

## Contract draft diagram
The contract will hold the addresses of the student who owns it and the university that issued it. There will be 3 types of stakeholders, each with a different function available to them on the contract.

![Contract_Draft](https://github.com/user-attachments/assets/77559160-db9e-48f2-8a60-4fa1b0d1e422)
