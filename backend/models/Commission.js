const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    },
    category: {
      type: String,
      enum: [
        "Website",
        "Discord Bot",
        "Automation",
        "API",
        "Roblox",
        "Other"
      ],
      required: true
    },
    budget: {
      type: String,
      trim: true,
      default: "Not specified",
      maxlength: 80
    },
    deadline: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Reviewing",
        "Accepted",
        "In Progress",
        "Testing",
        "Completed",
        "Rejected"
      ],
      default: "Pending",
      index: true
    },
    adminNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Commission", commissionSchema);
