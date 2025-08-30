const mongoose = require("mongoose");

const labResultSchema = new mongoose.Schema(
  {
    labOrderTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabOrderTest",
      required: true,
      index: true,
    },
    parameterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParameterMaster",
      required: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed, // Can be string, number, or boolean
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("LabResult", labResultSchema);
