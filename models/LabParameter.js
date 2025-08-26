const { default: mongoose } = require("mongoose");
const {
  REPORT_TYPE,
  FORMAT_TYPE,
  SAMPLE_TYPE,
  GENDER_WITH_ALL,
} = require("../constants/enums");

const labParameterSchema = new mongoose.Schema(
  {
    parameterName: { type: String, required: true },
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
    isPrintable: { type: Boolean, default: true },
    unit: { type: String },
    bioReference: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BioReference",
      },
    ],
    interpretationType: {
      type: String,
      enum: Object.values(GENDER_WITH_ALL),
      required: true,
    },
    interpretationMale: { type: String },
    interpretationFemale: { type: String },
    interpretationBoth: { type: String },
    methodology: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LabParameter", labParameterSchema);
