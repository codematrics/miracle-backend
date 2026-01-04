const mongoose = require("mongoose");

const serviceTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    serviceHead: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceType", serviceTypeSchema);
