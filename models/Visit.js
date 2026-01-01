const mongoose = require("mongoose");
const { VISIT_STATUS, VISIT_TYPE } = require("../constants/enums");
const { string } = require("zod");
const { required } = require("zod/mini");

const ServiceSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  amount: { type: Number, required: true },
});

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
    referringDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
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
    services: [ServiceSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
