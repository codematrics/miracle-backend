const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true },
    dosage: { type: String },
    frequency: { type: String },
    duration: { type: String },
    instructions: { type: String },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    visitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
    },
    medicines: [medicineSchema],
    provisionalDiagnosis: { type: String, default: "" },
    finalDiagnosis: { type: String, default: "" },
    investigationAdvised: { type: String, default: "" },
    treatment: { type: String, default: "" },
    notes: { type: String },
    followUpDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
