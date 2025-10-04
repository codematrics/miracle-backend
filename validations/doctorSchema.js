const { z } = require("zod");

const createDoctorSchema = z.object({
  name: z.string().min(1, { message: "Doctor name is required" }),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  licenseNumber: z.string().min(1, { message: "License number is required" }),
  department: z.string().min(1, { message: "Department is required" }),
  designation: z.string().optional(),
  joiningDate: z.string().optional(), // ISO date string
  email: z.string().email({ message: "Invalid email" }).optional(),
  mobileNo: z.string().min(1, { message: "Mobile number is required" }),
  emergencyContact: z
    .string()
    .min(1, { message: "Emergency contact is required" }),
  availableDays: z
    .array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    .optional(),
  consultationTiming: z.string().optional(),
  streetAddress: z
    .string()
    .min(1, { message: "Street address is required" })
    .optional(),
  city: z.string().min(1, { message: "City is required" }).optional(),
  state: z.string().min(1, { message: "State is required" }).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional(),
  country: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string(),
});

const updateDoctorSchema = z.object({
  name: z.string().min(1, { message: "Doctor name is required" }).optional(),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  licenseNumber: z
    .string()
    .min(1, { message: "License number is required" })
    .optional(),
  department: z
    .string()
    .min(1, { message: "Department is required" })
    .optional(),
  designation: z.string().optional(),
  joiningDate: z.string().optional(), // ISO date string
  email: z.string().email({ message: "Invalid email" }).optional(),
  mobileNo: z
    .string()
    .min(1, { message: "Mobile number is required" })
    .optional(),
  emergencyContact: z
    .string()
    .min(1, { message: "Emergency contact is required" })
    .optional(),
  availableDays: z
    .array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    .optional(),
  consultationTiming: z.string().optional(),
  streetAddress: z
    .string()
    .min(1, { message: "Street address is required" })
    .optional(),
  city: z.string().min(1, { message: "City is required" }).optional(),
  state: z.string().min(1, { message: "State is required" }).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional(),
  country: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().optional(),
});

module.exports = { createDoctorSchema, updateDoctorSchema };
