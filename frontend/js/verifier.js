let web3;
let adminContract;
let account;
let verifierAddress;

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
    const file = document.getElementById("documentFile").files[0];
    const preview = document.getElementById("documentHashPreview");

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

        verifierAddress = await adminContract.methods.wallet_to_verifier_map(account).call();
        if (verifierAddress === ZERO_ADDRESS) {
            alert("This wallet is not registered as a verifier.");
            window.location.href = "index.html";
            return;
        }

        const verifierArtifact = await loadArtifact("Verifier");
        const verifierContract = new web3.eth.Contract(verifierArtifact.abi, verifierAddress);
        const info = await verifierContract.methods.getIssuerInfo().call();
        document.getElementById("verifierInfo").innerText =
            `Verifier: ${info[1]}\nWallet: ${info[0]}\nVerifier contract: ${verifierAddress}`;

        document.getElementById("documentFile").addEventListener("change", updateDocumentHashPreview);
    } catch (error) {
        console.error("Verifier page failed to initialize:", error);
        alert("Unable to load verifier page. Check Ganache/Truffle deployment and console.");
    }
}

window.onload = init;

async function verifyCredential() {
    try {
        const issuerContractAddress = document.getElementById("issuerContractAddress").value.trim();
        const id = document.getElementById("credentialIdLookup").value;
        const file = document.getElementById("documentFile").files[0];

        if (!web3.utils.isAddress(issuerContractAddress)) {
            showStatus("Issuer contract address is required.", "danger");
            return;
        }
        if (!id) {
            showStatus("Credential ID is required.", "danger");
            return;
        }
        if (!file) {
            showStatus("Please upload the PDF document to verify.", "danger");
            return;
        }

        const hash = await hashPdfFile(file);
        const issuerArtifact = await loadArtifact("Issuer");
        const issuerContract = new web3.eth.Contract(issuerArtifact.abi, issuerContractAddress);

        const isValid = await issuerContract.methods.VerifyCredential(id, hash).call({ from: account });
        const data = await issuerContract.methods.GetCredential(id).call();

        const result = {
            valid: isValid,
            revoked: data.isRevoked,
            issuer: data.issuer,
            student: data.user,
            credentialType: data.credentialType,
            uploadedDocumentHash: hash,
            storedDocumentHash: data.documentHash,
            issuedAt: new Date(Number(data.issuedAt) * 1000).toLocaleString()
        };

        document.getElementById("credentialDetails").innerText = JSON.stringify(result, null, 2);
        showStatus(isValid ? "Credential is valid." : "Credential is invalid or revoked.", isValid ? "success" : "danger");
    } catch (error) {
        console.error("Verify credential failed:", error);
        showStatus(error.message || "Failed to verify credential. Check inputs and console.", "danger");
    }
}

function showStatus(message, type) {
    const status = document.getElementById("statusMessage");
    status.className = `alert alert-${type}`;
    status.innerText = message;
    status.classList.remove("d-none");
}
