// ====== Policyholder Frontend Logic ======

let web3;
let contract;
let userAccount;

// Wait until the DOM and MetaMask are ready
window.addEventListener("DOMContentLoaded", async () => {
  const connectButton = document.getElementById("connectButton");
  const accountDisplay = document.getElementById("accountDisplay");
  const payPremiumBtn = document.getElementById("payPremiumBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const submitClaimBtn = document.getElementById("submitClaimBtn");

  // ---- 1️⃣ Check MetaMask ----
  if (typeof window.ethereum === "undefined") {
    alert("MetaMask not found! Please install MetaMask to use this DApp.");
    connectButton.textContent = "MetaMask Not Found";
    return;
  }

  web3 = new Web3(window.ethereum);

  // ---- 2️⃣ Connect Wallet ----
  connectButton.addEventListener("click", async () => {
    try {
      connectButton.textContent = "Connecting...";
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      userAccount = accounts[0];
      accountDisplay.textContent = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;

      contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
      console.log("✅ Contract loaded:", contract.options.address);
      connectButton.textContent = "Connected ✅";
      logActivity("🟢 Wallet connected successfully!");
    } catch (err) {
      console.error("Connection error:", err);
      connectButton.textContent = "Connect Wallet";
      alert("Failed to connect MetaMask.");
    }
  });

  // ---- 3️⃣ Pay Premium ----
  payPremiumBtn.addEventListener("click", async () => {
    if (!contract || !userAccount) return alert("Please connect your wallet first.");
    const policyId = document.getElementById("policyIdPay").value.trim();
    const premiumEth = document.getElementById("premiumAmountEth").value.trim();
    if (!policyId || !premiumEth) return alert("Please fill all fields.");
    try {
      const amountWei = web3.utils.toWei(premiumEth, "ether");
      const receipt = await contract.methods.payPremium(policyId).send({
        from: userAccount,
        value: amountWei,
        gas: 300000,
      });
      const event = receipt.events?.PremiumPaid?.returnValues;
      if (event) {
        logActivity(`💸 Premium paid for Policy #${event.policyId} | Amount: ${premiumEth} ETH`);
      } else {
        logActivity(`💸 Premium paid for Policy #${policyId} (${premiumEth} ETH)`);
      }
    } catch (err) {
      console.error(err);
      logActivity("❌ Error paying premium: " + err.message);
    }
  });

  // ---- 4️⃣ Submit Claim ----
  submitClaimBtn.addEventListener("click", async () => {
    if (!contract || !userAccount) return alert("Please connect your wallet first.");
    const policyId = document.getElementById("policyIdClaim").value.trim();
    const amountEth = document.getElementById("claimAmountEth").value.trim();
    if (!policyId || !amountEth) return alert("Please enter claim details.");
    try {
      const amountWei = web3.utils.toWei(amountEth, "ether");
      const receipt = await contract.methods
        .submitClaim(policyId, amountWei)
        .send({ from: userAccount, gas: 300000 });
      const event = receipt.events?.ClaimSubmitted?.returnValues;
      if (event) {
        logActivity(`🧾 Claim #${event.claimId} submitted for Policy #${event.policyId} (${amountEth} ETH)`);
      } else {
        logActivity(`🧾 Claim submitted for Policy #${policyId} (${amountEth} ETH)`);
      }
      closeModal();
    } catch (err) {
      console.error(err);
      logActivity("❌ Error submitting claim: " + err.message);
    }
  });

  // ---- 5️⃣ Refresh Data (My Policies + My Claims) ----
  refreshBtn.addEventListener("click", async () => {
    if (!contract || !userAccount) return alert("Please connect your wallet first.");
    logActivity("🔄 Fetching latest policies and claims...");

    try {
      // ============ My Policies ============
      const nextPolicyId = await contract.methods.nextPolicyId().call();
      const policiesList = document.getElementById("policiesList");
      policiesList.innerHTML = "";

      for (let i = 0; i <=nextPolicyId; i++) {
        const p = await contract.methods.policies(i).call();
        if (p.holder.toLowerCase() === userAccount.toLowerCase()) {
          const active = p.active ? "✅ Active" : "❌ Inactive";
          const item = `
            <li class="border rounded-md p-3 flex justify-between items-center">
              <div>
                <p class="font-medium">Policy #${p.id}</p>
                <p class="text-sm text-gray-500">Coverage: ${web3.utils.fromWei(p.coverage)} ETH</p>
                <p class="text-sm text-gray-500">Premium: ${web3.utils.fromWei(p.premium)} ETH</p>
              </div>
              <span class="text-xs">${active}</span>
            </li>`;
          policiesList.insertAdjacentHTML("beforeend", item);
        }
      }

      // ============ My Claims ============
      const nextClaimId = await contract.methods.nextClaimId().call();
      const claimsList = document.getElementById("claimsList");
      claimsList.innerHTML = "";

      for (let i = 0; i <=nextClaimId; i++) {
        const c = await contract.methods.claims(i).call();
        const p = await contract.methods.policies(c.policyId).call();

        if (p.holder.toLowerCase() === userAccount.toLowerCase()) {
          let status = "🕓 Pending";
          if (c.approved && !c.paid) status = "✅ Approved, Awaiting Payment";
          if (c.paid) status = "💸 Paid";

          const item = `
            <li class="border rounded-md p-3 flex justify-between items-center">
              <div>
                <p class="font-medium">Claim #${c.id} (Policy #${c.policyId})</p>
                <p class="text-sm text-gray-500">Amount: ${web3.utils.fromWei(c.amount)} ETH</p>
                <p class="text-xs text-gray-400">${status}</p>
              </div>
            </li>`;
          claimsList.insertAdjacentHTML("beforeend", item);
        }
      }

      logActivity("✅ Policies and Claims refreshed successfully.");
    } catch (err) {
      console.error(err);
      logActivity("❌ Error fetching data: " + err.message);
    }
  });

  // ---- 6️⃣ Utility: Log Activity ----
  function logActivity(msg) {
    const log = document.getElementById("activityLog");
    const time = new Date().toLocaleTimeString();
    const entry = `<div>[${time}] ${msg}</div>`;
    log.insertAdjacentHTML("afterbegin", entry);
  }

  function closeModal() {
    const modal = document.getElementById("claimModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
});
