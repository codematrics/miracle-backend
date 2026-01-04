const { z } = require("zod");
const { SERVICE_CATEGORIES, SERVICE_STATUS } = require("../models/Service");
const { FORMAT_TYPE, SAMPLE_TYPE } = require("../constants/enums");
const createServiceSchema = z.object({
  serviceHead: z.string().min(1, { message: "Service head is required" }),
  serviceName: z.string().min(1, { message: "Service name is required" }),
  serviceType: z.string().min(1, { message: "Service type is required" }),
  unit: z.string().optional(),
  headType: z.string().optional(),
  serviceApplicableOn: z.enum(["OPD", "IPD", "Both"]),
  isOutSource: z.boolean().optional(),
  isActive: z.boolean().optional(),
  price: z
    .number()
    .min(1, { message: "Price must be positive and greater than 0." }),
});

const updateServiceSchema = z.object({
  serviceHead: z
    .string()
    .min(1, { message: "Service head is required" })
    .optional(),
  serviceName: z
    .string()
    .min(1, { message: "Service name is required" })
    .optional(),
  serviceType: z
    .string()
    .min(1, { message: "Service type is required" })
    .optional(),
  unit: z.string().optional(),
  headType: z.string().optional(),
  serviceApplicableOn: z.enum(["OPD", "IPD", "Both"]).optional(),
  isOutSource: z.boolean().optional().optional(),
  isActive: z.boolean().optional().optional(),
  price: z
    .number()
    .min(1, { message: "Price must be positive and greater than 0." })
    .optional(),
});

const serviceQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  // category: z.enum(SERVICE_CATEGORIES).optional(),
  // status: z.enum(SERVICE_STATUS).optional(),
  all: z.string().optional(),
});

module.exports = {
  createServiceSchema,
  updateServiceSchema,
  serviceQuerySchema,
};
