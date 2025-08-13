const { z } = require("zod");
const { MEDICOLEGAL_OPTIONS } = require("../models/Visit");

const visitServiceSchema = z.object({
  serviceId: z
    .string()
    .min(1, "Service ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Service ID must be a valid MongoDB ObjectId"),
  
  serviceName: z
    .string()
    .min(1, "Service name is required")
    .max(100, "Service name too long")
    .trim(),
  
  serviceCode: z
    .string()
    .min(1, "Service code is required")
    .max(20, "Service code too long")
    .trim(),
  
  rate: z
    .number()
    .min(0, "Rate cannot be negative")
    .max(999999, "Rate too high")
});

const createVisitSchema = z.object({
  patientId: z
    .string()
    .min(1, "Patient ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Patient ID must be a valid MongoDB ObjectId")
    .optional(), // Made optional since it might be provided in URL
  
  refby: z
    .string()
    .min(1, "Referred by is required")
    .max(100, "Referred by too long")
    .trim(),
  
  visitingdoctor: z
    .string()
    .min(1, "Visiting doctor is required")
    .max(100, "Visiting doctor too long")
    .trim(),
  
  visittype: z
    .string()
    .min(1, "Visit type is required")
    .max(50, "Visit type too long")
    .trim(),
  
  medicolegal: z.enum(MEDICOLEGAL_OPTIONS, {
    errorMap: () => ({
      message: `Medicolegal must be one of: ${MEDICOLEGAL_OPTIONS.join(', ')}`
    })
  }).default('No'),
  
  mediclaim_type: z
    .string()
    .min(1, "Mediclaim type is required")
    .max(50, "Mediclaim type too long")
    .trim(),
  
  services: z
    .array(visitServiceSchema)
    .min(1, "At least one service is required")
    .max(20, "Too many services (maximum 20 allowed)"),
  
  visitDate: z
    .string()
    .datetime()
    .optional()
    .or(z.date().optional()),
  
  status: z
    .enum(['active', 'completed', 'cancelled'])
    .default('active')
    .optional()
});

const updateVisitSchema = createVisitSchema.partial();

const visitQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  patientId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

module.exports = {
  createVisitSchema,
  updateVisitSchema,
  visitQuerySchema,
};