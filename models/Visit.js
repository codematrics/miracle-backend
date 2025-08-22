const mongoose = require("mongoose");

const MEDICOLEGAL_OPTIONS = ["Yes", "No"];

const visitServiceSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  serviceName: {
    type: String,
    required: true,
    trim: true
  },
  serviceCode: {
    type: String,
    required: true,
    trim: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const visitSchema = new mongoose.Schema(
  {
    visitId: {
      type: String,
      unique: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    refby: {
      type: String,
      required: true,
      trim: true
    },
    visitingdoctor: {
      type: String,
      required: true,
      trim: true
    },
    visittype: {
      type: String,
      required: true,
      trim: true
    },
    medicolegal: {
      type: String,
      enum: {
        values: MEDICOLEGAL_OPTIONS,
        message: 'Medicolegal must be one of: ' + MEDICOLEGAL_OPTIONS.join(', ')
      },
      required: true,
      default: 'No'
    },
    mediclaim_type: {
      type: String,
      required: true,
      trim: true
    },
    services: [visitServiceSchema],
    totalAmount: {
      type: Number,
      default: 0
    },
    visitDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active'
    },
    
    // Clinical Information
    chiefComplaint: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    
    // Vitals
    vitals: {
      temperature: { type: String, trim: true }, // e.g., "98.6 °F"
      spo2: { type: String, trim: true }, // e.g., "98%"
      height: { type: String, trim: true }, // e.g., "167 cm"
      weight: { type: String, trim: true }, // e.g., "70 kg"
      bloodPressure: { type: String, trim: true }, // e.g., "120/80 mmHg"
      respiratoryRate: { type: String, trim: true }, // e.g., "16 breaths/min"
      pulse: { type: String, trim: true } // e.g., "72 bpm"
    },
    
    // Diagnosis
    diagnosis: {
      provisional: { type: String, trim: true, maxlength: 500 },
      final: { type: String, trim: true, maxlength: 500 },
      additional: { type: String, trim: true, maxlength: 500 }
    },
    
    // Medical History
    pastHistory: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    allergies: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "None"
    },
    
    // Investigation
    investigation: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    
    // Advice
    advice: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    
    // Medications
    medications: [{
      medicine: { type: String, required: true, trim: true },
      dosage: { type: String, required: true, trim: true },
      frequency: { type: String, required: true, trim: true },
      duration: { type: String, required: true, trim: true },
      instructions: { type: String, trim: true }
    }]
  },
  { timestamps: true }
);

// Pre-save middleware to generate Visit ID and calculate total amount
visitSchema.pre("save", async function (next) {
  // Generate Visit ID if not provided
  if (!this.visitId) {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
    const currentDay = String(new Date().getDate()).padStart(2, "0");
    
    // Find the last visit created today to get next sequence number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const lastVisit = await this.constructor.findOne({
      createdAt: { $gte: today, $lt: tomorrow }
    }).sort({ createdAt: -1 });
    
    let sequenceNumber = 1;
    if (lastVisit && lastVisit.visitId) {
      const lastSequence = parseInt(lastVisit.visitId.slice(-4));
      sequenceNumber = lastSequence + 1;
    }
    
    this.visitId = `VIS${currentYear}${currentMonth}${currentDay}${String(sequenceNumber).padStart(4, '0')}`;
  }

  // Calculate total amount from services
  if (this.services && this.services.length > 0) {
    this.totalAmount = this.services.reduce((total, service) => total + service.rate, 0);
  }

  next();
});

// Indexes for better performance
visitSchema.index({ patientId: 1 });
visitSchema.index({ visitDate: 1 });
visitSchema.index({ status: 1 });
visitSchema.index({ visitId: 1 });

module.exports = mongoose.model("Visit", visitSchema);
module.exports.MEDICOLEGAL_OPTIONS = MEDICOLEGAL_OPTIONS;