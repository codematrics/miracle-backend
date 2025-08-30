const { z } = require("zod");
const { PAYMENT_MODES, PRIORITY } = require("../constants/enums");

const serviceSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  price: z.number().min(0, "Rate must be greater than or equal to 0"),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  amount: z.number().min(0, "Amount must be greater than or equal to 0"),
});

const billingSchema = z.object({
  grossAmount: z
    .number()
    .min(0, "Gross Amount must be greater than or equal to 0"),
  discount: z
    .number()
    .min(0, "Discount value must be greater than or equal to 0")
    .default(0),
  netAmount: z.number().min(0, "Net amount must be greater than or equal to 0"),
});

const createOpdBillingSchema = z
  .object({
    patient: z.string().min(1, "Patient ID is required"),
    referredBy: z.string().min(1, "Ref By is required"),
    consultantDoctor: z.string().min(1, "Doctor ID is required").trim(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    paidAmount: z
      .number()
      .min(0, "Paid amount must be greater than or equal to 0")
      .default(0),
    services: z.array(serviceSchema).min(1, "At least one service is required"),
    billing: billingSchema,
  })
  .refine(
    (data) => data.services.every((s) => s.amount === s.price * s.quantity),
    {
      message: "Service amounts must equal rate × quantity",
      path: ["services"],
    }
  )
  .refine(
    (data) => {
      const servicesTotal = data.services.reduce((sum, s) => sum + s.amount, 0);
      const expectedNet = servicesTotal - data.billing.discount;
      return Math.abs(data.billing.netAmount - expectedNet) < 0.01;
    },
    {
      message: "Net amount must equal services total minus discount",
      path: ["billing", "netAmount"],
    }
  )
  .refine(
    (data) => {
      const expectedBalance = data.billing.netAmount - data.paidAmount;
      return expectedBalance >= 0;
    },
    {
      message: "Paid amount cannot exceed Net amount",
      path: ["paidAmount"],
    }
  );

const updateOpdBillingSchema = createOpdBillingSchema.partial();

const opdBillingQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a number")
    .transform(Number)
    .optional()
    .default(1),
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .transform(Number)
    .optional()
    .default(10),
  search: z.string().optional(),
  status: z.enum(["pending", "paid", "partial", "cancelled"]).optional(),
  patientId: z.string().optional(),
  from: z.string().optional(), // Date string
  to: z.string().optional(), // Date string
  all: z.string().optional(),
});

module.exports = {
  createOpdBillingSchema,
  updateOpdBillingSchema,
  opdBillingQuerySchema,
};
