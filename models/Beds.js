const mongoose = require("mongoose");

const bedSchema = new mongoose.Schema(
  {
    bedNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: true,
    },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bed", bedSchema);
