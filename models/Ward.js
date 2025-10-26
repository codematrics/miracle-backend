const mongoose = require("mongoose");

const wardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    type: { type: String, enum: ["general", "icu", "ward"], required: true },
    floor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ward", wardSchema);
