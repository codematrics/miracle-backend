const { z } = require("zod");

const createBedSchema = z.object({
  status: z.enum(["available", "occupied", "maintenance"]).optional(),
  ward: z.string().min(1, { message: "Ward is required" }),
});

const updateBedSchema = z.object({
  bedNumber: z
    .string()
    .min(1, { message: "Bed number is required" })
    .optional(),
  status: z.enum(["available", "occupied", "maintenance"]).optional(),
  ward: z.string().min(1, { message: "Ward is required" }).optional(),
});

module.exports = { createBedSchema, updateBedSchema };
