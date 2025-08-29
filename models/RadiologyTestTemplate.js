const mongoose = require("mongoose");

const radiologyTemplateSchema = new mongoose.Schema(
  {
    templateName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    templateContent: {
      type: String,
      required: true,
      // Rich text content with placeholders for dynamic values
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
radiologyTemplateSchema.index({ templateName: 1, isActive: 1 });

module.exports = mongoose.model("RadiologyTemplate", radiologyTemplateSchema);