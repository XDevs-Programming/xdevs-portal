const mongoose = require("mongoose");

const fileRecordSchema = new mongoose.Schema(
  {
    commission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      required: true,
      index: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      select: false
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    mimeType: {
      type: String,
      required: true,
      maxlength: 120
    },
    size: {
      type: Number,
      required: true,
      min: 1
    },
    category: {
      type: String,
      enum: ["reference", "deliverable", "internal"],
      default: "reference",
      index: true
    },
    version: {
      type: Number,
      min: 1,
      default: 1
    },
    status: {
      type: String,
      enum: ["pending", "available"],
      default: "pending",
      index: true
    }
  },
  { timestamps: true }
);

fileRecordSchema.index({ commission: 1, category: 1, originalName: 1, version: -1 });

module.exports = mongoose.model("FileRecord", fileRecordSchema);
