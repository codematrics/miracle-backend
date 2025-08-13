const mongoose = require("mongoose");

const SERVICE_CATEGORIES = [
  'consultation',
  'diagnostic', 
  'laboratory',
  'radiology',
  'procedure',
  'surgery',
  'pharmacy',
  'emergency',
  'other'
];

const SERVICE_STATUS = ['active', 'inactive'];

const serviceSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [100, 'Service name must not exceed 100 characters']
    },
    code: { 
      type: String, 
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Service code must be at least 2 characters'],
      maxlength: [20, 'Service code must not exceed 20 characters'],
      match: [/^[A-Z0-9_]+$/, 'Service code should only contain uppercase letters, numbers, and underscores']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
      default: ''
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: SERVICE_CATEGORIES,
        message: 'Category must be one of: ' + SERVICE_CATEGORIES.join(', ')
      }
    },
    rate: { 
      type: Number, 
      required: true,
      min: [0, 'Rate cannot be negative']
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: SERVICE_STATUS,
        message: 'Status must be one of: ' + SERVICE_STATUS.join(', ')
      },
      default: 'active'
    },
    // Keep old fields for backward compatibility
    serviceId: { 
      type: String, 
      unique: true,
      sparse: true
    },
    serviceName: { 
      type: String,
      trim: true
    },
    serviceCode: { 
      type: String,
      trim: true,
      sparse: true
    },
  },
  { timestamps: true }
);

// Indexes for better performance
serviceSchema.index({ category: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ code: 1 });
serviceSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model("Service", serviceSchema);
module.exports.SERVICE_CATEGORIES = SERVICE_CATEGORIES;
module.exports.SERVICE_STATUS = SERVICE_STATUS;