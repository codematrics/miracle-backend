const mongoose = require("mongoose");

const pathologySchema = new mongoose.Schema(
  {
    accession: {
      type: String,
      unique: true,
      required: true,
      trim: true
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    reportName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Report name must not exceed 100 characters']
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Service name must not exceed 500 characters']
    },
    consultantDoctor: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Consultant doctor name must not exceed 100 characters']
    },
    referringDoctor: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Referring doctor name must not exceed 100 characters']
    },
    uhid: {
      type: String,
      required: true,
      trim: true
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Patient name must not exceed 100 characters']
    },
    age: {
      type: Number,
      required: true,
      min: [0, 'Age cannot be negative'],
      max: [150, 'Age cannot exceed 150 years']
    },
    ageUnit: {
      type: String,
      enum: ['Year', 'Month', 'Day'],
      default: 'Year',
      required: true
    },
    sex: {
      type: String,
      enum: ['M', 'F', 'O'],
      required: true
    },
    visitNo: {
      type: String,
      required: true,
      trim: true
    },
    // Additional fields for pathology management
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OpdBilling'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'reported', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent', 'stat'],
      default: 'normal'
    },
    sampleCollectionDate: {
      type: Date
    },
    reportDate: {
      type: Date
    },
    technicianName: {
      type: String,
      trim: true,
      maxlength: [100, 'Technician name must not exceed 100 characters']
    },
    pathologistName: {
      type: String,
      trim: true,
      maxlength: [100, 'Pathologist name must not exceed 100 characters']
    },
    reportData: {
      type: mongoose.Schema.Types.Mixed, // For storing test results and report data
      default: {}
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [1000, 'Remarks must not exceed 1000 characters']
    },
    // Billing information
    totalAmount: {
      type: Number,
      min: [0, 'Total amount cannot be negative'],
      default: 0
    },
    paidAmount: {
      type: Number,
      min: [0, 'Paid amount cannot be negative'],
      default: 0
    },
    balanceAmount: {
      type: Number,
      default: 0
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for formatted age display
pathologySchema.virtual('ageDisplay').get(function() {
  return `${this.age} ${this.ageUnit === 'Year' ? 'Yr' : this.ageUnit === 'Month' ? 'Mon' : 'Day'}`;
});

// Virtual for formatted patient display
pathologySchema.virtual('patientDisplay').get(function() {
  return `${this.patientName} (${this.uhid})`;
});

// Virtual for doctor display
pathologySchema.virtual('doctorDisplay').get(function() {
  return `${this.consultantDoctor} / ${this.referringDoctor}`;
});

// Pre-save middleware to generate accession number if not provided
pathologySchema.pre("save", async function (next) {
  if (!this.accession) {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
    const currentDay = String(new Date().getDate()).padStart(2, "0");
    
    // Find the last pathology entry created today to get next sequence number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const lastEntry = await this.constructor.findOne({
      createdAt: { $gte: today, $lt: tomorrow }
    }).sort({ createdAt: -1 });
    
    let sequenceNumber = 1;
    if (lastEntry && lastEntry.accession) {
      // Extract sequence number from accession (assuming format: DDMMYY##### or similar)
      const lastSequence = parseInt(lastEntry.accession.slice(-4));
      if (!isNaN(lastSequence)) {
        sequenceNumber = lastSequence + 1;
      }
    }
    
    // Format: DDMMYY#### (10 digits total)
    this.accession = `${currentDay}${currentMonth}${String(currentYear).slice(-2)}${String(sequenceNumber).padStart(4, '0')}`;
  }

  // Calculate balance amount
  this.balanceAmount = this.totalAmount - this.paidAmount;

  // Auto-update status based on report date
  if (this.reportDate && this.status === 'completed') {
    this.status = 'reported';
  }

  next();
});

// Indexes for better performance
pathologySchema.index({ accession: 1 });
pathologySchema.index({ uhid: 1 });
pathologySchema.index({ visitNo: 1 });
pathologySchema.index({ orderDate: 1 });
pathologySchema.index({ status: 1 });
pathologySchema.index({ patientId: 1 });
pathologySchema.index({ reportName: 1 });
pathologySchema.index({ priority: 1 });
pathologySchema.index({ patientName: 'text', serviceName: 'text' });

module.exports = mongoose.model("Pathology", pathologySchema);