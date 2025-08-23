const mongoose = require("mongoose");
const {
  PATIENT_TYPES,
  PRIORITY,
  SERVICE_CATEGORIES,
  PAYMENT_MODES,
} = require("../constants/enums");

const ServiceSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  serviceName: { type: String, required: true },
  serviceCode: { type: String, required: true },
  category: {
    type: String,
    enum: SERVICE_CATEGORIES,
    required: true,
  },
  rate: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  amount: { type: Number, required: true },
});

const OpdBillingSchema = new mongoose.Schema(
  {
    billId: { type: String, unique: true, required: true },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    patientInfo: {
      name: String,
      age: Number,
      gender: String,
      mobileNo: String,
    },
    patientCategory: {
      type: String,
      enum: PATIENT_TYPES,
      default: PATIENT_TYPES.GENERAL,
    },
    refby: { type: String },
    consultantDoctor: { type: String },
    priority: { type: String, enum: PRIORITY, default: "normal" },

    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      default: PAYMENT_MODES.CASH,
    },
    paidAmount: { type: Number, default: 0 },

    services: [ServiceSchema],

    billing: {
      grossAmount: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      netAmount: { type: Number, required: true },
    },

    status: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid", "cancelled"],
      default: "unpaid",
    },
    billDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

OpdBillingSchema.pre("validate", async function (next) {
  if (this.isNew && !this.billId) {
    const lastBill = await this.constructor.findOne().sort({ createdAt: -1 });
    let newNumber = 1;

    if (lastBill && lastBill.billId) {
      const lastNumber = parseInt(lastBill.billId.split("-")[1], 10);
      newNumber = lastNumber + 1;
    }

    this.billId = `OPD-${String(newNumber).padStart(5, "0")}`;
  }
  next();
});

module.exports = mongoose.model("OpdBilling", OpdBillingSchema);
