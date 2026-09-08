const Stripe = require("stripe");
const mongoose = require("mongoose");
const archiver = require("archiver");
const Payment = require("../models/Payment");
const Commission = require("../models/Commission");
const Counter = require("../models/Counter");
const { streamInvoice, createInvoiceBuffer } = require("../utils/invoice");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function frontendUrl() {
  return process.env.FRONTEND_URL.split(",")[0].trim().replace(/\/+$/, "");
}
function validId(value) { return mongoose.Types.ObjectId.isValid(value); }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(
    `invoice-${year}`,
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `INV-${year}-${String(counter.sequence).padStart(6, "0")}`;
}

function snapshotFor(commission, client) {
  return {
    clientSnapshot: {
      username: client?.username || "Client",
      email: client?.email || ""
    },
    commissionSnapshot: {
      title: commission?.title || "Programming commission",
      category: commission?.category || "Other"
    },
    companySnapshot: {
      name: process.env.INVOICE_COMPANY_NAME || "XDevs Programming",
      email: process.env.INVOICE_COMPANY_EMAIL || "",
      address: process.env.INVOICE_COMPANY_ADDRESS || ""
    }
  };
}

async function populatedPayment(id) {
  return Payment.findById(id)
    .populate("client", "username email avatar")
    .populate("commission", "title status category");
}

function invoiceFilter(req, ownerId = null) {
  const filter = ownerId ? { client: ownerId } : {};
  const { status, search, from, to } = req.query;
  if (status && status !== "all") filter.status = status;
  if (from || to) {
    filter.invoiceIssuedAt = {};
    if (from) filter.invoiceIssuedAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.invoiceIssuedAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [
      { invoiceNumber: regex },
      { "clientSnapshot.username": regex },
      { "clientSnapshot.email": regex },
      { "commissionSnapshot.title": regex },
      { description: regex }
    ];
  }
  return filter;
}

async function queryInvoices(req, ownerId = null) {
  const sort = req.query.sort === "oldest" ? 1 : -1;
  return Payment.find(invoiceFilter(req, ownerId))
    .populate("client", "username email avatar")
    .populate("commission", "title status category")
    .sort({ invoiceIssuedAt: sort, createdAt: sort });
}

async function createPaymentRequest(req, res) {
  const { commissionId, amount, description, dueDate } = req.body;
  if (!validId(commissionId)) return res.status(400).json({ success: false, message: "Invalid commission." });
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0.5 || numericAmount > 100000) {
    return res.status(400).json({ success: false, message: "Amount must be between £0.50 and £100,000. Use Pro bono for free work." });
  }
  const commission = await Commission.findById(commissionId).populate("client", "username email");
  if (!commission) return res.status(404).json({ success: false, message: "Commission not found." });
  const existing = await Payment.findOne({ commission: commission._id, status: { $in: ["pending", "paid", "pro_bono"] } });
  if (existing) return res.status(409).json({ success: false, message: "This commission already has an active, paid or pro bono invoice." });

  const payment = await Payment.create({
    client: commission.client._id,
    commission: commission._id,
    amount: Math.round(numericAmount * 100),
    currency: "gbp",
    description: String(description || "").trim(),
    invoiceNumber: await nextInvoiceNumber(),
    invoiceIssuedAt: new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    ...snapshotFor(commission, commission.client)
  });
  await payment.populate([{ path: "client", select: "username email avatar" }, { path: "commission", select: "title status category" }]);
  res.status(201).json({ success: true, payment });
}

async function createProBonoInvoice(req, res) {
  const { commissionId, description } = req.body;
  if (!validId(commissionId)) return res.status(400).json({ success: false, message: "Invalid commission." });
  const commission = await Commission.findById(commissionId).populate("client", "username email");
  if (!commission) return res.status(404).json({ success: false, message: "Commission not found." });
  const existing = await Payment.findOne({ commission: commission._id, status: { $in: ["pending", "paid", "pro_bono"] } });
  if (existing) return res.status(409).json({ success: false, message: "This commission already has an active, paid or pro bono invoice." });
  const payment = await Payment.create({
    client: commission.client._id,
    commission: commission._id,
    amount: 0,
    currency: "gbp",
    description: String(description || "Pro bono programming services").trim(),
    status: "pro_bono",
    invoiceNumber: await nextInvoiceNumber(),
    invoiceIssuedAt: new Date(),
    paidAt: new Date(),
    ...snapshotFor(commission, commission.client)
  });
  await payment.populate([{ path: "client", select: "username email avatar" }, { path: "commission", select: "title status category" }]);
  res.status(201).json({ success: true, payment });
}

async function getMyPayments(req, res) {
  const payments = await Payment.find({ client: req.user._id }).populate("commission", "title status category").sort({ createdAt: -1 });
  res.json({ success: true, payments });
}
async function getAllPayments(req, res) {
  const payments = await Payment.find().populate("client", "username email avatar").populate("commission", "title status category").sort({ createdAt: -1 });
  res.json({ success: true, payments });
}
async function getMyInvoiceArchive(req, res) {
  const invoices = await queryInvoices(req, req.user._id);
  res.json({ success: true, invoices, count: invoices.length });
}
async function getInvoiceArchive(req, res) {
  const invoices = await queryInvoices(req);
  const [summary] = await Payment.aggregate([{ $group: {
    _id: null,
    totalInvoices: { $sum: 1 },
    revenue: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
    outstanding: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } },
    proBonoCount: { $sum: { $cond: [{ $eq: ["$status", "pro_bono"] }, 1, 0] } }
  }}]);
  res.json({ success: true, invoices, count: invoices.length, summary: summary || { totalInvoices: 0, revenue: 0, outstanding: 0, proBonoCount: 0 } });
}

async function downloadInvoice(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid invoice." });
  const payment = await populatedPayment(req.params.id);
  if (!payment) return res.status(404).json({ success: false, message: "Invoice not found." });
  const isOwner = payment.client?._id?.toString() === req.user._id.toString();
  if (req.user.role !== "admin" && !isOwner) return res.status(403).json({ success: false, message: "You cannot access this invoice." });
  streamInvoice(res, payment);
}

function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
async function exportInvoiceCsv(req, res) {
  const owner = req.user.role === "admin" ? null : req.user._id;
  const invoices = await queryInvoices(req, owner);
  const rows = [["Invoice number", "Issued", "Client", "Email", "Commission", "Status", "Amount GBP", "Paid date"]];
  for (const item of invoices) rows.push([
    item.invoiceNumber,
    item.invoiceIssuedAt?.toISOString() || "",
    item.clientSnapshot?.username || item.client?.username || "",
    item.clientSnapshot?.email || item.client?.email || "",
    item.commissionSnapshot?.title || item.commission?.title || "",
    item.status,
    (item.amount / 100).toFixed(2),
    item.paidAt?.toISOString() || ""
  ]);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="xdevs-invoice-archive.csv"');
  res.send(`\uFEFF${csv}`);
}

async function exportInvoiceZip(req, res) {
  const owner = req.user.role === "admin" ? null : req.user._id;
  const invoices = await queryInvoices(req, owner);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="xdevs-invoice-archive.zip"');
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (error) => { throw error; });
  archive.pipe(res);
  for (const invoice of invoices) {
    const buffer = await createInvoiceBuffer(invoice);
    archive.append(buffer, { name: `${invoice.invoiceNumber}.pdf` });
  }
  await archive.finalize();
}

async function createCheckoutSession(req, res) {
  const payment = await Payment.findById(req.params.id).populate("client", "email username").populate("commission", "title");
  if (!payment) return res.status(404).json({ success: false, message: "Payment request not found." });
  if (payment.client._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You cannot pay this request." });
  if (payment.status === "pro_bono") return res.status(409).json({ success: false, message: "This commission is pro bono. No payment is required." });
  if (payment.status === "paid") return res.status(409).json({ success: false, message: "This payment is already complete." });
  if (payment.status !== "pending") return res.status(409).json({ success: false, message: "This payment request is no longer active." });
  const base = frontendUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: payment.client.email,
    client_reference_id: payment._id.toString(),
    metadata: { paymentId: payment._id.toString(), commissionId: payment.commission._id.toString(), clientId: payment.client._id.toString(), invoiceNumber: payment.invoiceNumber },
    line_items: [{ quantity: 1, price_data: { currency: payment.currency, unit_amount: payment.amount, product_data: { name: `XDevs commission: ${payment.commission.title}`, description: payment.description || "Programming commission payment" } } }],
    success_url: `${base}/pages/dashboard/client.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pages/dashboard/client.html?payment=cancelled`
  });
  payment.stripeSessionId = session.id;
  await payment.save();
  res.json({ success: true, checkoutUrl: session.url });
}

async function cancelPaymentRequest(req, res) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ success: false, message: "Payment request not found." });
  if (payment.status !== "pending") return res.status(409).json({ success: false, message: "Only pending requests can be cancelled." });
  payment.status = "cancelled";
  await payment.save();
  res.json({ success: true, payment });
}

async function stripeWebhook(req, res) {
  const signature = req.get("stripe-signature");
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (error) { return res.status(400).send(`Webhook signature verification failed: ${error.message}`); }
  const session = event.data.object;
  const paymentId = session?.metadata?.paymentId || session?.client_reference_id;
  if (paymentId && validId(paymentId)) {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      await Payment.findByIdAndUpdate(paymentId, { status: "paid", stripeSessionId: session.id, stripePaymentIntentId: session.payment_intent || null, paidAt: new Date() });
    }
    if (event.type === "checkout.session.async_payment_failed") await Payment.findByIdAndUpdate(paymentId, { status: "failed" });
    if (event.type === "checkout.session.expired") await Payment.findOneAndUpdate({ _id: paymentId, status: "pending" }, { status: "cancelled" });
  }
  res.json({ received: true });
}

module.exports = {
  createPaymentRequest, createProBonoInvoice, getMyPayments, getAllPayments,
  getMyInvoiceArchive, getInvoiceArchive, downloadInvoice, exportInvoiceCsv,
  exportInvoiceZip, createCheckoutSession, cancelPaymentRequest, stripeWebhook
};
