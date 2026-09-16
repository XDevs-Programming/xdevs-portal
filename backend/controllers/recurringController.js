const Stripe = require("stripe");
const mongoose = require("mongoose");
const crypto = require("crypto");
const RecurringContract = require("../models/RecurringContract");
const Commission = require("../models/Commission");
const Notification = require("../models/Notification");
const User = require("../models/User");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const frontendUrl = () => process.env.FRONTEND_URL.split(",")[0].trim().replace(/\/+$/, "");

async function notifyAdmins(title, message, metadata = {}) {
  const admins = await User.find({ role: "admin" }).select("_id");
  if (!admins.length) return;
  await Notification.insertMany(admins.map((admin) => ({
    recipient: admin._id, type: "general", title, message,
    link: "/pages/dashboard/admin.html#recurring", metadata
  })));
}


function agreementText(contract, clientName) {
  const price = (contract.amount / 100).toFixed(2);
  const period = contract.interval === "year" ? "year" : "month";
  return `XDEVS PROGRAMMING — MAINTENANCE & HOSTING AGREEMENT
Agreement reference: ${contract._id}
Client: ${clientName}
Service: ${contract.name}
Fee: £${price} per ${period}

1. SERVICES
XDevs Programming ("XDevs") will provide the maintenance and/or hosting service described below:
${contract.description || "Maintenance and/or hosting services agreed for this recurring service."}
Work outside this scope, including major redesigns, new functionality or substantial alterations, may be quoted separately.

2. SERVICE STANDARD
XDevs will provide the services with reasonable care and skill. Planned maintenance or circumstances outside XDevs' reasonable control may occasionally affect availability.

3. FEES AND RECURRING PAYMENTS
The Client agrees to pay £${price} every ${period}. Recurring payments are processed securely by Stripe. XDevs does not directly store the Client's card or bank-account payment details.

4. FAILED PAYMENTS
If a recurring payment fails, XDevs may allow a reasonable opportunity for payment to be brought up to date. Included services may be suspended after reasonable notice while payment remains outstanding.

5. CLIENT RESPONSIBILITIES
The Client must provide information and access reasonably required for XDevs to maintain the service and must not knowingly use the service for unlawful purposes.

6. THIRD-PARTY SERVICES
The project may depend on third-party providers. XDevs is not responsible for failures caused solely by a provider outside its reasonable control, although reasonable assistance will be provided where an included service is affected.

7. CANCELLATION
This Agreement continues on a rolling basis until cancelled. The Client may request cancellation through the XDevs Client Portal or by contacting XDevs. XDevs processes the actual cancellation. Unless otherwise agreed, cancellation normally takes effect at the end of the current paid billing period. Nothing here limits rights available under applicable law.

8. REFUNDS
Fees already paid generally cover the relevant billing period. Any refund required by law, or agreed where paid services cannot be provided, will be handled appropriately.

9. CHANGES
XDevs will notify the Client in advance of material changes to the recurring price or service and provide a reasonable opportunity to decide whether to continue.

10. OWNERSHIP
This Agreement does not change ownership or licensing arrangements established for the original commissioned project.

11. DATA AND PRIVACY
Personal information will be handled in accordance with the XDevs Privacy Policy and applicable data-protection requirements.

12. LIABILITY
Nothing in this Agreement excludes or restricts liability where doing so would be unlawful.

13. ACCEPTANCE
By electronically accepting this Agreement, the Client confirms that they have been shown the recurring price, billing frequency, included service and cancellation arrangements before recurring payment setup.`;
}

async function getAgreement(req, res) {
  const contract = await RecurringContract.findOne({ _id: req.params.id, client: req.user._id });
  if (!contract) return res.status(404).json({ success:false, message:"Recurring service not found." });
  const snapshot = contract.agreementSnapshot || agreementText(contract, req.user.username || req.user.email);
  res.json({ success:true, snapshot, version:contract.agreementVersion, accepted:contract.agreementAccepted,
    acceptedName:contract.agreementAcceptedName, acceptedAt:contract.agreementAcceptedAt });
}

async function acceptAgreement(req, res) {
  const legalName=String(req.body.legalName||"").trim();
  if (legalName.length < 2 || req.body.confirmTerms !== true || req.body.confirmRecurring !== true)
    return res.status(400).json({ success:false, message:"Enter your legal name and confirm both statements." });
  const contract=await RecurringContract.findOne({ _id:req.params.id, client:req.user._id });
  if (!contract) return res.status(404).json({ success:false, message:"Recurring service not found." });
  if (contract.agreementAccepted) return res.status(409).json({ success:false, message:"This agreement has already been accepted." });
  const snapshot=agreementText(contract, req.user.username || req.user.email);
  contract.agreementSnapshot=snapshot;
  contract.agreementHash=crypto.createHash("sha256").update(snapshot).digest("hex");
  contract.agreementAccepted=true;
  contract.agreementAcceptedName=legalName;
  contract.agreementAcceptedAt=new Date();
  contract.agreementAcceptedIp=String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();
  contract.agreementAcceptedUserAgent=String(req.headers["user-agent"]||"").slice(0,500);
  await contract.save();
  res.json({ success:true, message:"Agreement accepted electronically.", acceptedAt:contract.agreementAcceptedAt });
}

async function createContract(req, res) {
  const { commissionId, name, description, amount, interval } = req.body;
  if (!validId(commissionId)) return res.status(400).json({ success: false, message: "Choose a valid commission." });
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0.5 || numericAmount > 100000) {
    return res.status(400).json({ success: false, message: "Recurring amount must be between £0.50 and £100,000." });
  }
  if (!String(name || "").trim()) return res.status(400).json({ success: false, message: "Service name is required." });
  if (!["month", "year"].includes(interval)) return res.status(400).json({ success: false, message: "Billing interval must be monthly or yearly." });

  const commission = await Commission.findById(commissionId).populate("client", "username email");
  if (!commission) return res.status(404).json({ success: false, message: "Commission not found." });

  const contract = await RecurringContract.create({
    client: commission.client._id,
    commission: commission._id,
    name: String(name).trim(),
    description: String(description || "").trim(),
    amount: Math.round(numericAmount * 100),
    currency: "gbp",
    interval
  });
  await contract.populate([{ path: "client", select: "username email avatar" }, { path: "commission", select: "title status category" }]);
  res.status(201).json({ success: true, contract });
}

async function getMine(req, res) {
  const contracts = await RecurringContract.find({ client: req.user._id }).populate("commission", "title status category").sort({ createdAt: -1 });
  res.json({ success: true, contracts });
}

async function getAll(req, res) {
  const contracts = await RecurringContract.find().populate("client", "username email avatar").populate("commission", "title status category").sort({ createdAt: -1 });
  res.json({ success: true, contracts });
}

async function startSetup(req, res) {
  const contract = await RecurringContract.findById(req.params.id).populate("client", "username email").populate("commission", "title");
  if (!contract) return res.status(404).json({ success: false, message: "Recurring service not found." });
  if (contract.client._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You cannot set up this service." });
  if (!contract.agreementAccepted) return res.status(409).json({ success: false, message: "Review and accept the service agreement before setting up recurring payment." });
  if (contract.stripeSubscriptionId || !["awaiting_setup", "incomplete"].includes(contract.status)) return res.status(409).json({ success: false, message: "This recurring service has already been set up." });

  const base = frontendUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: contract.client.email,
    client_reference_id: contract._id.toString(),
    metadata: { recurringContractId: contract._id.toString(), clientId: contract.client._id.toString() },
    subscription_data: { metadata: { recurringContractId: contract._id.toString(), clientId: contract.client._id.toString() } },
    line_items: [{ quantity: 1, price_data: {
      currency: contract.currency,
      unit_amount: contract.amount,
      recurring: { interval: contract.interval },
      product_data: { name: contract.name, description: contract.description || `XDevs recurring service for ${contract.commission.title}` }
    }}],
    success_url: `${base}/pages/dashboard/client.html?recurring=success#recurring`,
    cancel_url: `${base}/pages/dashboard/client.html?recurring=cancelled#recurring`
  });
  contract.stripeCheckoutSessionId = session.id;
  await contract.save();
  res.json({ success: true, checkoutUrl: session.url });
}

async function requestCancellation(req, res) {
  const contract = await RecurringContract.findOne({ _id: req.params.id, client: req.user._id });
  if (!contract) return res.status(404).json({ success: false, message: "Recurring service not found." });
  if (!["active", "past_due"].includes(contract.status)) return res.status(409).json({ success: false, message: "A cancellation request cannot be submitted for this service right now." });
  contract.status = "cancellation_requested";
  contract.cancellationRequestedAt = new Date();
  contract.cancellationReason = String(req.body.reason || "").trim().slice(0, 1000);
  await contract.save();
  await notifyAdmins("Cancellation requested", `${req.user.username || "A client"} requested cancellation of ${contract.name}.`, { recurringContractId: contract._id.toString() });
  res.json({ success: true, contract });
}

async function cancelContract(req, res) {
  const contract = await RecurringContract.findById(req.params.id);
  if (!contract) return res.status(404).json({ success: false, message: "Recurring service not found." });
  if (!contract.stripeSubscriptionId) {
    if (contract.status === "awaiting_setup" || contract.status === "incomplete") {
      contract.status = "cancelled";
      contract.cancelledAt = new Date();
      await contract.save();
      return res.json({ success: true, contract });
    }
    return res.status(409).json({ success: false, message: "No Stripe subscription is attached to this service." });
  }
  if (["cancelled"].includes(contract.status)) return res.status(409).json({ success: false, message: "This service is already cancelled." });

  const mode = req.body.mode === "immediate" ? "immediate" : "period_end";
  if (mode === "immediate") {
    await stripe.subscriptions.cancel(contract.stripeSubscriptionId);
    contract.status = "cancelled";
    contract.cancelAtPeriodEnd = false;
    contract.cancelledAt = new Date();
  } else {
    const subscription = await stripe.subscriptions.update(contract.stripeSubscriptionId, { cancel_at_period_end: true });
    contract.status = "cancelling";
    contract.cancelAtPeriodEnd = true;
    contract.currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : contract.currentPeriodEnd;
    contract.cancellationScheduledAt = new Date();
  }
  await contract.save();
  res.json({ success: true, contract });
}

async function declineCancellation(req, res) {
  const contract = await RecurringContract.findById(req.params.id);
  if (!contract) return res.status(404).json({ success: false, message: "Recurring service not found." });
  if (contract.status !== "cancellation_requested") return res.status(409).json({ success: false, message: "There is no pending cancellation request." });
  contract.status = "active";
  contract.cancellationRequestedAt = null;
  contract.cancellationReason = "";
  await contract.save();
  res.json({ success: true, contract });
}

module.exports = { createContract, getMine, getAll, getAgreement, acceptAgreement, startSetup, requestCancellation, cancelContract, declineCancellation };
