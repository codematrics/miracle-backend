const { z } = require('zod');

const signupSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(255, "Email too long")
    .toLowerCase(),
  
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number")
});

const loginSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .toLowerCase(),
  
  password: z.string()
    .min(1, "Password is required")
});

module.exports = {
  signupSchema,
  loginSchema
};