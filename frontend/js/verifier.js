let web3;
let adminContract;
let account;
let verifierAddress;
let loadedReceipt = null;

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

async function handleReceiptUpload() {
    try {
        const file = document.getElementById("receiptFile").files[0];
        if (!file) {
            return;
        }

        loadedReceipt = JSON.parse(await file.text());
        if (loadedReceipt.schema !== "university-credential-receipt") {
            throw new Error("This is not a supported credential receipt file.");
        }

        document.getElementById("issuerContractAddress").value = loadedReceipt.issuerContractAddress || "";
        document.getElementById("credentialIdLookup").value = loadedReceipt.credentialId || "";
        document.getElementById("receiptInfo").innerText = `${file.name} loaded for credential #${loadedReceipt.credentialId || "unknown"}.`;
        showStatus("Receipt loaded. Upload the matching PDF and verify.", "success");
    } catch (error) {
        loadedReceipt = null;
        console.error("Receipt upload failed:", error);
        showStatus(error.message || "Could not read credential receipt.", "danger");
    }
}

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
            credentialId: id,
            valid: isValid,
            revoked: data.isRevoked,
            issuerContractAddress,
            issuer: data.issuer,
            student: data.user,
            credentialType: data.credentialType,
            uploadedDocumentHash: hash,
            storedDocumentHash: data.documentHash,
            receiptDocumentHash: loadedReceipt?.documentHash || "",
            issuedAt: new Date(Number(data.issuedAt) * 1000).toLocaleString()
        };

        renderVerificationResult(result);
        showStatus(isValid ? "Credential is valid." : "Credential is invalid or revoked.", isValid ? "success" : "danger");
    } catch (error) {
        console.error("Verify credential failed:", error);
        showStatus(error.message || "Failed to verify credential. Check inputs and console.", "danger");
    }
}

function renderVerificationResult(result) {
    const container = document.getElementById("credentialDetails");
    const hashMatchesReceipt = !result.receiptDocumentHash || result.receiptDocumentHash.toLowerCase() === result.uploadedDocumentHash.toLowerCase();
    const statusClass = result.valid ? "success" : "danger";
    const statusText = result.valid ? "Valid" : "Invalid";

    container.innerHTML = `
        <div class="credential-result-card">
            <div class="result-header">
                <div>
                    <div class="result-eyebrow">Credential #${result.credentialId}</div>
                    <h4>${result.credentialType}</h4>
                </div>
                <span class="badge text-bg-${statusClass}">${statusText}</span>
            </div>
            <div class="verification-summary">
                ${renderCheckItem("On-chain credential", result.valid && !result.revoked)}
                ${renderCheckItem("Document hash match", result.uploadedDocumentHash.toLowerCase() === result.storedDocumentHash.toLowerCase())}
                ${renderCheckItem("Receipt hash match", hashMatchesReceipt)}
                ${renderCheckItem("Not revoked", !result.revoked)}
            </div>
            <div class="credential-detail-grid">
                ${renderDetailRow("Student Wallet", result.student)}
                ${renderDetailRow("Issuer Wallet", result.issuer)}
                ${renderDetailRow("Issuer Contract", result.issuerContractAddress)}
                ${renderDetailRow("Uploaded PDF Hash", result.uploadedDocumentHash)}
                ${renderDetailRow("Stored Document Hash", result.storedDocumentHash)}
                ${renderDetailRow("Receipt Document Hash", result.receiptDocumentHash || "No receipt uploaded")}
                ${renderDetailRow("Issued At", result.issuedAt)}
            </div>
        </div>
    `;
}

function renderCheckItem(label, passed) {
    return `
        <div class="check-item ${passed ? "passed" : "failed"}">
            <i class="fa-solid ${passed ? "fa-circle-check" : "fa-circle-xmark"}"></i>
            <span>${label}</span>
        </div>
    `;
}

function renderDetailRow(label, value) {
    return `
        <div class="detail-label">${label}</div>
        <div class="detail-value">${value || "N/A"}</div>
    `;
}

function showStatus(message, type) {
    const status = document.getElementById("statusMessage");
    status.className = `alert alert-${type}`;
    status.innerText = message;
    status.classList.remove("d-none");
}
