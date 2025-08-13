const mongoose = require("mongoose");
const {
  getEnumValues,
  RELATION_TYPES,
  AGE_UNITS,
  GENDER_TYPES,
  MARITAL_STATUS,
  RELIGIONS,
  OCCUPATIONS,
  ID_TYPES,
  PATIENT_TYPES,
} = require("../constants/enums");

const patientSchema = new mongoose.Schema(
  {
    uhid: { type: String, unique: true },
    patientName: { type: String, required: true },
    relation: {
      type: String,
      enum: Object.values(RELATION_TYPES),
      required: true,
    },
    fatherOrHusbandName: { type: String, required: true },

    age: { type: Number, required: true },
    ageUnit: { type: String, enum: Object.values(AGE_UNITS), required: true },

    gender: { type: String, enum: Object.values(GENDER_TYPES), required: true },
    maritalStatus: {
      type: String,
      enum: Object.values(MARITAL_STATUS),
      default: null,
    },
    religion: {
      type: String,
      enum: Object.values(RELIGIONS),
      default: null,
    },
    occupation: {
      type: String,
      enum: Object.values(OCCUPATIONS),
      default: null,
    },

    mobileNo: { type: String, required: true },
    emailId: { type: String, default: null },

    idType: {
      type: String,
      enum: Object.values(ID_TYPES),
      required: true,
    },
    idNo: { type: String, required: true },

    patientType: {
      type: String,
      enum: Object.values(PATIENT_TYPES),
      default: PATIENT_TYPES.GENERAL,
    },

    address: {
      village: { type: String, required: true },
      state: { type: String, required: true },
      district: { type: String, required: true },
      tehsil: { type: String, required: true },
      postOffice: { type: String, required: true },
      pincode: { type: String, required: true },
    },
  },
  { timestamps: true }
);

patientSchema.pre("save", async function (next) {
  if (!this.uhid) {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
    const currentDay = String(new Date().getDate()).padStart(2, "0");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastPatient = await this.constructor
      .findOne({
        createdAt: { $gte: today, $lt: tomorrow },
      })
      .sort({ createdAt: -1 });

    let sequenceNumber = 1;
    if (lastPatient && lastPatient.uhid) {
      const lastSequence = parseInt(lastPatient.uhid.slice(-2));
      sequenceNumber = lastSequence + 1;
    }

    this.uhid = `MH1000${currentYear}${currentMonth}${currentDay}${String(
      sequenceNumber
    ).padStart(2, "0")}`;
  }

  const optionalEnumFields = ["maritalStatus", "religion", "occupation"];
  optionalEnumFields.forEach((field) => {
    if (this[field] === "") {
      this[field] = null;
    }
  });

  if (this.emailId === "") {
    this.emailId = null;
  }

  next();
});

module.exports = mongoose.model("Patient", patientSchema);
