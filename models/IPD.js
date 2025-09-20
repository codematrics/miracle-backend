const mongoose = require("mongoose");

const IPDSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true },
    patientStatus: {
      type: String,
      enum: ["In Treatment", "Discharged"],
      default: "In Treatment",
    },
    bed: { type: mongoose.Schema.Types.ObjectId, ref: "Bed" },
    services: [
      {
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true },
      },
    ],
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    referringDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    totalAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IPD", IPDSchema);
