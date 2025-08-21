const { z } = require("zod");
const { SERVICE_CATEGORIES, SERVICE_STATUS } = require("../models/Service");

const createServiceSchema = z
  .object({
    name: z
      .string()
      .min(2, "Service name must be at least 2 characters")
      .max(100, "Service name must not exceed 100 characters")
      .trim(),

    code: z
      .string()
      .min(2, "Service code must be at least 2 characters")
      .max(20, "Service code must not exceed 20 characters")
      .regex(
        /^[A-Z0-9_]+$/,
        "Service code should only contain uppercase letters, numbers, and underscores"
      )
      .trim()
      .transform((str) => str.toUpperCase()),

    description: z
      .string()
      .max(500, "Description must not exceed 500 characters")
      .trim()
      .optional()
      .default(""),

    category: z.enum(SERVICE_CATEGORIES, {
      errorMap: () => ({
        message: `Category must be one of: ${SERVICE_CATEGORIES.join(", ")}`,
      }),
    }),

    rate: z
      .number()
      .min(0, "Rate cannot be negative")
      .max(999999, "Rate too high"),

    status: z
      .enum(SERVICE_STATUS, {
        errorMap: () => ({
          message: `Status must be one of: ${SERVICE_STATUS.join(", ")}`,
        }),
      })
      .default("active"),

    reportName: z
      .string()
      .max(100, "Report name must not exceed 100 characters")
      .optional(),

    // Backward compatibility
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
    serviceCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.category === "pathology" || data.category === "radiology") &&
      !data.reportName
    ) {
      ctx.addIssue({
        path: ["reportName"],
        code: z.ZodIssueCode.custom,
        message:
          "Report name is required when category is pathology or radiology",
      });
    }
  });

const updateServiceSchema = createServiceSchema.partial();

const serviceQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  status: z.enum(SERVICE_STATUS).optional(),
  all: z.string().optional(),
});

module.exports = {
  createServiceSchema,
  updateServiceSchema,
  serviceQuerySchema,
};
