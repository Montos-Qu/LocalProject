let web3;
let contract;
let account;

async function init() {
    web3 = new Web3("http://127.0.0.1:7545");

    const accounts = await web3.eth.getAccounts();
    
    account = localStorage.getItem("walletAddress") || accounts[0];
    console.log("Using account:", account);

    const response = await fetch("./contracts/Student.json");
    const json = await response.json();

    console.log("ABI loaded:", json);

    const abi = json.abi;
    const address = json.networks["5777"].address;
    console.log("Contract address:", address);

    contract = new web3.eth.Contract(abi, address);
    console.log("Contract loaded:", contract);
}

async function viewCredential() {
    let id = document.getElementById("credentialIdLookup").value;

    let data = await contract.methods.GetCredential(id).call();

    document.getElementById("credentialDetails").innerText =
        JSON.stringify(data, null, 2);
}