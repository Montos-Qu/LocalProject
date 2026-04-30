let web3;
let contract;
let account;
let adminContract;
let issuerContractAddress;
let uploadedFileRecord = null;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function init() {
    web3 = new Web3("http://127.0.0.1:7545");
    const accounts = await web3.eth.getAccounts();
    account = localStorage.getItem("walletAddress") || accounts[0];

    document.getElementById("accountAddress").innerHTML = `Connected: ${account}`;

    const adminJson = await fetch("./contracts/Admin.json").then(res => res.json());
    const issuerJson = await fetch("./contracts/Issuer.json").then(res => res.json());
    const networkId = Object.keys(adminJson.networks)[0];

    adminContract = new web3.eth.Contract(adminJson.abi, adminJson.networks[networkId].address);
    issuerContractAddress = await adminContract.methods.wallet_to_issuer_map(account).call();

    if (issuerContractAddress === ZERO_ADDRESS) {
        alert("This wallet is not registered as an issuer.");
        window.location.href = "index.html";
        return;
    }

    contract = new web3.eth.Contract(issuerJson.abi, issuerContractAddress);
    await loadIssuerInfo();
    await loadIssuedCredentials();
}

window.onload = init;

async function loadIssuerInfo() {
    const info = await contract.methods.getIssuerInfo().call();
    document.getElementById("accountAddress").innerHTML =
        `Connected: ${account}<br>Issuer: ${info[1]}<br>Contract: ${issuerContractAddress}`;
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

async function handleFileUpload() {
    try {
        const file = document.getElementById("documentFile").files[0];
        if (!file) {
            showStatus("Please choose a PDF file first.", "danger");
            return;
        }

        const documentHash = await hashPdfFile(file);
        document.getElementById("documentHash").value = documentHash;
        document.getElementById("uploadedFileInfo").innerText = `${file.name} | SHA-256: ${documentHash}`;

        uploadedFileRecord = {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileData: await fileToBase64(file),
            documentHash
        };

        showStatus("File uploaded and hash generated.", "success");
    } catch (error) {
        console.error(error);
        showStatus(error.message || "File upload failed.", "danger");
    }
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
        if (!/^0x[a-fA-F0-9]{64}$/.test(documentHash)) {
            showStatus("Upload a PDF to generate a valid document hash.", "danger");
            return;
        }

        showStatus("Issuing credential...", "info");
        const receipt = await contract.methods
            .IssueCredential(userAddress, credentialType, documentHash)
            .send({ from: account, gas: 6000000 });

        const eventData = receipt.events?.CredentialIssued?.returnValues;
        const credentialId = eventData?.credentialId || eventData?.[0];

        const studentAddress = await adminContract.methods.wallet_to_student_map(userAddress).call();
        if (studentAddress !== ZERO_ADDRESS && credentialId) {
            const studentJson = await fetch("./contracts/Student.json").then(res => res.json());
            const studentContract = new web3.eth.Contract(studentJson.abi, studentAddress);
            await studentContract.methods.addCredential(credentialId).send({ from: account, gas: 300000 });
        }

        if (uploadedFileRecord && credentialId) {
            saveCredentialFileOffChain(credentialId, uploadedFileRecord);
        }

        showStatus(`Credential issued successfully. Credential ID: ${credentialId}`, "success");
        document.getElementById("userAddress").value = "";
        document.getElementById("credentialType").value = "";
        document.getElementById("documentHash").value = "";
        document.getElementById("documentFile").value = "";
        document.getElementById("uploadedFileInfo").innerText = "";
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

    if ($.fn.DataTable.isDataTable("#issued_credential_table")) {
        $("#issued_credential_table").DataTable().destroy();
    }

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
                <td>${cred.isRevoked ? `<span class="btn btn-danger">Revoked</span>` : `<span class="btn btn-success">Active</span>`}</td>
                <td>${new Date(Number(cred.issuedAt) * 1000).toLocaleString()}</td>
                <td>${fileRecord ? `<button class="btn btn-sm btn-info" onclick="downloadStoredFile(${i})"><i class="fa-solid fa-download"></i></button>` : "No file"}</td>
            `;
            tableBody.appendChild(row);
        } catch (error) {
            console.warn(`Could not load credential ${i}`, error);
        }
    }

    if (!found) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center">No credentials issued by this account.</td></tr>`;
    }

    $("#issued_credential_table").DataTable();
}

async function revokeCredential() {
    try {
        const credentialId = document.getElementById("credentialIdRevoke").value.trim();
        if (!credentialId || Number(credentialId) <= 0) {
            showStatus("Enter a valid credential ID.", "danger");
            return;
        }

        await contract.methods.RevokeCredential(credentialId).send({ from: account, gas: 300000 });
        showStatus(`Credential ${credentialId} revoked successfully.`, "success");
        document.getElementById("credentialIdRevoke").value = "";
        await loadIssuedCredentials();
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

        await contract.methods.RestoreCredential(credentialId).send({ from: account, gas: 300000 });
        showStatus(`Credential ${credentialId} restored successfully.`, "success");
        document.getElementById("credentialIdRevoke").value = "";
        await loadIssuedCredentials();
    } catch (error) {
        console.error(error);
        showStatus(`Restore failed: ${getErrorMessage(error)}`, "danger");
    }
}

function saveCredentialFileOffChain(credentialId, fileRecord) {
    localStorage.setItem(`issuer_file_${issuerContractAddress}_${credentialId}`, JSON.stringify(fileRecord));
}

function getCredentialFileOffChain(credentialId) {
    const stored = localStorage.getItem(`issuer_file_${issuerContractAddress}_${credentialId}`);
    return stored ? JSON.parse(stored) : null;
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

function showStatus(message, type) {
    const status = document.getElementById("statusMessage");
    status.className = `alert alert-${type}`;
    status.innerText = message;
    status.classList.remove("d-none");
}

function getErrorMessage(error) {
    return error?.message || String(error);
}
