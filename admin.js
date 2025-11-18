// ==== Admin Dashboard Logic ====

let web3;
let contract;
let adminAccount;

// ==== Connect MetaMask ====
async function connectMetaMask() {
  const connectButton = document.getElementById("connectButton");
  if (typeof window.ethereum === "undefined") {
    showMessage("Please install MetaMask.", "error");
    connectButton.innerText = "MetaMask Not Found";
    return;
  }

  try {
    connectButton.innerText = "Connecting...";
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    adminAccount = accounts[0];
    web3 = new Web3(window.ethereum);
    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    console.log("Admin account:", adminAccount);
    console.log("Contract address:", CONTRACT_ADDRESS);

    // ✅ Try 'insurer', fall back to 'owner' if not found
    let insurer;
    try {
      insurer = await contract.methods.insurer().call();
    } catch {
      try {
        insurer = await contract.methods.owner().call();
      } catch {
        showMessage("Contract missing 'insurer' or 'owner' method.", "error");
        connectButton.innerText = "Invalid Contract";
        return;
      }
    }
    console.log("Insurer address from contract:", insurer);
    if (insurer.toLowerCase() !== adminAccount.toLowerCase()) {
      showMessage("Access denied: not insurer account.", "error");
      connectButton.innerText = "Access Denied";
      return;
    }
    connectButton.innerText = `Admin: ${adminAccount.slice(0, 6)}...${adminAccount.slice(-4)}`;
    showMessage("Admin connected successfully!", "success");
  } catch (err) {
    console.error("Connection Error:", err);
    showMessage("Failed to connect wallet.", "error");
    connectButton.innerText = "Connect Wallet";
  }
}

// ==== Issue Policy ====
async function issuePolicy() {
  const holder = document.getElementById("holderAddr").value.trim();
  const premium = document.getElementById("issuePremium").value.trim();
  const coverage = document.getElementById("issueCoverage").value.trim();
  const duration = document.getElementById("issueDuration").value.trim();
  if (!holder || !premium || !coverage || !duration) {
    return showMessage("Please fill all fields.", "error");
  }

  try {
    const premiumWei = web3.utils.toWei(premium, "ether");
    const coverageWei = web3.utils.toWei(coverage, "ether");

    const nextId = await contract.methods.nextPolicyId().call();

    const receipt = await contract.methods
      .issuePolicy(holder, premiumWei, coverageWei, duration)
      .send({ from: adminAccount });

    // ✅ If event emitted, capture it
    const event = receipt.events?.PolicyIssued?.returnValues;
    if (event) {
      showMessage(
        `✅ Policy #${event.policyId} issued for ${event.holder} | Premium: ${premium} ETH | Coverage: ${coverage} ETH`,
        "success"
      );
    } else {
      showMessage(
        `✅ Policy #${nextId} issued for ${holder} | Premium: ${premium} ETH | Coverage: ${coverage} ETH`,
        "success"
      );
    }
  } catch (err) {
    console.error(err);
    showMessage("❌ Error issuing policy: " + err.message, "error");
  }
}

// ==== Approve Claim ====
async function approveClaim() {
  const claimId = document.getElementById("claimIdApprove").value.trim();
  if (!claimId) return showMessage("Enter claim ID.", "error");

  try {
    // ✅ Get policyId for clarity before sending tx
    const claim = await contract.methods.claims(claimId).call();
    const policyId = claim.policyId || claim.policyID || "unknown";

    const receipt = await contract.methods.approveClaim(claimId).send({ from: adminAccount });

    const event = receipt.events?.ClaimApproved?.returnValues;
    if (event) {
      showMessage(`✅ Claim #${event.claimId} approved for Policy #${event.policyId || policyId}`, "success");
    } else {
      showMessage(`✅ Claim #${claimId} approved for Policy #${policyId}`, "success");
    }
  } catch (err) {
    console.error(err);
    showMessage("❌ Approval failed: " + err.message, "error");
  }
}

// ==== Pay Claim ====
async function payClaim() {
  const claimId = document.getElementById("claimIdPay").value.trim();
  if (!claimId) return showMessage("Enter claim ID.", "error");

  try {
    // ✅ Get policyId for display
    const claim = await contract.methods.claims(claimId).call();
    const policyId = claim.policyId || claim.policyID || "unknown";

    const receipt = await contract.methods.payClaim(claimId).send({ from: adminAccount });

    const event = receipt.events?.ClaimPaid?.returnValues;
    if (event) {
      showMessage(`💸 Claim #${event.claimId} paid successfully for Policy #${event.policyId || policyId}`, "success");
    } else {
      showMessage(`💸 Claim #${claimId} paid successfully for Policy #${policyId}`, "success");
    }
  } catch (err) {
    console.error(err);
    showMessage("❌ Payment failed: " + err.message, "error");
  }
}

// ==== Fund Contract ====
async function fundContract() {
  const amount = document.getElementById("fundAmountEth").value.trim();
  if (!amount) return showMessage("Enter amount to fund.", "error");

  try {
    await contract.methods.fundContract().send({
      from: adminAccount,
      value: web3.utils.toWei(amount, "ether"),
    });
    showMessage(`💰 Contract funded with ${amount} ETH`, "success");
  } catch (err) {
    console.error(err);
    showMessage("❌ Funding failed: " + err.message, "error");
  }
}

// ==== Utility ====
function showMessage(message, type) {
  const logBox = document.getElementById("adminActivity");
  const entry = document.createElement("div");
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  entry.className = type === "error" ? "text-red-600" : "text-green-600";
  logBox.prepend(entry);
}

// ==== Event Listeners ====
document.getElementById("connectButton").addEventListener("click", connectMetaMask);
document.getElementById("issuePolicyBtn").addEventListener("click", issuePolicy);
document.getElementById("approveClaimBtn").addEventListener("click", approveClaim);
document.getElementById("payClaimBtn").addEventListener("click", payClaim);
document.getElementById("fundContractBtn").addEventListener("click", fundContract);

// ==== Refresh Submitted Claims ====
async function refreshClaims() {
  if (!contract || !adminAccount) {
    return showMessage("⚠️ Please connect wallet first.", "error");
  }

  showMessage("🔄 Refreshing submitted claims...", "success");

  try {
    const nextClaimId = await contract.methods.nextClaimId().call();
    const tableBody = document.querySelector("#claimsTableBody");
    tableBody.innerHTML = ""; // Clear old data

    if (nextClaimId == 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-2">No claims found</td></tr>`;
      return;
    }

    // Use <table class="table-fixed w-full text-sm"> in HTML for consistent layout

    for (let i = 0; i <=nextClaimId; i++) {
      const c = await contract.methods.claims(i).call();
      if (c.claimant === "0x0000000000000000000000000000000000000000") continue;

      const approved = c.approved ? "✅" : "❌";
      const paid = c.paid ? "💸" : "❌";

      // Each <td> now uses tighter, uniform spacing and font style
      const row = `
        <tr class="border-t hover:bg-gray-50 transition">
          <td class="py-2 text-center whitespace-nowrap w-[10%]">${c.id}</td>
          <td class="py-2 text-center whitespace-nowrap w-[10%]">${c.policyId}</td>
          <td class="py-2 text-center whitespace-nowrap w-[30%]">${c.claimant.slice(0, 6)}...${c.claimant.slice(-4)}</td>
          <td class="py-2 text-center whitespace-nowrap w-[20%]">${web3.utils.fromWei(c.amount)} ETH</td>
          <td class="py-2 text-center whitespace-nowrap w-[15%]">${approved}</td>
          <td class="py-2 text-center whitespace-nowrap w-[15%]">${paid}</td>
        </tr>
      `;
      tableBody.insertAdjacentHTML("beforeend", row);
    }

    showMessage("✅ Claims refreshed successfully!", "success");
  } catch (err) {
    console.error(err);
    showMessage("❌ Error loading claims: " + err.message, "error");
  }
}

// ==== Attach to Refresh Button ====
document.getElementById("refreshClaimsBtn").addEventListener("click", refreshClaims);
