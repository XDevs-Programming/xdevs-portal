const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    commission: { type: mongoose.Schema.Types.ObjectId, ref: "Commission", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "gbp", lowercase: true },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded", "pro_bono"],
      default: "pending",
      index: true
    },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    invoiceIssuedAt: { type: Date, default: Date.now, index: true },
    dueDate: { type: Date, default: null },
    archivedAt: { type: Date, default: Date.now },
    clientSnapshot: {
      username: { type: String, default: "Client" },
      email: { type: String, default: "" }
    },
    commissionSnapshot: {
      title: { type: String, default: "Programming commission" },
      category: { type: String, default: "Other" }
    },
    companySnapshot: {
      name: { type: String, default: "XDevs Programming" },
      email: { type: String, default: "" },
      address: { type: String, default: "" }
    },
    stripeSessionId: { type: String, default: null, index: true },
    stripePaymentIntentId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

paymentSchema.index({ client: 1, invoiceIssuedAt: -1 });
paymentSchema.index({ status: 1, invoiceIssuedAt: -1 });
paymentSchema.index(
  { commission: 1, status: 1 },
  { partialFilterExpression: { status: "pending" } }
);

module.exports = mongoose.model("Payment", paymentSchema);
