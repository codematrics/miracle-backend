const mongoose = require("mongoose");
const { ORDER_STATUS, PRIORITY } = require("../constants/enums");

const labOrderSchema = new mongoose.Schema(
  {
    accessionNo: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      index: true,
    },
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OpdBilling",
      index: true,
    },
    doctor: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUS,
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    instructions: {
      type: String,
      maxlength: 1000,
    },
    collectedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

labOrderSchema.virtual("formattedAccession").get(function () {
  return `ACC-${this.accessionNo}`;
});

labOrderSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    pending: "Pending Collection",
    collected: "Sample Collected",
    saved: "Results Saved",
    authorized: "Authorized",
  };
  return statusMap[this.status] || this.status;
});

labOrderSchema.pre("validate", async function (next) {
  if (!this.accessionNo) {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
    const currentDay = String(new Date().getDate()).padStart(2, "0");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastOrder = await this.constructor
      .findOne({ createdAt: { $gte: today, $lt: tomorrow } })
      .sort({ createdAt: -1 });

    let sequenceNumber = 1;
    if (lastOrder && lastOrder.accessionNo) {
      const lastSequence = parseInt(lastOrder.accessionNo.slice(-4));
      if (!isNaN(lastSequence)) {
        sequenceNumber = lastSequence + 1;
      }
    }

    this.accessionNo = `LAB${currentYear}${currentMonth}${currentDay}${String(
      sequenceNumber
    ).padStart(4, "0")}`;
  }
  next();
});

labOrderSchema.index({ accessionNo: 1 });
labOrderSchema.index({ patientId: 1, orderDate: -1 });
labOrderSchema.index({ status: 1, orderDate: -1 });
labOrderSchema.index({ orderDate: -1 });
labOrderSchema.index({ visitId: 1 });

module.exports = mongoose.model("LabOrder", labOrderSchema);
