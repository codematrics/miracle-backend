const mongoose = require("mongoose");
const {
  SERVICE_CATEGORY,
  SERVICE_APPLICABLE,
  FORMAT_TYPE,
  SAMPLE_TYPE,
} = require("../constants/enums");

const serviceSchema = new mongoose.Schema(
  {
    serviceHead: { type: String, required: true },
    serviceName: { type: String, required: true },
    unit: { type: String },
    headType: {
      type: String,
      enum: Object.values(SERVICE_CATEGORY),
      required: true,
    },
    serviceApplicableOn: {
      type: String,
      enum: Object.values(SERVICE_APPLICABLE),
      required: true,
    },
    linkedParameters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LabParameter",
      },
    ],
    isOutSource: { type: Boolean, default: true },
    code: { type: String, required: true, unique: true },
    price: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
