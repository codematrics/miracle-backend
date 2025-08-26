const mongoose = require("mongoose");
const { SAMPLE_TYPE } = require("../constants/enums");

const labOrderTestSchema = new mongoose.Schema(
  {
    labOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabOrder",
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "collected", "saved", "authorized"],
      default: "pending",
      index: true,
    },
    collectedSamples: {
      type: [String],
      enum: Object.values(SAMPLE_TYPE),
      default: [],
    },
    collectedAt: Date,
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    savedAt: Date,
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    authorizedAt: Date,
    authorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    technician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to auto-update timestamps
labOrderTestSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const now = new Date();
    if (this.status === "collected" && !this.collectedAt)
      this.collectedAt = now;
    if (this.status === "saved" && !this.savedAt) this.savedAt = now;
    if (this.status === "authorized" && !this.authorizedAt)
      this.authorizedAt = now;
  }
  next();
});

// Post-save: update parent LabOrder status
labOrderTestSchema.post("save", async function () {
  if (this.isModified("status")) {
    await updateLabOrderStatus(this.labOrderId);
  }
});

async function updateLabOrderStatus(labOrderId) {
  const LabOrder = mongoose.model("LabOrder");
  const LabOrderTest = mongoose.model("LabOrderTest");

  const tests = await LabOrderTest.find({ labOrderId });
  if (!tests.length) return;

  const statuses = tests.map((t) => t.status);
  let newStatus = "pending";

  if (statuses.every((s) => s === "authorized")) {
    newStatus = "authorized";
  } else if (statuses.every((s) => ["saved", "authorized"].includes(s))) {
    newStatus = "saved";
  } else if (
    statuses.every((s) => ["collected", "saved", "authorized"].includes(s))
  ) {
    newStatus = "collected";
  }

  await LabOrder.findByIdAndUpdate(labOrderId, { status: newStatus });
}

// Indexes for performance
labOrderTestSchema.index({ labOrderId: 1, serviceId: 1 });
labOrderTestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("LabOrderTest", labOrderTestSchema);
