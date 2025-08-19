const { z } = require('zod');

// Lab Order Schema
const createLabOrderSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  visitId: z.string().min(1, 'Visit ID is required'),
  opdBillingId: z.string().min(1, 'OPD Billing ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  serviceIds: z.array(z.string().min(1, 'Service ID is required')).min(1, 'At least one service is required'),
  priority: z.enum(['normal', 'urgent', 'stat']).default('normal'),
  instructions: z.string().max(1000, 'Instructions must not exceed 1000 characters').optional(),
  orderDate: z.string().datetime().optional().or(z.date().optional())
});

const updateLabOrderSchema = z.object({
  status: z.enum(['pending', 'collected', 'saved', 'authorized']).optional(),
  priority: z.enum(['normal', 'urgent', 'stat']).optional(),
  instructions: z.string().max(1000, 'Instructions must not exceed 1000 characters').optional(),
  collectedBy: z.string().optional(),
  savedBy: z.string().optional(),
  authorizedBy: z.string().optional()
});

const labOrderQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional().default(10),
  search: z.string().optional(),
  status: z.enum(['pending', 'collected', 'saved', 'authorized']).optional(),
  priority: z.enum(['normal', 'urgent', 'stat']).optional(),
  patientId: z.string().optional(),
  doctorId: z.string().optional(),
  accessionNo: z.string().optional(),
  from: z.string().optional(), // Date string
  to: z.string().optional(),   // Date string
  all: z.string().optional()
});

// Lab Order Test Schema
const updateLabOrderTestSchema = z.object({
  status: z.enum(['pending', 'collected', 'saved', 'authorized']).optional(),
  sampleType: z.string().optional(),
  containerType: z.string().optional(),
  instructions: z.string().max(500, 'Instructions must not exceed 500 characters').optional(),
  technician: z.string().optional(),
  machineUsed: z.string().max(100, 'Machine used must not exceed 100 characters').optional(),
  hemolyzed: z.boolean().optional(),
  lipemic: z.boolean().optional(),
  icteric: z.boolean().optional(),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').optional(),
  collectedBy: z.string().optional(),
  savedBy: z.string().optional(),
  authorizedBy: z.string().optional()
});

const collectSamplesSchema = z.object({
  testIds: z.array(z.string().min(1, 'Test ID is required')).min(1, 'At least one test ID is required'),
  collectedBy: z.string().min(1, 'Collector ID is required'),
  collectionData: z.record(z.string(), z.object({
    sampleType: z.string().optional(),
    containerType: z.string().optional(),
    hemolyzed: z.boolean().optional(),
    lipemic: z.boolean().optional(),
    icteric: z.boolean().optional(),
    remarks: z.string().max(1000).optional()
  })).optional()
});

// Parameter Master Schema
const createParameterSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  parameterName: z.string().min(1, 'Parameter name is required').max(200, 'Parameter name must not exceed 200 characters'),
  parameterCode: z.string().min(1, 'Parameter code is required').max(20, 'Parameter code must not exceed 20 characters'),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit must not exceed 50 characters'),
  referenceRange: z.string().min(1, 'Reference range is required').max(200, 'Reference range must not exceed 200 characters'),
  maleRange: z.string().max(200, 'Male range must not exceed 200 characters').optional(),
  femaleRange: z.string().max(200, 'Female range must not exceed 200 characters').optional(),
  childRange: z.string().max(200, 'Child range must not exceed 200 characters').optional(),
  adultRange: z.string().max(200, 'Adult range must not exceed 200 characters').optional(),
  dataType: z.enum(['numeric', 'text', 'boolean', 'select']).default('numeric'),
  selectOptions: z.array(z.object({
    value: z.string(),
    label: z.string()
  })).optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  decimalPlaces: z.number().default(2),
  criticalLow: z.number().optional(),
  criticalHigh: z.number().optional(),
  printOnReport: z.boolean().default(true),
  formula: z.string().max(500, 'Formula must not exceed 500 characters').optional(),
  methodology: z.string().max(200, 'Methodology must not exceed 200 characters').optional(),
  instrumentUsed: z.string().max(100, 'Instrument must not exceed 100 characters').optional()
});

const updateParameterSchema = createParameterSchema.partial();

const parameterQuerySchema = z.object({
  serviceId: z.string().optional(),
  isActive: z.boolean().optional(),
  dataType: z.enum(['numeric', 'text', 'boolean', 'select']).optional(),
  search: z.string().optional(),
  all: z.string().optional()
});

// Lab Result Schema
const saveResultsSchema = z.object({
  labOrderTestId: z.string().min(1, 'Lab order test ID is required'),
  results: z.array(z.object({
    parameterId: z.string().min(1, 'Parameter ID is required'),
    value: z.union([z.string(), z.number(), z.boolean()]).refine(val => val !== null && val !== undefined, {
      message: 'Value is required'
    }),
    technicalRemarks: z.string().max(1000, 'Technical remarks must not exceed 1000 characters').optional(),
    instrumentUsed: z.string().optional(),
    methodUsed: z.string().optional(),
    dilutionFactor: z.number().positive().optional(),
    flags: z.object({
      hemolyzed: z.boolean().optional(),
      lipemic: z.boolean().optional(),
      icteric: z.boolean().optional(),
      clotted: z.boolean().optional(),
      insufficient: z.boolean().optional()
    }).optional()
  })).min(1, 'At least one result is required'),
  enteredBy: z.string().min(1, 'Entered by is required'),
  technician: z.string().optional()
});

const updateResultSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  technicalRemarks: z.string().max(1000, 'Technical remarks must not exceed 1000 characters').optional(),
  clinicalRemarks: z.string().max(1000, 'Clinical remarks must not exceed 1000 characters').optional(),
  instrumentUsed: z.string().optional(),
  methodUsed: z.string().optional(),
  dilutionFactor: z.number().positive().optional(),
  flags: z.object({
    hemolyzed: z.boolean().optional(),
    lipemic: z.boolean().optional(),
    icteric: z.boolean().optional(),
    clotted: z.boolean().optional(),
    insufficient: z.boolean().optional()
  }).optional(),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional()
});

const authorizeResultsSchema = z.object({
  resultIds: z.array(z.string().min(1, 'Result ID is required')).min(1, 'At least one result ID is required'),
  authorizedBy: z.string().min(1, 'Authorized by is required'),
  clinicalRemarks: z.string().max(1000, 'Clinical remarks must not exceed 1000 characters').optional(),
  bulkRemarks: z.string().max(1000, 'Bulk remarks must not exceed 1000 characters').optional()
});

const resultQuerySchema = z.object({
  labOrderTestId: z.string().optional(),
  labOrderId: z.string().optional(),
  patientId: z.string().optional(),
  status: z.enum(['pending', 'saved', 'authorized']).optional(),
  isCritical: z.boolean().optional(),
  isAbnormal: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional().default(10)
});

// Report Schema
const reportQuerySchema = z.object({
  accessionNo: z.string().min(1, 'Accession number is required'),
  format: z.enum(['json', 'pdf']).default('json'),
  includeRanges: z.boolean().default(true),
  includeFlags: z.boolean().default(true),
  includeRemarks: z.boolean().default(true)
});

// Bulk Operations Schema
const bulkUpdateStatusSchema = z.object({
  orderIds: z.array(z.string().min(1, 'Order ID is required')).optional(),
  testIds: z.array(z.string().min(1, 'Test ID is required')).optional(),
  resultIds: z.array(z.string().min(1, 'Result ID is required')).optional(),
  status: z.enum(['pending', 'collected', 'saved', 'authorized']),
  updatedBy: z.string().min(1, 'Updated by is required'),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').optional()
}).refine((data) => {
  const hasIds = data.orderIds?.length || data.testIds?.length || data.resultIds?.length;
  return hasIds > 0;
}, {
  message: 'At least one ID array must be provided and non-empty',
  path: ['orderIds']
});

module.exports = {
  // Lab Order schemas
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderQuerySchema,
  
  // Lab Order Test schemas
  updateLabOrderTestSchema,
  collectSamplesSchema,
  
  // Parameter Master schemas
  createParameterSchema,
  updateParameterSchema,
  parameterQuerySchema,
  
  // Lab Result schemas
  saveResultsSchema,
  updateResultSchema,
  authorizeResultsSchema,
  resultQuerySchema,
  
  // Report schemas
  reportQuerySchema,
  
  // Bulk operation schemas
  bulkUpdateStatusSchema
};