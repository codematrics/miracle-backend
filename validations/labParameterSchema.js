const { default: z } = require("zod");
const {
  AGE_UNITS,
  GENDER_WITH_ALL,
  REPORT_TYPE,
  FORMAT_TYPE,
  SAMPLE_TYPE,
} = require("../constants/enums");

const bioReferenceSchema = z.object({
  unit: z.string().optional(),
  ageFrom: z.number().min(0, "ageFrom must be >= 0"),
  ageTo: z.number().min(0, "ageTo must be >= 0"),
  ageType: z.enum(AGE_UNITS),
  gender: z.enum(GENDER_WITH_ALL),
  range: z.string().min(1, "Range is required"),
  min: z.number(),
  max: z.number(),
  criticalLess: z.number().optional(),
  criticalGreat: z.number().optional(),
});

const createLabParameterSchema = z.object({
  parameterName: z.string().min(1, "Parameter name is required"),
  reportType: z.enum(REPORT_TYPE),
  formatType: z.enum(FORMAT_TYPE),
  sampleType: z.enum(SAMPLE_TYPE).optional(),
  isPrintable: z.boolean().default(true),
  bioReference: z.array(bioReferenceSchema).optional(),
  interpretationType: z
    .enum(GENDER_WITH_ALL)
    .nonoptional("interpretation type is required"),
  interpretationMale: z.string().optional(),
  interpretationFemale: z.string().optional(),
  interpretationBoth: z.string().optional(),
  methodology: z.string().optional(),
  isActive: z.boolean().default(true),
});

module.exports = { createLabParameterSchema };
