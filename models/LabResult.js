const mongoose = require("mongoose");

const labResultSchema = new mongoose.Schema(
  {
    labOrderTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabOrderTest",
      required: true,
      index: true,
    },
    parameterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParameterMaster",
      required: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed, // Can be string, number, or boolean
      required: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    referenceRange: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "saved", "authorized"],
      default: "pending",
      index: true,
    },
    // Workflow tracking
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    enteredAt: {
      type: Date,
      default: Date.now,
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    savedAt: {
      type: Date,
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    authorizedAt: {
      type: Date,
    },
    // Result interpretation
    interpretation: {
      type: String,
      enum: [
        "normal",
        "high",
        "low",
        "critical_high",
        "critical_low",
        "abnormal",
      ],
      index: true,
    },
    isCritical: {
      type: Boolean,
      default: false,
      index: true,
    },
    isAbnormal: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Quality control
    dilutionFactor: {
      type: Number,
      default: 1,
    },
    repeatCount: {
      type: Number,
      default: 1,
    },
    // Cached parameter info for quick access
    parameterInfo: {
      name: String,
      code: String,
      dataType: String,
      methodology: String,
    },
    // Technical details
    instrumentUsed: {
      type: String,
      trim: true,
    },
    methodUsed: {
      type: String,
      trim: true,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Comments and notes
    technicalRemarks: {
      type: String,
      maxlength: 1000,
    },
    clinicalRemarks: {
      type: String,
      maxlength: 1000,
    },
    // Version control for result changes
    version: {
      type: Number,
      default: 1,
    },
    previousValues: [
      {
        value: mongoose.Schema.Types.Mixed,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],
    // Flags
    flags: {
      hemolyzed: { type: Boolean, default: false },
      lipemic: { type: Boolean, default: false },
      icteric: { type: Boolean, default: false },
      clotted: { type: Boolean, default: false },
      insufficient: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for display value with appropriate formatting
labResultSchema.virtual("displayValue").get(function () {
  if (
    this.parameterInfo?.dataType === "numeric" &&
    typeof this.value === "number"
  ) {
    // Format numeric values with appropriate decimal places
    return this.value.toFixed(2);
  }
  return String(this.value);
});

// Virtual for status display
labResultSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    pending: "Pending Entry",
    saved: "Saved",
    authorized: "Authorized",
  };
  return statusMap[this.status] || this.status;
});

// Virtual for interpretation display
labResultSchema.virtual("interpretationDisplay").get(function () {
  const interpretationMap = {
    normal: "Normal",
    high: "High ↑",
    low: "Low ↓",
    critical_high: "Critical High ↑↑",
    critical_low: "Critical Low ↓↓",
    abnormal: "Abnormal",
  };
  return interpretationMap[this.interpretation] || "";
});

// Method to interpret result value
labResultSchema.methods.interpretResult = function (
  parameterData,
  patientGender,
  patientAge
) {
  if (this.parameterInfo?.dataType !== "numeric") {
    this.interpretation = "normal";
    return;
  }

  const numValue = parseFloat(this.value);
  if (isNaN(numValue)) {
    this.interpretation = "abnormal";
    return;
  }

  // Check critical values first
  if (parameterData.criticalHigh && numValue > parameterData.criticalHigh) {
    this.interpretation = "critical_high";
    this.isCritical = true;
    this.isAbnormal = true;
    return;
  }

  if (parameterData.criticalLow && numValue < parameterData.criticalLow) {
    this.interpretation = "critical_low";
    this.isCritical = true;
    this.isAbnormal = true;
    return;
  }

  // Parse reference range (assuming format like "10-20" or "<10" or ">50")
  const range = this.referenceRange;
  if (range.includes("-")) {
    const [min, max] = range.split("-").map((v) => parseFloat(v.trim()));
    if (!isNaN(min) && !isNaN(max)) {
      if (numValue < min) {
        this.interpretation = "low";
        this.isAbnormal = true;
      } else if (numValue > max) {
        this.interpretation = "high";
        this.isAbnormal = true;
      } else {
        this.interpretation = "normal";
      }
      return;
    }
  }

  // Handle other range formats
  if (range.startsWith("<")) {
    const maxVal = parseFloat(range.substring(1));
    if (!isNaN(maxVal) && numValue >= maxVal) {
      this.interpretation = "high";
      this.isAbnormal = true;
    } else {
      this.interpretation = "normal";
    }
    return;
  }

  if (range.startsWith(">")) {
    const minVal = parseFloat(range.substring(1));
    if (!isNaN(minVal) && numValue <= minVal) {
      this.interpretation = "low";
      this.isAbnormal = true;
    } else {
      this.interpretation = "normal";
    }
    return;
  }

  // Default to normal if we can't parse the range
  this.interpretation = "normal";
};

// Pre-save middleware to handle status changes and interpretation
labResultSchema.pre("save", function (next) {
  // Update timestamps based on status changes
  if (this.isModified("status")) {
    const now = new Date();
    switch (this.status) {
      case "saved":
        if (!this.savedAt) this.savedAt = now;
        break;
      case "authorized":
        if (!this.authorizedAt) this.authorizedAt = now;
        break;
    }
  }

  // Track value changes
  if (this.isModified("value") && !this.isNew) {
    this.version += 1;
  }

  next();
});

// Post-save middleware to update parent test status
labResultSchema.post("save", async function () {
  if (this.isModified("status")) {
    await updateLabOrderTestStatus(this.labOrderTestId);
  }
});

// Function to update lab order test status based on result statuses
async function updateLabOrderTestStatus(labOrderTestId) {
  const LabOrderTest = mongoose.model("LabOrderTest");
  const LabResult = mongoose.model("LabResult");

  const results = await LabResult.find({ labOrderTestId });
  const labOrderTest = await LabOrderTest.findById(labOrderTestId);

  if (!labOrderTest || !results.length) return;

  const statuses = results.map((result) => result.status);
  let newStatus = labOrderTest.status;

  if (statuses.every((status) => status === "authorized")) {
    newStatus = "authorized";
  } else if (
    statuses.every((status) => status === "saved" || status === "authorized")
  ) {
    newStatus = "saved";
  }

  if (labOrderTest.status !== newStatus) {
    labOrderTest.status = newStatus;
    await labOrderTest.save();
  }
}

// Indexes for better performance
labResultSchema.index({ labOrderTestId: 1, parameterId: 1 }, { unique: true });
labResultSchema.index({ status: 1, createdAt: -1 });
labResultSchema.index({ isCritical: 1 });
labResultSchema.index({ isAbnormal: 1 });
labResultSchema.index({ authorizedAt: -1 });

module.exports = mongoose.model("LabResult", labResultSchema);
