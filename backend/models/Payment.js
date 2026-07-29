const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    commission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 50
    },
    currency: {
      type: String,
      default: "gbp",
      lowercase: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
      index: true
    },
    stripeSessionId: {
      type: String,
      default: null,
      index: true
    },
    stripePaymentIntentId: {
      type: String,
      default: null
    },
    paidAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

paymentSchema.index(
  { commission: 1, status: 1 },
  { partialFilterExpression: { status: "pending" } }
);

module.exports = mongoose.model("Payment", paymentSchema);
