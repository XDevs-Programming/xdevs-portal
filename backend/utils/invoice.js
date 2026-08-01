const PDFDocument = require("pdfkit");

function money(pence, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format((Number(pence) || 0) / 100);
}

function date(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(value));
}

function statusLabel(payment) {
  if (payment.status === "pro_bono") return "PRO BONO - NO PAYMENT DUE";
  if (payment.status === "paid") return "PAID";
  if (payment.status === "refunded") return "REFUNDED";
  if (payment.status === "cancelled") return "CANCELLED";
  if (payment.status === "failed") return "PAYMENT FAILED";
  return "PAYMENT DUE";
}

function addRule(doc, y) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#d7dce5").lineWidth(1).stroke();
}

function buildInvoiceDocument(payment) {
  const companyName = payment.companySnapshot?.name || process.env.INVOICE_COMPANY_NAME || "XDevs Programming";
  const companyEmail = payment.companySnapshot?.email || process.env.INVOICE_COMPANY_EMAIL || "";
  const companyAddress = payment.companySnapshot?.address || process.env.INVOICE_COMPANY_ADDRESS || "";
  const clientName = payment.clientSnapshot?.username || payment.client?.username || "Client";
  const clientEmail = payment.clientSnapshot?.email || payment.client?.email || "";
  const commissionTitle = payment.commissionSnapshot?.title || payment.commission?.title || "Programming commission";

  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: { Title: payment.invoiceNumber, Author: companyName }
  });

  doc.font("Helvetica-Bold").fontSize(26).fillColor("#111827").text("INVOICE", 50, 48);
  doc.fontSize(16).fillColor("#2563eb").text(companyName, 330, 52, { width: 215, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#4b5563");
  if (companyEmail) doc.text(companyEmail, 330, 76, { width: 215, align: "right" });
  if (companyAddress) doc.text(companyAddress, 330, companyEmail ? 90 : 76, { width: 215, align: "right" });

  addRule(doc, 126);

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text("INVOICE NUMBER", 50, 148);
  doc.font("Helvetica").fontSize(12).fillColor("#111827").text(payment.invoiceNumber, 50, 165);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text("ISSUED", 220, 148);
  doc.font("Helvetica").fontSize(12).fillColor("#111827").text(date(payment.invoiceIssuedAt || payment.createdAt), 220, 165);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text("STATUS", 390, 148);
  doc.font("Helvetica-Bold").fontSize(10)
    .fillColor(payment.status === "pending" ? "#b45309" : "#047857")
    .text(statusLabel(payment), 390, 165, { width: 155, align: "right" });

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text("BILL TO", 50, 215);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(clientName, 50, 234);
  if (clientEmail) doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(clientEmail, 50, 252);
  if (payment.dueDate && payment.status === "pending") {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#6b7280").text("DUE DATE", 390, 215, { width: 155, align: "right" });
    doc.font("Helvetica").fontSize(11).fillColor("#111827").text(date(payment.dueDate), 390, 234, { width: 155, align: "right" });
  }

  doc.rect(50, 302, 495, 30).fill("#111827");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff").text("DESCRIPTION", 62, 312);
  doc.text("AMOUNT", 430, 312, { width: 100, align: "right" });

  doc.rect(50, 332, 495, 88).fill("#f8fafc");
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(commissionTitle, 62, 348, { width: 345 });
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563")
    .text(payment.description || (payment.status === "pro_bono" ? "Pro bono programming services" : "Programming commission services"), 62, 370, { width: 345 });
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827")
    .text(money(payment.amount, payment.currency), 430, 350, { width: 100, align: "right" });

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("TOTAL", 365, 452, { width: 80, align: "right" });
  doc.fontSize(16).text(money(payment.amount, payment.currency), 450, 448, { width: 95, align: "right" });

  if (payment.status === "pro_bono") {
    doc.roundedRect(50, 493, 495, 58, 6).fill("#ecfdf5");
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#047857").text("This commission has been provided pro bono.", 68, 510);
    doc.font("Helvetica").fontSize(10).fillColor("#065f46").text("No payment is required from the client.", 68, 530);
  } else if (payment.status === "paid") {
    doc.roundedRect(50, 493, 495, 58, 6).fill("#ecfdf5");
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#047857").text("Payment received - thank you.", 68, 510);
    if (payment.paidAt) doc.font("Helvetica").fontSize(10).fillColor("#065f46").text(`Paid on ${date(payment.paidAt)}.`, 68, 530);
  } else if (payment.status === "refunded") {
    doc.roundedRect(50, 493, 495, 58, 6).fill("#f5f3ff");
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#6d28d9").text("Payment refunded.", 68, 510);
  } else {
    doc.roundedRect(50, 493, 495, 58, 6).fill("#fff7ed");
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#b45309").text("Payment is outstanding.", 68, 510);
    doc.font("Helvetica").fontSize(10).fillColor("#9a3412").text("Use the secure Stripe payment button in the XDevs client portal.", 68, 530);
  }

  addRule(doc, 710);
  doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(
    "This invoice was generated automatically by the XDevs Programming portal.",
    50, 726, { width: 495, align: "center" }
  );

  return doc;
}

function createInvoiceBuffer(payment) {
  return new Promise((resolve, reject) => {
    const doc = buildInvoiceDocument(payment);
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function streamInvoice(res, payment) {
  const filename = `${payment.invoiceNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  const doc = buildInvoiceDocument(payment);
  doc.pipe(res);
  doc.end();
}

module.exports = { streamInvoice, createInvoiceBuffer };
