const { z } = require("zod");
const { PARAMETER_DATATYPE_ENUM } = require("../constants/enums");

const ParameterSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  parameterName: z.string().min(1, "Parameter name is required"),
  parameterCode: z.string().optional().transform((str) => str?.toUpperCase()), // making it optional, auto-generate if not provided
  unit: z.string().optional(),
  referenceRange: z.string().optional(),

  maleRange: z.string().optional(),
  femaleRange: z.string().optional(),
  childRange: z.string().optional(),
  adultRange: z.string().optional(),

  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  decimalPlaces: z.number().int().min(0).max(5).optional(),

  dataType: z.enum(PARAMETER_DATATYPE_ENUM),
  options: z.array(z.string()).optional(),

  criticalLow: z.number().optional(),
  criticalHigh: z.number().optional(),

  formula: z.string().optional(),
  methodology: z.string().optional(),
  instrumentUsed: z.string().optional(),

  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  printOnReport: z.boolean().default(true),
});

const parameterQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
  serviceId: z.string().optional(), // filter by service
  status: z.enum(["active", "inactive"]).optional(),
  dataType: z.enum(PARAMETER_DATATYPE_ENUM).optional(),
  all: z.string().optional(),
});

module.exports = {
  ParameterSchema,
  parameterQuerySchema,
};
