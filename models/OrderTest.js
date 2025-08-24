const { SAMPLE_TYPE, ORDER_TEST_STATUS } = require("../constants/enums");

const orderTestSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    labTestId: { type: mongoose.Schema.Types.ObjectId, ref: "LabTest" },
    accessionNumber: { type: String },
    labNo: { type: String },
    sampleType: {
      type: String,
      enum: Object.values(SAMPLE_TYPE),
    },
    containerType: { type: String },
    quantity: { type: Number },
    status: {
      type: String,
      enum: Object.values(ORDER_TEST_STATUS),
      default: ORDER_TEST_STATUS.PENDING,
    },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    collectedAt: { type: Date },
    authorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorizedAt: { type: Date },
    methodology: { type: String },
    interpretationMale: { type: String },
    interpretationFemale: { type: String },
    interpretationBoth: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderTest", orderTestSchema);
