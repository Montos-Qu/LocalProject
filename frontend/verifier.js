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
        const panel = document.getElementById("verifierInfo");
        if (panel) {
            panel.innerText = `Verifier: ${info[1]}\nWallet: ${info[0]}\nVerifier contract: ${verifierAddress}`;
        }
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
        const hash = document.getElementById("documentHash").value.trim();

        if (!web3.utils.isAddress(issuerContractAddress)) {
            alert("Issuer contract address is required.");
            return;
        }
        if (!id) {
            alert("Credential ID is required.");
            return;
        }
        if (!web3.utils.isHexStrict(hash) || hash.length !== 66) {
            alert("Document hash must be a bytes32 hex value.");
            return;
        }

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
            documentHash: data.documentHash,
            issuedAt: new Date(Number(data.issuedAt) * 1000).toLocaleString()
        };

        document.getElementById("credentialDetails").innerText = JSON.stringify(result, null, 2);
    } catch (error) {
        console.error("Verify credential failed:", error);
        alert("Failed to verify credential. Check inputs and console.");
    }
}
