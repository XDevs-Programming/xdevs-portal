const mongoose = require("mongoose");

const billingEventSchema = new mongoose.Schema({
  type: { type: String, required: true, maxlength: 60 },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "gbp" },
  stripeInvoiceId: { type: String, default: "" },
  occurredAt: { type: Date, default: Date.now }
}, { _id: false });

const recurringContractSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  commission: { type: mongoose.Schema.Types.ObjectId, ref: "Commission", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, default: "", maxlength: 1200 },
  amount: { type: Number, required: true, min: 50 },
  currency: { type: String, default: "gbp", lowercase: true },
  interval: { type: String, enum: ["month", "year"], default: "month" },
  status: {
    type: String,
    enum: ["awaiting_setup", "active", "past_due", "cancellation_requested", "cancelling", "cancelled", "incomplete"],
    default: "awaiting_setup",
    index: true
  },
  stripeCustomerId: { type: String, default: null, index: true },
  stripeSubscriptionId: { type: String, default: null, index: true },
  stripeCheckoutSessionId: { type: String, default: null },
  currentPeriodEnd: { type: Date, default: null },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancellationRequestedAt: { type: Date, default: null },
  cancellationReason: { type: String, trim: true, default: "", maxlength: 1000 },
  cancellationScheduledAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  billingEvents: { type: [billingEventSchema], default: [] }
}, { timestamps: true });

recurringContractSchema.index({ client: 1, createdAt: -1 });
recurringContractSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("RecurringContract", recurringContractSchema);
