const { default: z } = require("zod");
const { REPORT_TYPE, FORMAT_TYPE, SAMPLE_TYPE } = require("../constants/enums");

const createLabTestSchema = z.object({
  testName: z.string().min(1, { message: "Test name is required" }),
  reportType: z.enum(Object.values(REPORT_TYPE)),
  formatType: z.enum(Object.values(FORMAT_TYPE)),
  sampleType: z.enum(Object.values(SAMPLE_TYPE)).optional(),
  methodology: z.string().optional(),
  isActive: z.boolean().optional(),
  isPrintable: z.boolean().optional(),
});

const updateLabTestSchema = z.object({
  testName: z.string().min(1, { message: "Test name is required" }).optional(),
  reportType: z.enum(Object.values(REPORT_TYPE)).optional(),
  formatType: z.enum(Object.values(FORMAT_TYPE)).optional(),
  sampleType: z.enum(Object.values(SAMPLE_TYPE)).optional(),
  methodology: z.string().optional(),
  isActive: z.boolean().optional(),
  isPrintable: z.boolean().optional(),
});

module.exports = { createLabTestSchema, updateLabTestSchema };
