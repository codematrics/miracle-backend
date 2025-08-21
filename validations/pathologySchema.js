const { z } = require('zod');

const createPathologySchema = z.object({
  accession: z.string().optional(), // Auto-generated if not provided
  orderDate: z.string().datetime().optional().or(z.date().optional()),
  reportName: z.string().min(1, 'Report name is required').max(100, 'Report name must not exceed 100 characters'),
  serviceName: z.string().min(1, 'Service name is required').max(500, 'Service name must not exceed 500 characters'),
  consultantDoctor: z.string().min(1, 'Consultant doctor is required').max(100, 'Consultant doctor name must not exceed 100 characters'),
  referringDoctor: z.string().min(1, 'Referring doctor is required').max(100, 'Referring doctor name must not exceed 100 characters'),
  uhid: z.string().min(1, 'UHID is required'),
  patientName: z.string().min(1, 'Patient name is required').max(100, 'Patient name must not exceed 100 characters'),
  age: z.number().min(0, 'Age cannot be negative').max(150, 'Age cannot exceed 150 years'),
  ageUnit: z.enum(['Year', 'Month', 'Day'], {
    errorMap: () => ({ message: 'Age unit must be Year, Month, or Day' })
  }).default('Year'),
  sex: z.enum(['M', 'F', 'O'], {
    errorMap: () => ({ message: 'Sex must be M (Male), F (Female), or O (Other)' })
  }),
  visitNo: z.string().min(1, 'Visit number is required'),
  patientId: z.string().optional(), // ObjectId reference
  billId: z.string().optional(), // ObjectId reference
  status: z.enum(['pending', 'in_progress', 'completed', 'reported', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be one of: pending, in_progress, completed, reported, cancelled' })
  }).default('pending'),
  priority: z.enum(['normal', 'urgent', 'stat'], {
    errorMap: () => ({ message: 'Priority must be normal, urgent, or stat' })
  }).default('normal'),
  sampleCollectionDate: z.string().datetime().optional().or(z.date().optional()),
  reportDate: z.string().datetime().optional().or(z.date().optional()),
  technicianName: z.string().max(100, 'Technician name must not exceed 100 characters').optional(),
  pathologistName: z.string().max(100, 'Pathologist name must not exceed 100 characters').optional(),
  reportData: z.any().optional(), // Mixed type for test results
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').optional(),
  totalAmount: z.number().min(0, 'Total amount cannot be negative').default(0),
  paidAmount: z.number().min(0, 'Paid amount cannot be negative').default(0),
  balanceAmount: z.number().optional() // Auto-calculated
}).refine((data) => {
  // Validate that paid amount doesn't exceed total amount
  if (data.paidAmount > data.totalAmount) {
    return false;
  }
  return true;
}, {
  message: 'Paid amount cannot exceed total amount',
  path: ['paidAmount']
}).refine((data) => {
  // Validate that sample collection date is not in the future for completed reports
  if (data.status === 'completed' && data.sampleCollectionDate) {
    const collectionDate = new Date(data.sampleCollectionDate);
    const now = new Date();
    if (collectionDate > now) {
      return false;
    }
  }
  return true;
}, {
  message: 'Sample collection date cannot be in the future',
  path: ['sampleCollectionDate']
});

const updatePathologySchema = createPathologySchema.partial();

const pathologyQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional().default(10),
  search: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'reported', 'cancelled']).optional(),
  priority: z.enum(['normal', 'urgent', 'stat']).optional(),
  reportName: z.string().optional(),
  patientId: z.string().optional(),
  uhid: z.string().optional(),
  visitNo: z.string().optional(),
  from: z.string().optional(), // Date string for orderDate range
  to: z.string().optional(),   // Date string for orderDate range
  consultantDoctor: z.string().optional(),
  referringDoctor: z.string().optional(),
  all: z.string().optional()
});

// Bulk create schema for importing multiple pathology entries
const bulkCreatePathologySchema = z.object({
  entries: z.array(createPathologySchema).min(1, 'At least one pathology entry is required').max(100, 'Cannot create more than 100 entries at once')
});

// Update status schema for batch operations
const updateStatusSchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one pathology ID is required'),
  status: z.enum(['pending', 'in_progress', 'completed', 'reported', 'cancelled']),
  technicianName: z.string().optional(),
  pathologistName: z.string().optional(),
  sampleCollectionDate: z.string().datetime().optional().or(z.date().optional()),
  reportDate: z.string().datetime().optional().or(z.date().optional()),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').optional()
});

module.exports = {
  createPathologySchema,
  updatePathologySchema,
  pathologyQuerySchema,
  bulkCreatePathologySchema,
  updateStatusSchema
};