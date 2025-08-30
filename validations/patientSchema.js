const { z } = require("zod");
const {
  getEnumValues,
  RELATION_TYPES,
  AGE_UNITS,
  GENDER_TYPES,
  MARITAL_STATUS,
  RELIGIONS,
  OCCUPATIONS,
  ID_TYPES,
  PATIENT_TYPES,
  GENDER,
} = require("../constants/enums");

const addressSchema = z.object({
  village: z
    .string()
    .min(1, "Village is required")
    .max(100, "Village name too long"),
  state: z.string().min(1, "State is required").max(50, "State name too long"),
  district: z
    .string()
    .min(1, "District is required")
    .max(50, "District name too long"),
  tehsil: z
    .string()
    .min(1, "Tehsil is required")
    .max(50, "Tehsil name too long"),
  postOffice: z
    .string()
    .min(1, "Post Office is required")
    .max(50, "Post Office name too long"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
});

const createPatientSchema = z.object({
  name: z.string().min(1, { message: "Patient name is required" }),
  gender: z.enum(["Male", "Female", "Other"]),
  dob: z.string().optional(), // ISO date string
  age: z.number().optional(),
  patientCategory: z.string().optional(),
  mobileNumber: z.string().optional(),

  relation: z.enum(RELATION_TYPES),
  relativeName: z.string(),
  maritalStatus: z.enum(MARITAL_STATUS).optional(),
  religion: z.enum(RELIGIONS).optional(),
  occupation: z.string().optional(),
  email: z.email({ message: "Invalid email" }).optional(),
  idType: z.enum(ID_TYPES).optional(),
  idNo: z.string().optional(),

  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      district: z.string().optional(),
      tehsil: z.string().optional(),
      post: z.string().optional(),
      pincode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

const updatePatientSchema = createPatientSchema.partial();

const patientQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
  search: z.string().optional(),
});

module.exports = {
  createPatientSchema,
  updatePatientSchema,
  patientQuerySchema,
};
