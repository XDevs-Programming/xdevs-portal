const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 40
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true
    },
    avatar: {
      type: String,
      default: null
    },
    discordId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    role: {
      type: String,
      enum: ["client", "admin"],
      default: "client",
      index: true
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email || null,
    avatar: this.avatar || null,
    role: this.role,
    providers: {
      discord: Boolean(this.discordId),
      google: Boolean(this.googleId)
    },
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model("User", userSchema);
