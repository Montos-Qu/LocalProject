let web3;
let contract;
let account;

let adminContract;
let adminAbi;
let issuerAbi;

let uploadedFileRecord = null;
let issuerContractAddress = null;

async function init() {
    web3 = new Web3("http://127.0.0.1:7545");

    const accounts = await web3.eth.getAccounts();
    account = localStorage.getItem("walletAddress") || accounts[0];

    document.getElementById("accountAddress").innerHTML =
        `Connected: ${account}`;

    const adminJson = await fetch("./contracts/Admin.json").then(res => res.json());
    const issuerJson = await fetch("./contracts/Issuer.json").then(res => res.json());

    adminAbi = adminJson.abi;
    issuerAbi = issuerJson.abi;

    const networkId = Object.keys(adminJson.networks)[0];
    const adminAddress = adminJson.networks[networkId].address;

    adminContract = new web3.eth.Contract(adminAbi, adminAddress);

    // Get the issuer contract address created by Admin
    issuerContractAddress = await adminContract.methods
                                                .wallet_to_issuer_map(account)
                                                .call();

    if (issuerContractAddress === "0x0000000000000000000000000000000000000000") {
        alert("This wallet does not have an Issuer contract yet.");
        return;
    }

    contract = new web3.eth.Contract(issuerAbi, issuerContractAddress);

    await loadIssuedCredentials();

    console.log("Admin contract:", adminContract);
    console.log("Issuer contract address:", issuerContractAddress);
    console.log("Issuer contract:", contract);
}

window.onload = init;

async function loadIssuerInfo() {
    try {
        const info = await contract.methods.getIssuerInfo().call();

        document.getElementById("issuerInfo").innerText =
            `Issuer Wallet: ${info[0]} | Issuer Name: ${info[1]}`;
    } catch (error) {
        console.warn("Could not load issuer info:", error);
    }
}

async function handleFileUpload() {
    const fileInput = document.getElementById("documentFile");
    const file = fileInput.files[0];

    if (!file) {
        showStatus("Please choose a PDF or TXT file first.", "danger");
        return;
    }

    const allowedTypes = ["application/pdf", "text/plain"];

    if (!allowedTypes.includes(file.type)) {
        showStatus("Only PDF and TXT files are allowed.", "danger");
        return;
    }

    const arrayBuffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const documentHash = "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    document.getElementById("documentHash").value = documentHash;

    const base64File = await fileToBase64(file);

    uploadedFileRecord = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64File,
        documentHash: documentHash
    };

    showStatus("File uploaded and hash generated.", "success");
}

async function issueCredential() {
    try {
        const userAddress = document.getElementById("userAddress").value.trim();
        const credentialType = document.getElementById("credentialType").value.trim();
        const documentHash = document.getElementById("documentHash").value.trim();

        if (!web3.utils.isAddress(userAddress)) {
            showStatus("Invalid student wallet address.", "danger");
            return;
        }

        if (!credentialType) {
            showStatus("Credential type is required.", "danger");
            return;
        }

        if (!isValidBytes32(documentHash)) {
            showStatus("Document hash must be a valid bytes32 value. It should start with 0x and contain 64 hex characters.", "danger");
            return;
        }

        showStatus("Issuing credential...", "info");

        const receipt = await contract.methods
            .IssueCredential(userAddress, credentialType, documentHash)
            .send({ 
                from: account,
                gas: 500000 // Gas limit
            });

        const eventData = receipt.events?.CredentialIssued?.returnValues;
        const credentialId = eventData?.credentialId || eventData?.[0];

        if (uploadedFileRecord) {
            saveCredentialFileOffChain(credentialId, uploadedFileRecord);
        }

        showStatus(`Credential issued successfully. Credential ID: ${credentialId}`, "success");

        document.getElementById("userAddress").value = "";
        document.getElementById("credentialType").value = "";
        document.getElementById("documentHash").value = "";
        document.getElementById("documentFile").value = "";

        uploadedFileRecord = null;

        await loadIssuedCredentials();
    } catch (error) {
        console.error(error);
        showStatus(`Issue failed: ${getErrorMessage(error)}`, "danger");
    }
}

async function loadIssuedCredentials() {
    const tableBody = document.getElementById("issuedCredentialsTableBody");
    tableBody.innerHTML = "";

    const count = await contract.methods.credentialCount().call();

    let found = false;

    for (let i = 1; i <= count; i++) {
        try {
            const cred = await contract.methods.GetCredential(i).call();

            if (cred.issuer.toLowerCase() !== account.toLowerCase()) {
                continue;
            }

            found = true;

            const fileRecord = getCredentialFileOffChain(i);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${i}</td>
                <td>${cred.user}</td>
                <td>${cred.credentialType}</td>
                <td style="word-break: break-all;">${cred.documentHash}</td>
                <td>${
                    cred.isRevoked ? 
                        `<span class="btn btn-danger">Revoked</span>` : `<span class="btn btn-success">Active</span>`
                }</td>
                <td>${new Date(Number(cred.issuedAt) * 1000).toLocaleString()}</td>
                <td>
                    ${
                        fileRecord
                            ? `<button class="btn btn-sm btn-info" onclick="downloadStoredFile(${i})">
                                    <i class="fa-solid fa-download"></i>
                                </button>`
                            : "No file"
                    }
                </td>
            `;

            tableBody.appendChild(row);
        } catch (error) {
            console.warn(`Could not load credential ${i}`, error);
        }
    }

    $("#issued_credential_table").DataTable();

    if (!found) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No credentials issued by this account.</td>
            </tr>
        `;
    }
}

function saveCredentialFileOffChain(credentialId, fileRecord) {
    const storageKey = `issuer_file_${issuerContractAddress}_${credentialId}`;
    localStorage.setItem(storageKey, JSON.stringify(fileRecord));
}

function getCredentialFileOffChain(credentialId) {
    const storageKey = `issuer_file_${issuerContractAddress}_${credentialId}`;
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
        return null;
    }

    return JSON.parse(stored);
}

function downloadStoredFile(credentialId) {
    const fileRecord = getCredentialFileOffChain(credentialId);

    if (!fileRecord) {
        showStatus("No file found for this credential.", "danger");
        return;
    }

    const link = document.createElement("a");
    link.href = fileRecord.fileData;
    link.download = fileRecord.fileName;
    link.click();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;

        reader.readAsDataURL(file);
    });
}

async function revokeCredential() {
    try {
        const credentialId = document.getElementById("credentialIdRevoke").value.trim();

        if (!credentialId || Number(credentialId) <= 0) {
            showStatus("Enter a valid credential ID.", "danger");
            return;
        }

        showStatus("Revoking credential...", "info");

        await contract.methods
            .RevokeCredential(credentialId)
            .send({ 
                from: account,
                gas: 200000
            });

        showStatus(`Credential ${credentialId} revoked successfully.`, "success");

        document.getElementById("credentialIdRevoke").value = "";
    } catch (error) {
        console.error(error);
        showStatus(`Revoke failed: ${getErrorMessage(error)}`, "danger");
    }
}

async function restoreCredential() {
    try {
        const credentialId = document.getElementById("credentialIdRevoke").value.trim();

        if (!credentialId || Number(credentialId) <= 0) {
            showStatus("Enter a valid credential ID.", "danger");
            return;
        }

        showStatus("Restoring credential...", "info");

        await contract.methods
            .RestoreCredential(credentialId)
            .send({ 
                from: account,
                gas: 200000
            });

        showStatus(`Credential ${credentialId} restored successfully.`, "success");

        document.getElementById("credentialIdRevoke").value = "";
    } catch (error) {
        console.error(error);
        showStatus(`Restoration failed: ${getErrorMessage(error)}`, "danger");
    }
}

async function getCredential() {
    try {
        const credentialId = document.getElementById("credentialIdView").value.trim();

        if (!credentialId || Number(credentialId) <= 0) {
            showStatus("Enter a valid credential ID.", "danger");
            return;
        }

        const credential = await contract.methods.GetCredential(credentialId).call();

        const result = {
            credentialId: credentialId,
            issuer: credential.issuer,
            user: credential.user,
            credentialType: credential.credentialType,
            documentHash: credential.documentHash,
            isRevoked: credential.isRevoked,
            issuedAt: new Date(Number(credential.issuedAt) * 1000).toLocaleString()
        };

        document.getElementById("credentialResult").innerText =
            JSON.stringify(result, null, 2);

        showStatus("Credential loaded.", "success");
    } catch (error) {
        console.error(error);
        showStatus(`Could not get credential: ${getErrorMessage(error)}`, "danger");
    }
}

async function verifyCredential() {
    try {
        const credentialId = document.getElementById("credentialIdVerify").value.trim();
        const documentHash = document.getElementById("verifyDocumentHash").value.trim();

        if (!credentialId || Number(credentialId) <= 0) {
            showStatus("Enter a valid credential ID.", "danger");
            return;
        }

        if (!isValidBytes32(documentHash)) {
            showStatus("Document hash must be a valid bytes32 value.", "danger");
            return;
        }

        showStatus("Verifying credential...", "info");

        const isValid = await contract.methods
            .VerifyCredential(credentialId, documentHash)
            .call({ from: account });

        document.getElementById("verifyResult").innerHTML = isValid
            ? `<div class="alert alert-success">Credential is valid.</div>`
            : `<div class="alert alert-danger">Credential is invalid or revoked.</div>`;

        showStatus("Verification complete.", "success");
    } catch (error) {
        console.error(error);
        showStatus(`Verification failed: ${getErrorMessage(error)}`, "danger");
    }
}

function isValidBytes32(value) {
    return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function showStatus(message, type) {
    const status = document.getElementById("statusMessage");

    status.className = `alert alert-${type}`;
    status.innerText = message;
    status.classList.remove("d-none");
}

function getErrorMessage(error) {
    if (error?.message) {
        return error.message;
    }

    return String(error);
}