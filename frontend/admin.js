let web3;
let contract;
let account;

async function init() {
    web3 = new Web3("http://127.0.0.1:7545");

    const accounts = await web3.eth.getAccounts();

    account = localStorage.getItem("walletAddress") || accounts[0];

    document.getElementById("accountAddress").innerHTML =
        `Connected: ${account}`;

    const response = await fetch("./contracts/Admin.json");
    const json = await response.json();

    const abi = json.abi;
    const networkId = Object.keys(json.networks)[0];
    const address = json.networks[networkId].address;

    contract = new web3.eth.Contract(abi, address);

    console.log("Admin contract loaded:", contract);

    const owner = await contract.methods.owner().call();
    console.log("Frontend account:", account);
    console.log("Contract owner:", owner);
    console.log("Contract address:", address);
}

window.onload = init;

async function addUserAccount() {
    try {
        const userAddress = document.getElementById("userAddress").value.trim();
        const name = document.getElementById("username").value.trim();
        const accountType = Number(document.getElementById("accountType").value);

        if (!web3.utils.isAddress(userAddress)) {
            alert("Invalid wallet address");
            return;
        }

        await contract.methods
            .addUserAccount(userAddress, name, accountType)
            .send({
                from: account,
                gas: 6000000
            });

        alert("User added successfully!");
    } catch (error) {
        console.error("Add user failed:", error);
        alert("Failed to add user. Check console.");
    }
}

async function removeIssuer() {
    try {
        const index = document.getElementById("issuerIndex").value;
        const issuerAddress = document.getElementById("removeIssuerAddress").value;

        if (!web3.utils.isAddress(issuerAddress)) {
            alert("Invalid issuer address");
            return;
        }

        await contract.methods
            .removeIssuer(index, issuerAddress)
            .send({ from: account });

        alert("Issuer removed successfully!");
    } catch (error) {
        console.error(error);
        alert("Failed to remove issuer. Check console.");
    }
}