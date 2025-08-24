const radiologyReportSchema = new mongoose.Schema(
  {
    orderTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderTest",
      required: true,
    },
    templateUsedId: { type: mongoose.Schema.Types.ObjectId },
    findings: { type: String },
    impression: { type: String },
    methodology: { type: String },
    authorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorizedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RadiologyReport", radiologyReportSchema);
