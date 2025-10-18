const { z } = require("zod");

const createAppointmentSchema = z.object({
  patient: z.string().min(1, { message: "Patient is required" }),
  doctor: z.string().min(1, { message: "Doctor is required" }),
  appointmentDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" })
    .transform((val) => new Date(val))
    .refine(
      (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      },
      {
        message: "Invalid appointment date",
      }
    ),
  reason: z.string().min(1, { message: "Reason is required" }),
});

const updateAppointmentSchema = z.object({
  patient: z.string().min(1, { message: "Patient is required" }).optional(),
  doctor: z.string().min(1, { message: "Doctor is required" }).optional(),
  appointmentDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" })
    .transform((val) => new Date(val))
    .refine(
      (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      },
      {
        message: "Invalid appointment date",
      }
    )
    .optional(),
  reason: z.string().min(1, { message: "Reason is required" }).optional(),
});

module.exports = { createAppointmentSchema, updateAppointmentSchema };
