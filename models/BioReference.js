const { default: mongoose } = require("mongoose");
const { AGE_UNITS, GENDER_WITH_ALL } = require("../constants/enums");

const bioLogicalRef = new mongoose.Schema({
  unit: { type: String },
  ageFrom: { type: Number, required: true },
  ageTo: { type: Number, required: true },
  ageType: {
    type: String,
    enum: Object.values(AGE_UNITS),
    required: true,
  },
  gender: {
    type: String,
    enum: Object.values(GENDER_WITH_ALL),
    required: true,
  },
  range: { type: String, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  criticalLess: { type: Number },
  criticalGreat: { type: Number },
});

module.exports = mongoose.model("BioReference", bioLogicalRef);
