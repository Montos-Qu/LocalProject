let web3;
let adminContract;
let issuerContract;
let account;
let issuerAddress;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function loadArtifact(name) {
    const response = await fetch(`./contracts/${name}.json`);
    return response.json();
}

function getDeployedAddress(artifact) {
    const networkId = Object.keys(artifact.networks)[0];
    if (!networkId) {
        throw new Error("Contract artifact does not contain a deployed network address.");
    }
    return artifact.networks[networkId].address;
}

async function init() {
    try {
        web3 = new Web3("http://127.0.0.1:7545");
        const accounts = await web3.eth.getAccounts();
        account = localStorage.getItem("walletAddress") || accounts[0];

        const adminArtifact = await loadArtifact("Admin");
        adminContract = new web3.eth.Contract(adminArtifact.abi, getDeployedAddress(adminArtifact));

        issuerAddress = await adminContract.methods.wallet_to_issuer_map(account).call();
        if (issuerAddress === ZERO_ADDRESS) {
            alert("This wallet is not registered as an issuer.");
            window.location.href = "index.html";
            return;
        }

        const issuerArtifact = await loadArtifact("Issuer");
        issuerContract = new web3.eth.Contract(issuerArtifact.abi, issuerAddress);

        const info = await issuerContract.methods.getIssuerInfo().call();
        const panel = document.getElementById("issuerInfo");
        if (panel) {
            panel.innerText = `Issuer: ${info[1]}\nWallet: ${info[0]}\nContract: ${issuerAddress}`;
        }
    } catch (error) {
        console.error("Issuer page failed to initialize:", error);
        alert("Unable to load issuer page. Check Ganache/Truffle deployment and console.");
    }
}

window.onload = init;

async function issueCredential() {
    try {
        const user = document.getElementById("userAddress").value.trim();
        const type = document.getElementById("credentialType").value.trim();
        const hash = document.getElementById("documentHash").value.trim();

        if (!web3.utils.isAddress(user)) {
            alert("Invalid student wallet address.");
            return;
        }
        if (!type) {
            alert("Credential type is required.");
            return;
        }
        if (!web3.utils.isHexStrict(hash) || hash.length !== 66) {
            alert("Document hash must be a bytes32 hex value, for example web3.utils.keccak256(file contents).");
            return;
        }

        const receipt = await issuerContract.methods
            .IssueCredential(user, type, hash)
            .send({ from: account, gas: 6000000 });

        const event = receipt.events && receipt.events.CredentialIssued;
        const credentialId = event ? event.returnValues.credentialId : "unknown";

        const studentAddress = await adminContract.methods.wallet_to_student_map(user).call();
        if (studentAddress !== ZERO_ADDRESS && credentialId !== "unknown") {
            const studentArtifact = await loadArtifact("Student");
            const studentContract = new web3.eth.Contract(studentArtifact.abi, studentAddress);
            await studentContract.methods.addCredential(credentialId).send({ from: account, gas: 300000 });
        }

        const resultPanel = document.getElementById("issueResult");
        if (resultPanel) {
            resultPanel.innerText = `Credential issued.\nCredential ID: ${credentialId}\nIssuer contract: ${issuerAddress}`;
        }
        alert("Credential issued!");
    } catch (error) {
        console.error("Issue credential failed:", error);
        alert("Failed to issue credential. Check console.");
    }
}

async function revokeCredential() {
    try {
        const id = document.getElementById("credentialIdRevoke").value;
        if (!id) {
            alert("Credential ID is required.");
            return;
        }

        await issuerContract.methods.RevokeCredential(id).send({ from: account, gas: 300000 });
        alert("Credential revoked.");
    } catch (error) {
        console.error("Revoke credential failed:", error);
        alert("Failed to revoke credential. Check console.");
    }
}
