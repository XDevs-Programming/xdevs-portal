const Stripe = require("stripe");
const mongoose = require("mongoose");
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

module.exports = { createContract, getMine, getAll, startSetup, requestCancellation, cancelContract, declineCancellation };
