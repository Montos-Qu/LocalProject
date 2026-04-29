let web3;
let contract;
let account;

let adminAbi;
let studentAbi;
let issuerAbi;
let verifierAbi;

async function init() {
    web3 = new Web3("http://127.0.0.1:7545");

    const accounts = await web3.eth.getAccounts();
    account = localStorage.getItem("walletAddress") || accounts[0];

    document.getElementById("accountAddress").innerHTML =
        `Connected: ${account}`;

    const adminJson = await fetch("./contracts/Admin.json").then(res => res.json());
    const studentJson = await fetch("./contracts/Student.json").then(res => res.json());
    const issuerJson = await fetch("./contracts/Issuer.json").then(res => res.json());
    const verifierJson = await fetch("./contracts/Verifier.json").then(res => res.json());

    adminAbi = adminJson.abi;
    studentAbi = studentJson.abi;
    issuerAbi = issuerJson.abi;
    verifierAbi = verifierJson.abi;

    const networkId = Object.keys(adminJson.networks)[0];
    const address = adminJson.networks[networkId].address;

    contract = new web3.eth.Contract(adminAbi, address);

    await loadRegisteredUsers();
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

        const gas = await contract.methods
            .addUserAccount(userAddress, name, accountType)
            .estimateGas({ from: account });

        await contract.methods
            .addUserAccount(userAddress, name, accountType)
            .send({ from: account, gas: gas + 100000 });

        alert("User added successfully!");

        document.getElementById("userAddress").value = '';
        document.getElementById("username").value = '';
        document.getElementById("accountType").value = '';

        const modalEl = document.getElementById('addUserModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        await loadRegisteredUsers();

    } catch (error) {
        console.error(error);
        alert("Failed to add user. Check console.");
    }
}

async function loadRegisteredUsers() {
    const users = [];

    const studentCount = await contract.methods.getStudentCount().call();
    const issuerCount = await contract.methods.getIssuerCount().call();
    const verifierCount = await contract.methods.getVerifierCount().call();

    for (let i = 0; i < studentCount; i++) {
        const wallet = await contract.methods.registered_students(i).call();
        const childAddress = await contract.methods.wallet_to_student_map(wallet).call();

        const studentContract = new web3.eth.Contract(studentAbi, childAddress);
        const info = await studentContract.methods.getStudentInfo().call();

        users.push({
            wallet,
            name: info[1],
            role: "Student",
            index: i
        });
    }

    for (let i = 0; i < issuerCount; i++) {
        const wallet = await contract.methods.approved_issuers(i).call();
        const childAddress = await contract.methods.wallet_to_issuer_map(wallet).call();

        const issuerContract = new web3.eth.Contract(issuerAbi, childAddress);
        const info = await issuerContract.methods.getIssuerInfo().call();

        users.push({
            wallet,
            name: info[1],
            role: "Issuer",
            index: i
        });
    }

    for (let i = 0; i < verifierCount; i++) {
        const wallet = await contract.methods.verifiers(i).call();
        const childAddress = await contract.methods.wallet_to_verifier_map(wallet).call();

        const verifierContract = new web3.eth.Contract(verifierAbi, childAddress);
        const info = await verifierContract.methods.getIssuerInfo().call();

        users.push({
            wallet,
            name: info[1],
            role: "Verifier",
            index: i
        });
    }

    renderUsersTable(users);
}

function renderUsersTable(users) {
    if ($.fn.DataTable.isDataTable("#usersTable")) {
        $("#usersTable").DataTable().destroy();
    }

    const tbody = document.querySelector("#usersTable tbody");
    tbody.innerHTML = "";

    users.forEach(user => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${user.wallet}</td>
            <td>${user.name}</td>
            <td>${user.role}</td>
            <td>
                <button 
                    class="btn btn-danger btn-sm"
                    onclick="removeUser('${user.role}', ${user.index}, '${user.wallet}')">
                    Remove
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    $("#usersTable").DataTable();
}

async function removeUser(role, index, wallet) {
    try {
        const confirmDelete = confirm(`Remove ${role}: ${wallet}?`);

        if (!confirmDelete) {
            return;
        }

        let method;

        if (role === "Student") {
            method = contract.methods.removeStudent(index, wallet);
        } else if (role === "Issuer") {
            method = contract.methods.removeIssuer(index, wallet);
        } else if (role === "Verifier") {
            method = contract.methods.removeVerifier(index, wallet);
        }

        const gas = await method.estimateGas({ from: account });

        await method.send({
            from: account,
            gas: gas + 100000
        });

        alert(`${role} removed successfully!`);

        await loadRegisteredUsers();

    } catch (error) {
        console.error(error);
        alert("Failed to remove user. Check console.");
    }
}