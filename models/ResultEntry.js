const resultEntrySchema = new mongoose.Schema(
  {
    orderTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderTest",
      required: true,
    },
    parameterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabParameter",
      required: true,
    },
    resultValue: { type: String },
    unit: { type: String },
    bioReference: { type: String },
    refMin: { type: Number },
    refMax: { type: Number },
    criticalLess: { type: Number },
    criticalMax: { type: Number },
    remarks: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResultEntry", resultEntrySchema);
