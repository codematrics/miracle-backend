const mongoose = require("mongoose");

const bedSchema = new mongoose.Schema(
  {
    bedNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
    type: { type: String, enum: ["general", "icu", "ward"], required: true },
    ward: { type: String, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bed", bedSchema);
