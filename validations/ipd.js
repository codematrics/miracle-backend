const { z } = require("zod");

const createIPDSchema = z.object({
  bed: z.string().min(1, { message: "Bed ID is required" }),
  services: z
    .array(
      z.object({
        serviceId: z.string().min(1, { message: "Service ID is required" }),
        quantity: z
          .number()
          .min(1, { message: "Quantity must be at least 1" })
          .default(1),
        price: z
          .number()
          .min(0, { message: "Price must be greater than or equal to 0" }),
      })
    )
    .optional(),
  patient: z.string().min(1, { message: "Patient ID is required" }),
  referringDoctor: z
    .string()
    .min(1, { message: "Referring Doctor ID is required" }),
  totalAmount: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  netAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
});

const updateIPDSchema = z.object({
  bed: z.string().min(1, { message: "Bed ID is required" }).optional(),
  services: z
    .array(
      z.object({
        serviceId: z.string().min(1, { message: "Service ID is required" }),
        quantity: z
          .number()
          .min(1, { message: "Quantity must be at least 1" })
          .default(1),
        price: z
          .number()
          .min(0, { message: "Price must be greater than or equal to 0" }),
      })
    )
    .optional(),
  referringDoctor: z
    .string()
    .min(1, { message: "Referring Doctor ID is required" })
    .optional(),
  totalAmount: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  netAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  patientStatus: z.enum(["In Treatment", "Discharged"]).optional(),
});

module.exports = { createIPDSchema, updateIPDSchema };
