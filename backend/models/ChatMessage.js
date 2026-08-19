const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    commission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }]
  },
  { timestamps: true }
);

chatMessageSchema.index({ commission: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
