const { z } = require("zod");
const { VISIT_TYPE } = require("../constants/enums");

const createVisitSchema = z.object({
  patientId: z.string().min(1, { message: "Patient ID is required" }),
  consultingDoctorId: z.string().min(1, { message: "Doctor ID is required" }),
  visitType: z.enum(VISIT_TYPE),
  referredBy: z.string().optional(),
  visitNote: z.string().optional(),
  medicoLegal: z.boolean().optional(),
  insuranceType: z.string().optional(),
  policyNumber: z.string().optional(),
  services: z.array(z.string()).optional(), // array of service IDs
});

const updateVisitSchema = createVisitSchema.partial();

const visitQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
  patientId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  from: z.string().optional(), // Made flexible for date strings
  to: z.string().optional(), // Made flexible for date strings
  all: z.string().optional(),
  // Patient-specific filters
  mobileNo: z.string().optional(), // Patient mobile number filter
  patientName: z.string().optional(), // Patient name filter
  uhid: z.string().optional(), // Patient UHID filter
  // Doctor and visit filters
  doctorName: z.string().optional(), // Visiting doctor filter
  visitType: z.string().optional(), // Visit type filter
  refby: z.string().optional(), // Referred by filter
});

module.exports = {
  createVisitSchema,
  updateVisitSchema,
  visitQuerySchema,
};
