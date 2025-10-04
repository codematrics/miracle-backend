const { z } = require("zod");
const { ROLES } = require("../constants/enums");

const createUserSchema = z.object({
  firstName: z.string().min(1, { message: "First Name is required" }),
  lastName: z.string().min(1, { message: "Last Name is required" }),
  email: z.email(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  role: z.enum(ROLES),
  isActive: z.boolean(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1, { message: "Patient is required" }).optional(),
  lastName: z.string().min(1, { message: "Doctor is required" }).optional(),
  email: z.email().optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    )
    .optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createUserSchema, updateUserSchema };
