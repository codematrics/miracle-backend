const mongoose = require("mongoose");
const { VISIT_STATUS, VISIT_TYPE } = require("../constants/enums");
const { string } = require("zod");
const { required } = require("zod/mini");

const visitSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    code: { type: String, required: true },
    visitDate: { type: Date, default: Date.now },
    consultingDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    referredBy: { type: String },
    visitType: { type: String, enum: Object.values(VISIT_TYPE) },
    status: {
      type: String,
      enum: Object.values(VISIT_STATUS),
      default: VISIT_STATUS.PENDING,
    },
    visitNote: { type: String },
    medicoLegal: { type: Boolean, default: false },
    insuranceType: { type: String },
    policyCardNumber: { type: String },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
