const mongoose = require("mongoose");

const PrimaryExaminationSchema = new mongoose.Schema(
  {
    visitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    complaints: [{ type: String }],
    history: { type: String },

    vitals: {
      height: Number,
      weight: Number,
      spo2: Number,
      pulse: Number,
      bp: String,
      resp: Number,
      temp: Number,
    },

    femaleDetails: {
      lmp: Date,
      edd: Date,
      gravida: Number,
      parity: Number,
      noOfChild: Number,
    },

    investigations: [{ type: String }],
    investigationAdvised: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PrimaryExamination", PrimaryExaminationSchema);
