let web3;
let adminContract;
let studentContract;
let account;
let studentAddress;

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

        studentAddress = await adminContract.methods.wallet_to_student_map(account).call();
        if (studentAddress === ZERO_ADDRESS) {
            alert("This wallet is not registered as a student.");
            window.location.href = "index.html";
            return;
        }

        const studentArtifact = await loadArtifact("Student");
        studentContract = new web3.eth.Contract(studentArtifact.abi, studentAddress);
        await loadStudentInfo();
    } catch (error) {
        console.error("Student page failed to initialize:", error);
        alert("Unable to load student page. Check Ganache/Truffle deployment and console.");
    }
}

window.onload = init;

async function loadStudentInfo() {
    const info = await studentContract.methods.getStudentInfo().call();
    document.getElementById("studentInfo").innerText =
        `Student: ${info[1]}\nWallet: ${info[0]}\nStudent contract: ${studentAddress}\nCredential IDs: ${info[2].length ? info[2].join(", ") : "none"}`;
}

async function handleReceiptUpload() {
    try {
        const file = document.getElementById("receiptFile").files[0];
        if (!file) {
            return;
        }

        const receipt = JSON.parse(await file.text());
        if (receipt.schema !== "university-credential-receipt") {
            throw new Error("This is not a supported credential receipt file.");
        }

        document.getElementById("issuerContractAddress").value = receipt.issuerContractAddress || "";
        document.getElementById("credentialIdLookup").value = receipt.credentialId || "";
        document.getElementById("receiptInfo").innerText = `${file.name} loaded for credential #${receipt.credentialId || "unknown"}.`;
        showStatus("Receipt loaded. You can view the credential now.", "success");
    } catch (error) {
        console.error("Receipt upload failed:", error);
        showStatus(error.message || "Could not read credential receipt.", "danger");
    }
}

async function viewCredential() {
    try {
        const issuerContractAddress = document.getElementById("issuerContractAddress").value.trim();
        const id = document.getElementById("credentialIdLookup").value;

        if (!web3.utils.isAddress(issuerContractAddress)) {
            showStatus("Issuer contract address is required.", "danger");
            return;
        }
        if (!id) {
            showStatus("Credential ID is required.", "danger");
            return;
        }

        const issuerArtifact = await loadArtifact("Issuer");
        const issuerContract = new web3.eth.Contract(issuerArtifact.abi, issuerContractAddress);
        const data = await issuerContract.methods.GetCredential(id).call();

        const credential = {
            credentialId: id,
            issuerContractAddress,
            issuer: data.issuer,
            student: data.user,
            credentialType: data.credentialType,
            documentHash: data.documentHash,
            isRevoked: data.isRevoked,
            issuedAt: new Date(Number(data.issuedAt) * 1000).toLocaleString()
        };

        renderCredentialDetails(credential);
        showStatus("Credential loaded.", "success");
    } catch (error) {
        console.error("View credential failed:", error);
        showStatus("Failed to view credential. Check issuer contract address, credential ID, and console.", "danger");
    }
}

function renderCredentialDetails(credential) {
    const container = document.getElementById("credentialDetails");
    const statusClass = credential.isRevoked ? "danger" : "success";
    const statusText = credential.isRevoked ? "Revoked" : "Active";

    container.innerHTML = `
        <div class="credential-result-card">
            <div class="result-header">
                <div>
                    <div class="result-eyebrow">Credential #${credential.credentialId}</div>
                    <h4>${credential.credentialType}</h4>
                </div>
                <span class="badge text-bg-${statusClass}">${statusText}</span>
            </div>
            <div class="credential-detail-grid">
                ${renderDetailRow("Student Wallet", credential.student)}
                ${renderDetailRow("Issuer Wallet", credential.issuer)}
                ${renderDetailRow("Issuer Contract", credential.issuerContractAddress)}
                ${renderDetailRow("Document Hash", credential.documentHash)}
                ${renderDetailRow("Issued At", credential.issuedAt)}
            </div>
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
