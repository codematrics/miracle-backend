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
  patientName: z
    .string()
    .min(1, "Patient name is required")
    .max(100, "Patient name too long")
    .regex(
      /^[a-zA-Z\s\.]+$/,
      "Patient name should only contain letters, spaces, and dots"
    ),

  relation: z.enum(RELATION_TYPES, {
    errorMap: () => ({
      message: "Relation must be one of: S/O, W/O, D/O, Other",
    }),
  }),

  fatherOrHusbandName: z
    .string()
    .min(1, "Father/Husband name is required")
    .max(100, "Father/Husband name too long")
    .regex(
      /^[a-zA-Z\s\.]+$/,
      "Father/Husband name should only contain letters, spaces, and dots"
    ),

  age: z
    .number()
    .int("Age must be an integer")
    .min(0, "Age cannot be negative")
    .max(150, "Age seems unrealistic"),

  ageUnit: z.enum(AGE_UNITS, {
    errorMap: () => ({
      message: "Age unit must be one of: Year, Month, Day",
    }),
  }),

  gender: z.enum(GENDER_TYPES, {
    errorMap: () => ({
      message: "Gender must be one of: Male, Female, Other",
    }),
  }),

  maritalStatus: z.enum(MARITAL_STATUS).optional().nullable().or(z.literal("")),

  religion: z.enum(RELIGIONS).optional().nullable().or(z.literal("")),

  occupation: z.enum(OCCUPATIONS).optional().nullable().or(z.literal("")),

  mobileNo: z
    .string()
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),

  emailId: z
    .string()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("")),

  idType: z.enum(ID_TYPES, {
    errorMap: () => ({
      message:
        "ID type must be one of: Aadhar Card, Pancard, Driving license, Voter ID, Passport",
    }),
  }),

  idNo: z
    .string()
    .min(1, "ID number is required")
    .max(20, "ID number too long")
    .regex(
      /^[A-Za-z0-9]+$/,
      "ID number should only contain letters and numbers"
    ),

  patientType: z.enum(PATIENT_TYPES).default("General"),

  address: addressSchema,
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
