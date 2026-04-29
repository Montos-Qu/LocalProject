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

function isPdfFile(file) {
    return file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
}

function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPdfFile(file) {
    if (!isPdfFile(file)) {
        throw new Error("Please select a PDF document.");
    }

    const fileBytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", fileBytes);
    return `0x${bytesToHex(new Uint8Array(digest))}`;
}

async function updateDocumentHashPreview() {
    const fileInput = document.getElementById("documentFile");
    const preview = document.getElementById("documentHashPreview");
    const file = fileInput.files[0];

    if (!file) {
        preview.innerText = "";
        return;
    }

    try {
        const hash = await hashPdfFile(file);
        preview.innerText = `Selected file: ${file.name}\nSHA-256 document hash: ${hash}`;
    } catch (error) {
        preview.innerText = error.message;
    }
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

        document.getElementById("documentFile").addEventListener("change", updateDocumentHashPreview);
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
        const file = document.getElementById("documentFile").files[0];

        if (!web3.utils.isAddress(user)) {
            alert("Invalid student wallet address.");
            return;
        }
        if (!type) {
            alert("Credential type is required.");
            return;
        }
        if (!file) {
            alert("Please upload a PDF credential document.");
            return;
        }

        const hash = await hashPdfFile(file);

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
            resultPanel.innerText = `Credential issued.\nCredential ID: ${credentialId}\nIssuer contract: ${issuerAddress}\nDocument hash: ${hash}`;
        }
        alert("Credential issued!");
    } catch (error) {
        console.error("Issue credential failed:", error);
        alert(error.message || "Failed to issue credential. Check console.");
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
