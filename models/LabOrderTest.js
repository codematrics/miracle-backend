const mongoose = require("mongoose");
const { CONTAINER_TYPES, SAMPLE_TYPES } = require("../constants/enums");

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
    collectedAt: {
      type: Date,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    savedAt: {
      type: Date,
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    authorizedAt: {
      type: Date,
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Cached service info for quick access
    serviceInfo: {
      name: String,
      code: String,
      category: String,
    },
    // Test-specific metadata
    sampleType: {
      type: String,
      enum: SAMPLE_TYPES,
      default: SAMPLE_TYPES.WHOLE_BLOOD,
    },
    containerType: {
      type: String,
      enum: CONTAINER_TYPES,
      default: CONTAINER_TYPES.PLAIN,
    },
    instructions: {
      type: String,
      maxlength: 500,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    machineUsed: {
      type: String,
      maxlength: 100,
    },
    // Quality control flags
    hemolyzed: {
      type: Boolean,
      default: false,
    },
    lipemic: {
      type: Boolean,
      default: false,
    },
    icteric: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for status display
labOrderTestSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    pending: "Pending Collection",
    collected: "Sample Collected",
    saved: "Results Saved",
    authorized: "Authorized",
  };
  return statusMap[this.status] || this.status;
});

// Virtual for quality flags display
labOrderTestSchema.virtual("qualityFlags").get(function () {
  const flags = [];
  if (this.hemolyzed) flags.push("Hemolyzed");
  if (this.lipemic) flags.push("Lipemic");
  if (this.icteric) flags.push("Icteric");
  return flags.join(", ") || "Normal";
});

// Pre-save middleware to update timestamps
labOrderTestSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const now = new Date();
    switch (this.status) {
      case "collected":
        if (!this.collectedAt) this.collectedAt = now;
        break;
      case "saved":
        if (!this.savedAt) this.savedAt = now;
        break;
      case "authorized":
        if (!this.authorizedAt) this.authorizedAt = now;
        break;
    }
  }
  next();
});

// Post-save middleware to update parent lab order status
labOrderTestSchema.post("save", async function () {
  if (this.isModified("status")) {
    await updateLabOrderStatus(this.labOrderId);
  }
});

// Function to update lab order status based on test statuses
async function updateLabOrderStatus(labOrderId) {
  const LabOrder = mongoose.model("LabOrder");
  const LabOrderTest = mongoose.model("LabOrderTest");

  const tests = await LabOrderTest.find({ labOrderId });
  const labOrder = await LabOrder.findById(labOrderId);

  if (!labOrder || !tests.length) return;

  const statuses = tests.map((test) => test.status);
  let newStatus;

  if (statuses.every((status) => status === "authorized")) {
    newStatus = "authorized";
  } else if (
    statuses.every((status) => status === "saved" || status === "authorized")
  ) {
    newStatus = "saved";
  } else if (
    statuses.every(
      (status) =>
        status === "collected" || status === "saved" || status === "authorized"
    )
  ) {
    newStatus = "collected";
  } else {
    newStatus = "pending";
  }

  if (labOrder.status !== newStatus) {
    labOrder.status = newStatus;
    await labOrder.save();
  }
}

// Indexes for better performance
labOrderTestSchema.index({ labOrderId: 1, serviceId: 1 });
labOrderTestSchema.index({ status: 1, createdAt: -1 });
labOrderTestSchema.index({ collectedAt: -1 });
labOrderTestSchema.index({ savedAt: -1 });
labOrderTestSchema.index({ authorizedAt: -1 });

module.exports = mongoose.model("LabOrderTest", labOrderTestSchema);
