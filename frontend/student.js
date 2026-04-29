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
    const panel = document.getElementById("studentInfo");
    if (panel) {
        panel.innerText = `Student: ${info[1]}\nWallet: ${info[0]}\nStudent contract: ${studentAddress}\nCredential IDs: ${info[2].length ? info[2].join(", ") : "none"}`;
    }
}

async function viewCredential() {
    try {
        const issuerContractAddress = document.getElementById("issuerContractAddress").value.trim();
        const id = document.getElementById("credentialIdLookup").value;

        if (!web3.utils.isAddress(issuerContractAddress)) {
            alert("Issuer contract address is required.");
            return;
        }
        if (!id) {
            alert("Credential ID is required.");
            return;
        }

        const issuerArtifact = await loadArtifact("Issuer");
        const issuerContract = new web3.eth.Contract(issuerArtifact.abi, issuerContractAddress);
        const data = await issuerContract.methods.GetCredential(id).call();

        const credential = {
            issuer: data.issuer,
            student: data.user,
            credentialType: data.credentialType,
            documentHash: data.documentHash,
            isRevoked: data.isRevoked,
            issuedAt: new Date(Number(data.issuedAt) * 1000).toLocaleString()
        };

        document.getElementById("credentialDetails").innerText = JSON.stringify(credential, null, 2);
    } catch (error) {
        console.error("View credential failed:", error);
        alert("Failed to view credential. Check issuer contract address, credential ID, and console.");
    }
}
