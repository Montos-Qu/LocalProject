let web3;
let account;
let contract;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function connectWallet() {
    try {
        web3 = new Web3("http://127.0.0.1:7545");
        account = document.getElementById("walletAddress").value.trim();

        if (!web3.utils.isAddress(account)) {
            alert("Please enter a valid wallet address.");
            return;
        }

        localStorage.setItem("walletAddress", account);
        await loadContract();
        await moveToRolePage();
    } catch (error) {
        console.error(error);
        alert("Login failed. Check console.");
    }
}

async function loadContract() {
    const abiFile = await fetch("./contracts/Admin.json");
    const json = await abiFile.json();
    const networkId = Object.keys(json.networks)[0];
    contract = new web3.eth.Contract(json.abi, json.networks[networkId].address);
}

async function moveToRolePage() {
    const admin = await contract.methods.owner().call();

    if (account.toLowerCase() === admin.toLowerCase()) {
        window.location.href = "admin.html";
        return;
    }

    const studentContract = await contract.methods.wallet_to_student_map(account).call();
    const issuerContract = await contract.methods.wallet_to_issuer_map(account).call();
    const verifierContract = await contract.methods.wallet_to_verifier_map(account).call();

    if (studentContract !== ZERO_ADDRESS) {
        window.location.href = "student.html";
    } else if (issuerContract !== ZERO_ADDRESS) {
        window.location.href = "issuer.html";
    } else if (verifierContract !== ZERO_ADDRESS) {
        window.location.href = "verifier.html";
    } else {
        alert("This wallet is not registered.");
    }
}
