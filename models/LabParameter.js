const labParameterSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabTest",
      required: true,
    },
    parameterName: { type: String, required: true },
    unit: { type: String },
    bioReference: { type: String },
    refMin: { type: Number },
    refMax: { type: Number },
    criticalLess: { type: Number },
    criticalMax: { type: Number },
    interpretationMale: { type: String },
    interpretationFemale: { type: String },
    interpretationBoth: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LabParameter", labParameterSchema);
