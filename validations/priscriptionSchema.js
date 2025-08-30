// validations/prescription.validation.js
const { z } = require("zod");

const medicineSchema = z.object({
  medicineName: z.string().min(1, "Medicine name is required"),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
});

const createPrescriptionSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  doctorId: z.string().min(1, "Doctor ID is required").optional(),
  visitId: z.string().optional(),
  medicines: z
    .array(medicineSchema)
    .min(1, "At least one medicine is required"),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
});

module.exports = { createPrescriptionSchema };
