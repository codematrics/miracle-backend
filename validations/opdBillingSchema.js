const { z } = require("zod");
const { PAYMENT_MODES, PRIORITY } = require("../constants/enums");

const patientInfoSchema = z.object({
  uhid: z.string().min(1, "UHID is required"),
  name: z.string().min(1, "Patient name is required"),
  fatherOrHusbandName: z.string().min(1, "Father/Husband name is required"),
  mobileNo: z.string().min(10, "Valid mobile number is required"),
  age: z.number().min(1, "Age is required"),
  gender: z.enum(["Male", "Female", "Other"], {
    errorMap: () => ({ message: "Gender must be Male, Female, or Other" }),
  }),
});

const serviceSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  serviceName: z.string().min(1, "Service name is required"),
  serviceCode: z.string().min(1, "Service code is required"),
  rate: z.number().min(0, "Rate must be greater than or equal to 0"),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  amount: z.number().min(0, "Amount must be greater than or equal to 0"),
});

const billingSchema = z.object({
  grandTotal: z
    .number()
    .min(0, "Grand total must be greater than or equal to 0"),
  discountPercent: z
    .number()
    .min(0, "Discount percent must be greater than or equal to 0")
    .max(100, "Discount percent cannot exceed 100")
    .default(0),
  discountValue: z
    .number()
    .min(0, "Discount value must be greater than or equal to 0")
    .default(0),
  paidAmount: z
    .number()
    .min(0, "Paid amount must be greater than or equal to 0"),
  balanceAmount: z.number().default(0),
});

const createOpdBillingSchema = z
  .object({
    patientId: z.string().min(1, "Patient ID is required"),
    patientInfo: patientInfoSchema,
    patientCategory: z.string().min(1, "Patient Category is required"),
    refby: z.string().min(1, "Ref By is required"),
    doctorId: z.string().min(1, "Doctor ID is required").max(20, "Doctor ID too long").trim(),
    priority: z.enum(PRIORITY).optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    paidAmount: z
      .number()
      .min(0, "Paid amount must be greater than or equal to 0")
      .default(0),
    services: z.array(serviceSchema).min(1, "At least one service is required"),
    billing: billingSchema,
  })
  .refine(
    (data) => {
      // Validate that service amounts match rate * quantity
      for (const service of data.services) {
        if (service.amount !== service.rate * service.quantity) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Service amounts must equal rate × quantity",
      path: ["services"],
    }
  )
  .refine(
    (data) => {
      // Validate that grand total matches services total minus discount
      const servicesTotal = data.services.reduce(
        (sum, service) => sum + service.amount,
        0
      );
      const discountAmount = data.billing.discountPercent
        ? (servicesTotal * data.billing.discountPercent) / 100
        : data.billing.discountValue;
      const expectedGrandTotal = servicesTotal - discountAmount;

      return Math.abs(data.billing.grandTotal - expectedGrandTotal) < 0.01; // Allow for floating point precision
    },
    {
      message: "Grand total must equal services total minus discount",
      path: ["billing", "grandTotal"],
    }
  )
  .refine(
    (data) => {
      // Validate that balance amount is correct
      const expectedBalance = data.billing.grandTotal - data.billing.paidAmount;
      return Math.abs(data.billing.balanceAmount - expectedBalance) < 0.01; // Allow for floating point precision
    },
    {
      message: "Balance amount must equal grand total minus paid amount",
      path: ["billing", "balanceAmount"],
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
