const mongoose = require("mongoose");
const {
  GENDER,
  RELATION_TYPES,
  MARITAL_STATUS,
  ID_TYPES,
} = require("../constants/enums");

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    gender: { type: String, enum: Object.values(GENDER) },
    age: { type: Number },
    patientType: { type: String },
    mobileNumber: { type: String },
    uhidNo: { type: String, required: true, unique: true }, // Make it required
    relation: {
      required: true,
      type: String,
      enum: Object.values(RELATION_TYPES),
    },
    relativeName: { type: String },
    maritalStatus: {
      type: String,
      enum: Object.values(MARITAL_STATUS),
      required: true,
    },
    religion: { type: String },
    occupation: { type: String },
    email: { type: String },
    idType: {
      type: String,
      enum: Object.values(ID_TYPES),
    },
    idNo: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      district: String,
      tehsil: String,
      post: String,
      pincode: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
