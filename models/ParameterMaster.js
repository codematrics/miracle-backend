const mongoose = require("mongoose");
const { PARAMETER_DATATYPE_ENUM } = require("../constants/enums");

const parameterMasterSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    parameterName: { type: String, required: true, trim: true, maxlength: 200 },
    parameterCode: { type: String, trim: true, uppercase: true, maxlength: 20 },
    unit: { type: String, required: true, trim: true, maxlength: 50 },
    referenceRange: { type: String, trim: true, maxlength: 200 },
    maleRange: { type: String, trim: true },
    femaleRange: { type: String, trim: true },
    dataType: {
      type: String,
      enum: Object.values(PARAMETER_DATATYPE_ENUM),
      default: PARAMETER_DATATYPE_ENUM.text,
      required: true
    },
    methodology: {
      type: String,
      trim: true,
      maxlength: 100
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ParameterMaster", parameterMasterSchema);
