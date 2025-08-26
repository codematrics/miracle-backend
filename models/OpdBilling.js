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
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  amount: { type: Number, required: true },
});

const OpdBillingSchema = new mongoose.Schema(
  {
    billId: {
      type: String,
      unique: true,
      required: true,
    },
    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    consultantDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
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
  if (!this.billId) {
    const lastBill = await mongoose
      .model("OpdBilling")
      .findOne()
      .sort({ createdAt: -1 });

    // Extract last number
    let lastId = 0;
    if (lastBill?.billId) {
      const parts = lastBill.billId.split("-");
      if (parts.length === 2 && !isNaN(parts[1])) {
        lastId = parseInt(parts[1], 10);
      }
    }

    this.billId = `BILL-${lastId + 1}`;
  }
  next();
});

module.exports = mongoose.model("OpdBilling", OpdBillingSchema);
