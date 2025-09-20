const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    appointmentNumber: { type: String, required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    appointmentDate: { type: Date, required: true },
    reason: { type: String },
    status: {
      type: String,
      enum: ["scheduled", "completed", "canceled"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
