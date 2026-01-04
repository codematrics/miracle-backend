const { z } = require("zod");

const primaryExaminationZodSchema = z.object({
  visitId: z.string().min(1),
  patientId: z.string().min(1),

  complaints: z
    .array(z.string().min(1))
    .min(1, "At least one complaint required"),
  history: z.string().optional(),

  vitals: z.object({
    height: z.coerce.number().optional(),
    weight: z.coerce.number().optional(),
    spo2: z.coerce.number().optional(),
    pulse: z.coerce.number().optional(),
    bp: z.string().optional(),
    resp: z.coerce.number().optional(),
    temp: z.coerce.number().optional(),
  }),

  femaleDetails: z
    .object({
      lmp: z.coerce.string().optional(),
      edd: z.coerce.string().optional(),
      gravida: z.coerce.number().optional(),
      parity: z.coerce.number().optional(),
      noOfChild: z.coerce.number().optional(),
    })
    .optional(),

  investigations: z.array(z.string()).optional(),
  investigationAdvised: z.string().optional(),
});

module.exports = { primaryExaminationZodSchema };
