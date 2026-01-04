// validations/prescription.validation.js
const { z } = require("zod");

const createServiceTypeSchema = z.object({
  name: z.string().min(1, "Name is Required"),
  serviceHead: z.string().min(1, "Service Head is Required"),
});

const updateServiceTypeSchema = z.object({
  serviceHead: z.string().min(1, "Service Head is Required"),
  name: z.string().min(1, "Name is Required").optional(),
});

module.exports = { createServiceTypeSchema, updateServiceTypeSchema };
