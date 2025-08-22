const express = require("express");
const router = express.Router();
const ParameterMaster = require("../models/ParameterMaster");
const {
  ParameterSchema,
  parameterQuerySchema,
} = require("../validations/parameterSchema");
const { validate } = require("../middleware/validation");
const {
  combineQueries,
  paginate,
  buildSearchQuery,
} = require("../lib/pagination");
// ✅ Get Parameters with pagination & populate service details
router.get("/", validate(parameterQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/parameters - Request received`
  );

  try {
    const { page, limit, search, serviceId, dataType, status, all } = req.query;

    // Build query
    const serviceQuery = serviceId ? { serviceId } : {};
    const statusQuery = status
      ? { isActive: status === "active" } // ✅ matches your schema
      : {};
    const dataTypeQuery = dataType ? { dataType: dataType } : {};
    const searchQuery = buildSearchQuery(search, [
      "parameterName",
      "parameterCode",
      "unit",
      "referenceRange",
    ]);

    const finalQuery = combineQueries(
      serviceQuery,
      statusQuery,
      searchQuery,
      dataTypeQuery
    );

    // ✅ Paginate & populate service
    const result = await paginate(ParameterMaster, {
      query: finalQuery,
      page,
      limit,
      all: all === "true",
      populate: {
        path: "serviceId",
        select: "name code reportName category", // pick only needed fields
      },
    });

    const logMessage =
      all === "true"
        ? `Retrieved all ${result.data.length} parameters`
        : `Retrieved ${result.data.length} parameters`;

    console.log(
      `[${new Date().toISOString()}] GET /api/parameters - SUCCESS 200 - ${logMessage}`
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      total: result.total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/parameters - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Function to generate unique parameter code
async function generateParameterCode(serviceId, parameterName) {
  // Get the service to use in code generation
  const Service = require("../models/Service");
  const service = await Service.findById(serviceId);
  
  if (!service) {
    throw new Error("Service not found");
  }
  
  // Get service code prefix (first 3 letters)
  const servicePrefix = service.code.substring(0, 3);
  
  // Get parameter name prefix (first 3 letters, removing spaces/special chars)
  const paramPrefix = parameterName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase();
  
  // Find the highest existing sequence number for this service
  const pattern = new RegExp(`^${servicePrefix}_${paramPrefix}_\\d+$`);
  const existingParams = await ParameterMaster.find({ 
    serviceId: serviceId,
    parameterCode: pattern 
  })
    .sort({ parameterCode: -1 })
    .limit(1);
  
  let sequenceNumber = 1;
  if (existingParams.length > 0) {
    const lastCode = existingParams[0].parameterCode;
    const lastSequence = parseInt(lastCode.split('_').pop());
    if (!isNaN(lastSequence)) {
      sequenceNumber = lastSequence + 1;
    }
  }
  
  // Format: SERVICEPREFIX_PARAMPREFIX_SEQUENCE (e.g., LAB_HGB_001)
  return `${servicePrefix}_${paramPrefix}_${String(sequenceNumber).padStart(3, '0')}`;
}

// ✅ Create Parameter
router.post("/", validate(ParameterSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/parameters - Request received`
  );
  
  try {
    // Generate unique parameter code if not provided
    if (!req.body.parameterCode) {
      req.body.parameterCode = await generateParameterCode(req.body.serviceId, req.body.parameterName);
    } else {
      // Check if manually provided code exists for this service
      const existingParam = await ParameterMaster.findOne({
        serviceId: req.body.serviceId,
        parameterCode: req.body.parameterCode,
      });

      if (existingParam) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/parameters - ERROR 400 - Parameter code already exists: ${req.body.parameterCode}`
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [
            {
              field: "parameterCode",
              message: "Parameter code already exists for this service",
            },
          ],
        });
      }
    }

    const param = new ParameterMaster(req.body);
    await param.save();
    
    console.log(
      `[${new Date().toISOString()}] POST /api/parameters - SUCCESS 201 - Parameter created: ${param.parameterName}`
    );
    
    res.status(201).json({ 
      success: true, 
      message: "Parameter created successfully",
      data: param 
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/parameters - ERROR 400:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ Get Parameters by Service
router.get("/:serviceId", async (req, res) => {
  try {
    const params = await ParameterMaster.find({
      serviceId: req.params.serviceId,
    }).sort("sortOrder");
    res.json({ success: true, data: params });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Get Single Parameter by ID
router.get("/detail/:id", async (req, res) => {
  try {
    const param = await ParameterMaster.findById(req.params.id);
    if (!param) {
      return res
        .status(404)
        .json({ success: false, message: "Parameter not found" });
    }
    res.json({ success: true, data: param });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Update Parameter
router.put("/:id", validate(ParameterSchema), async (req, res) => {
  try {
    const updated = await ParameterMaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Parameter not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ✅ Delete Parameter
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await ParameterMaster.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Parameter not found" });
    }

    res.json({ success: true, message: "Parameter deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
