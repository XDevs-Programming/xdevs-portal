const Stripe = require("stripe");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Commission = require("../models/Commission");
const { streamInvoice } = require("../utils/invoice");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function frontendUrl() {
  return process.env.FRONTEND_URL.split(",")[0].trim().replace(/\/+$/, "");
}

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function invoiceNumber() {
  const year = new Date().getFullYear();
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `XDEV-${year}-${unique}`;
}

async function populatedPayment(id) {
  return Payment.findById(id)
    .populate("client", "username email avatar")
    .populate("commission", "title status category");
}

async function createPaymentRequest(req, res) {
  const { commissionId, amount, description } = req.body;

  if (!validId(commissionId)) {
    return res.status(400).json({ success: false, message: "Invalid commission." });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0.5 || numericAmount > 100000) {
    return res.status(400).json({
      success: false,
      message: "Amount must be between £0.50 and £100,000. Use Pro bono for free work."
    });
  }

  const commission = await Commission.findById(commissionId);
  if (!commission) {
    return res.status(404).json({ success: false, message: "Commission not found." });
  }

  const existing = await Payment.findOne({
    commission: commission._id,
    status: { $in: ["pending", "paid", "pro_bono"] }
  });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "This commission already has an active, paid or pro bono invoice."
    });
  }

  const payment = await Payment.create({
    client: commission.client,
    commission: commission._id,
    amount: Math.round(numericAmount * 100),
    currency: "gbp",
    description: String(description || "").trim(),
    invoiceNumber: invoiceNumber(),
    invoiceIssuedAt: new Date()
  });

  await payment.populate([
    { path: "client", select: "username email avatar" },
    { path: "commission", select: "title status category" }
  ]);

  res.status(201).json({ success: true, payment });
}

async function createProBonoInvoice(req, res) {
  const { commissionId, description } = req.body;

  if (!validId(commissionId)) {
    return res.status(400).json({ success: false, message: "Invalid commission." });
  }

  const commission = await Commission.findById(commissionId);
  if (!commission) {
    return res.status(404).json({ success: false, message: "Commission not found." });
  }

  const existing = await Payment.findOne({
    commission: commission._id,
    status: { $in: ["pending", "paid", "pro_bono"] }
  });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "This commission already has an active, paid or pro bono invoice."
    });
  }

  const payment = await Payment.create({
    client: commission.client,
    commission: commission._id,
    amount: 0,
    currency: "gbp",
    description: String(description || "Pro bono programming services").trim(),
    status: "pro_bono",
    invoiceNumber: invoiceNumber(),
    invoiceIssuedAt: new Date(),
    paidAt: new Date()
  });

  await payment.populate([
    { path: "client", select: "username email avatar" },
    { path: "commission", select: "title status category" }
  ]);

  res.status(201).json({ success: true, payment });
}

async function getMyPayments(req, res) {
  const payments = await Payment.find({ client: req.user._id })
    .populate("commission", "title status category")
    .sort({ createdAt: -1 });

  res.json({ success: true, payments });
}

async function getAllPayments(req, res) {
  const payments = await Payment.find()
    .populate("client", "username email avatar")
    .populate("commission", "title status category")
    .sort({ createdAt: -1 });

  res.json({ success: true, payments });
}

async function downloadInvoice(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid invoice." });
  }

  const payment = await populatedPayment(req.params.id);
  if (!payment) {
    return res.status(404).json({ success: false, message: "Invoice not found." });
  }

  const isOwner = payment.client?._id?.toString() === req.user._id.toString();
  if (req.user.role !== "admin" && !isOwner) {
    return res.status(403).json({ success: false, message: "You cannot access this invoice." });
  }

  if (!payment.invoiceNumber) {
    payment.invoiceNumber = invoiceNumber();
    payment.invoiceIssuedAt = payment.invoiceIssuedAt || payment.createdAt || new Date();
    await payment.save();
  }

  streamInvoice(res, payment);
}

async function createCheckoutSession(req, res) {
  const payment = await Payment.findById(req.params.id)
    .populate("client", "email username")
    .populate("commission", "title");

  if (!payment) {
    return res.status(404).json({ success: false, message: "Payment request not found." });
  }

  if (payment.client._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "You cannot pay this request." });
  }

  if (payment.status === "pro_bono") {
    return res.status(409).json({ success: false, message: "This commission is pro bono. No payment is required." });
  }

  if (payment.status === "paid") {
    return res.status(409).json({ success: false, message: "This payment is already complete." });
  }

  if (payment.status !== "pending") {
    return res.status(409).json({ success: false, message: "This payment request is no longer active." });
  }

  const base = frontendUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: payment.client.email,
    client_reference_id: payment._id.toString(),
    metadata: {
      paymentId: payment._id.toString(),
      commissionId: payment.commission._id.toString(),
      clientId: payment.client._id.toString(),
      invoiceNumber: payment.invoiceNumber
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: payment.amount,
          product_data: {
            name: `XDevs commission: ${payment.commission.title}`,
            description: payment.description || "Programming commission payment"
          }
        }
      }
    ],
    success_url: `${base}/pages/dashboard/client.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pages/dashboard/client.html?payment=cancelled`
  });

  payment.stripeSessionId = session.id;
  await payment.save();

  res.json({ success: true, checkoutUrl: session.url });
}

async function cancelPaymentRequest(req, res) {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return res.status(404).json({ success: false, message: "Payment request not found." });
  }

  if (payment.status !== "pending") {
    return res.status(409).json({ success: false, message: "Only pending requests can be cancelled." });
  }

  payment.status = "cancelled";
  await payment.save();

  res.json({ success: true, payment });
}

async function stripeWebhook(req, res) {
  const signature = req.get("stripe-signature");
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
  }

  const session = event.data.object;
  const paymentId = session?.metadata?.paymentId || session?.client_reference_id;

  if (paymentId && validId(paymentId)) {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await Payment.findByIdAndUpdate(paymentId, {
        status: "paid",
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
        paidAt: new Date()
      });
    }

    if (event.type === "checkout.session.async_payment_failed") {
      await Payment.findByIdAndUpdate(paymentId, { status: "failed" });
    }

    if (event.type === "checkout.session.expired") {
      await Payment.findOneAndUpdate({ _id: paymentId, status: "pending" }, { status: "cancelled" });
    }
  }

  res.json({ received: true });
}

module.exports = {
  createPaymentRequest,
  createProBonoInvoice,
  getMyPayments,
  getAllPayments,
  downloadInvoice,
  createCheckoutSession,
  cancelPaymentRequest,
  stripeWebhook
};
