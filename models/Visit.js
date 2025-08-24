const mongoose = require("mongoose");
const { VISIT_STATUS, VISIT_TYPE } = require("../constants/enums");

const visitSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    visitDate: { type: Date, default: Date.now },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
