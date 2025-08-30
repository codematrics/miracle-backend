const { default: mongoose } = require("mongoose");
const { REPORT_TYPE, FORMAT_TYPE, SAMPLE_TYPE } = require("../constants/enums");

const labTestSchema = new mongoose.Schema(
  {
    testName: { type: String, required: true },
    reportType: {
      type: String,
      enum: Object.values(REPORT_TYPE),
      required: true,
    },
    formatType: {
      type: String,
      enum: Object.values(FORMAT_TYPE),
      required: true,
    },
    sampleType: {
      type: String,
      enum: Object.values(SAMPLE_TYPE),
    },
    methodology: { type: String },
    isActive: { type: Boolean, default: true },
    isPrintable: { type: Boolean, default: true },
    linkedServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("LabTest", labTestSchema);
