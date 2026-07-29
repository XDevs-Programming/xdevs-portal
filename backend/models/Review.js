const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
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
      unique: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200
    },
    approved: {
      type: Boolean,
      default: false,
      index: true
    },
    featured: {
      type: Boolean,
      default: false
    },
    hidden: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
