const { z } = require("zod");

const createBedSchema = z
  .object({
    bedNumberFrom: z
      .number({ invalid_type_error: "Bed Number From must be a number" })
      .min(1, "Bed Number From must be at least 1"),
    bedNumberTo: z
      .number({ invalid_type_error: "Bed Number To must be a number" })
      .min(1, "Bed Number To must be at least 1"),
    status: z.enum(["available", "occupied", "maintenance"]).optional(),
    ward: z.string().min(1, { message: "Ward is required" }),
    floor: z.string().min(1, { message: "Floor is required" }),
  })
  .refine((data) => data.bedNumberTo >= data.bedNumberFrom, {
    message: "Bed Number To must be greater than or equal to Bed Number From",
    path: ["bedNumberTo"],
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
