const { z } = require("zod");

const createFloorSchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
  name: z.string().min(1, { message: "Floor is required" }),
});

const updateFloorSchema = z.object({
  name: z.string().min(1, { message: "Floor is required" }).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

module.exports = { createFloorSchema, updateFloorSchema };
