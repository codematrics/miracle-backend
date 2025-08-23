const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    doctorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    employeeId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    qualification: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    licenseNo: {
      type: String,
      trim: true,
      maxlength: 50,
      uppercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      validate: {
        validator: function (v) {
          return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    mobileNo: {
      type: String,
      trim: true,
      maxlength: 15,
      validate: {
        validator: function (v) {
          return !v || /^[0-9]{10,15}$/.test(v);
        },
        message: "Please enter a valid mobile number",
      },
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    consultationFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    emergencyContactNo: {
      type: String,
      trim: true,
      maxlength: 15,
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isConsultant: {
      type: Boolean,
      default: true,
    },
    availableDays: [
      {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
    ],
    consultationTimings: {
      morning: {
        startTime: String,
        endTime: String,
      },
      evening: {
        startTime: String,
        endTime: String,
      },
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full display name with qualification
doctorSchema.virtual("displayName").get(function () {
  return this.qualification
    ? `Dr. ${this.doctorName} (${this.qualification})`
    : `Dr. ${this.doctorName}`;
});

// Virtual for full name with specialization
doctorSchema.virtual("nameWithSpecialization").get(function () {
  return `Dr. ${this.doctorName} - ${this.specialization}`;
});

// Pre-save middleware to generate employee ID if not provided
doctorSchema.pre("save", async function (next) {
  if (!this.employeeId) {
    const currentYear = new Date().getFullYear().toString().slice(-2);

    // Find the last doctor created this year
    const lastDoctor = await this.constructor
      .findOne({
        employeeId: new RegExp(`^DOC${currentYear}`),
      })
      .sort({ employeeId: -1 });

    let sequenceNumber = 1;
    if (lastDoctor && lastDoctor.employeeId) {
      const lastSequence = parseInt(lastDoctor.employeeId.slice(-4));
      if (!isNaN(lastSequence)) {
        sequenceNumber = lastSequence + 1;
      }
    }

    this.employeeId = `DOC${currentYear}${String(sequenceNumber).padStart(
      4,
      "0"
    )}`;
  }
  next();
});

// Indexes for better performance
doctorSchema.index({ doctorName: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ department: 1 });
doctorSchema.index({ isActive: 1, isConsultant: 1 });
doctorSchema.index({ employeeId: 1 }, { unique: true });

module.exports = mongoose.model("Doctor", doctorSchema);
