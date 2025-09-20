const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    specialization: { type: String },
    qualification: { type: String },
    licenseNumber: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String },
    joiningDate: { type: Date },
    email: { type: String },
    mobileNo: { type: String, required: true },
    emergencyContact: { type: String, required: true },
    availableDays: [
      { type: String, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    ],
    consultationTiming: { type: String },
    streetAddress: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: "India" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);
