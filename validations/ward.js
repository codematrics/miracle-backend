const { z } = require("zod");

const createWardSchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
  type: z.enum(["general", "icu", "ward"]),
  name: z.string().min(1, { message: "Ward is required" }),
  floor: z.string().min(1, { message: "Floor is required" }).optional(),
});

const updateWardSchema = z.object({
  name: z.string().min(1, { message: "Ward is required" }).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  type: z.enum(["general", "icu", "ward"]).optional(),
  floor: z.string().min(1, { message: "Floor is required" }).optional(),
});

module.exports = { createWardSchema, updateWardSchema };
