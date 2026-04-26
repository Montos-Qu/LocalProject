let web3;
let contract;
let account;

async function init() {
    web3 = new Web3("http://127.0.0.1:7545");

    const accounts = await web3.eth.getAccounts();
    
    account = localStorage.getItem("walletAddress") || accounts[0];
    console.log("Using account:", account);

    const response = await fetch("./contracts/Issuer.json");
    const json = await response.json();

    console.log("ABI loaded:", json);

    const abi = json.abi;
    const address = json.networks["5777"].address;
    console.log("Contract address:", address);

    contract = new web3.eth.Contract(abi, address);
    console.log("Contract loaded:", contract);
}

window.onload = init;

async function issueCredential() {
    let user = document.getElementById("userAddress").value;
    let type = document.getElementById("credentialType").value;
    let hash = document.getElementById("documentHash").value;
    let cid = document.getElementById("ipfsCID").value;

    await contract.methods.IssueCredential(user, type, hash, cid)
        .send({ from: account });

    alert("Credential issued!");
}

async function revokeCredential() {
    let id = document.getElementById("credentialIdRevoke").value;

    await contract.methods.RevokeCredential(id)
        .send({ from: account });

    alert("Credential revoked.");
}