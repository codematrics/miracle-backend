const express = require("express");
const Service = require("../models/Service");
const { validate } = require("../middleware/validation");
const {
  createServiceSchema,
  updateServiceSchema,
  serviceQuerySchema,
} = require("../validations/serviceSchema");
const {
  paginate,
  buildSearchQuery,
  combineQueries,
} = require("../lib/pagination");

const router = express.Router();

// GET /api/services - List Services with Filters & Pagination
router.get("/", validate(serviceQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/services - Request received`
  );
  try {
    const { page, limit, search, category, status, all } = req.query;

    // Build individual query parts
    const categoryQuery = category ? { category } : {};
    const statusQuery = status ? { status } : {};
    const searchQuery = buildSearchQuery(search, [
      "name",
      "description",
      "code",
      "serviceName", // Backward compatibility
      "serviceCode", // Backward compatibility
    ]);

    // Combine all queries
    const finalQuery = combineQueries(categoryQuery, statusQuery, searchQuery);

    const result = await paginate(Service, {
      query: finalQuery,
      page,
      limit,
      all: all === "true",
    });

    // Format data for response
    const formattedServices = result.data.map((service) => ({
      id: service._id,
      name: service.name,
      code: service.code,
      description: service.description,
      category: service.category,
      rate: service.rate,
      status: service.status,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      reportName: service?.reportName || null,
    }));

    const logMessage =
      all === "true"
        ? `Retrieved all ${result.data.length} services`
        : `Retrieved ${result.data.length} services`;

    console.log(
      `[${new Date().toISOString()}] GET /api/services - SUCCESS 200 - ${logMessage}`
    );

    res.json({
      success: true,
      data: formattedServices,
      pagination: result.pagination,
      total: result.total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/services - ERROR 500:`,
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

// GET /api/services/:id - Get Single Service
router.get("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/services/${
      req.params.id
    } - Request received`
  );
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/services/${
          req.params.id
        } - ERROR 404 - Service not found`
      );
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] GET /api/services/${
        req.params.id
      } - SUCCESS 200 - Service retrieved`
    );
    res.json({
      success: true,
      data: {
        id: service._id,
        name: service.name,
        code: service.code,
        description: service.description,
        category: service.category,
        rate: service.rate,
        status: service.status,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/services/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        serviceId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Function to generate unique service code
async function generateServiceCode(category, serviceName) {
  // Get category prefix (first 3 letters uppercase)
  const categoryPrefix = category.substring(0, 3).toUpperCase();
  
  // Get service name prefix (first few letters, removing spaces/special chars)
  const namePrefix = serviceName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase();
  
  // Find the highest existing sequence number for this pattern
  const pattern = new RegExp(`^${categoryPrefix}_${namePrefix}_\\d+$`);
  const existingServices = await Service.find({ code: pattern })
    .sort({ code: -1 })
    .limit(1);
  
  let sequenceNumber = 1;
  if (existingServices.length > 0) {
    const lastCode = existingServices[0].code;
    const lastSequence = parseInt(lastCode.split('_').pop());
    if (!isNaN(lastSequence)) {
      sequenceNumber = lastSequence + 1;
    }
  }
  
  // Format: CATEGORY_SERVICENAME_SEQUENCE (e.g., LAB_CBC_001)
  return `${categoryPrefix}_${namePrefix}_${String(sequenceNumber).padStart(3, '0')}`;
}

// POST /api/services - Create New Service
router.post("/", validate(createServiceSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/services - Request received`
  );
  try {
    // Generate unique service code if not provided
    if (!req.body.code) {
      req.body.code = await generateServiceCode(req.body.category, req.body.name);
    } else {
      // Check if manually provided code exists
      const existingService = await Service.findOne({
        code: req.body.code,
      });

      if (existingService) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/services - ERROR 400 - Service already exists with code: ${
            req.body.code
          }`
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [
            {
              field: "code",
              message: "Service code already exists",
            },
          ],
        });
      }
    }

    const service = new Service(req.body);
    await service.save();

    console.log(
      `[${new Date().toISOString()}] POST /api/services - SUCCESS 201 - Service created: ${
        service.name
      }`
    );
    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: {
        id: service._id,
        name: service.name,
        code: service.code,
        description: service.description,
        category: service.category,
        rate: service.rate,
        status: service.status,
        reportName: service.reportName, // ✅ include reportName
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/services - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        requestBody: req.body,
      }
    );

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// PUT /api/services/:id - Update Service
router.put("/:id", validate(updateServiceSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] PUT /api/services/${
      req.params.id
    } - Request received`
  );
  try {
    // Check if service exists
    const existingService = await Service.findById(req.params.id);
    if (!existingService) {
      console.warn(
        `[${new Date().toISOString()}] PUT /api/services/${
          req.params.id
        } - ERROR 404 - Service not found`
      );
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // If code is being updated, check for duplicates
    if (req.body.code && req.body.code !== existingService.code) {
      const duplicateService = await Service.findOne({
        code: req.body.code,
        _id: { $ne: req.params.id },
      });

      if (duplicateService) {
        console.warn(
          `[${new Date().toISOString()}] PUT /api/services/${
            req.params.id
          } - ERROR 400 - Service code already exists: ${req.body.code}`
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [
            {
              field: "code",
              message: "Service code already exists",
            },
          ],
        });
      }
    }

    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    console.log(
      `[${new Date().toISOString()}] PUT /api/services/${
        req.params.id
      } - SUCCESS 200 - Service updated: ${service.name}`
    );
    res.json({
      success: true,
      message: "Service updated successfully",
      data: {
        id: service._id,
        name: service.name,
        code: service.code,
        description: service.description,
        category: service.category,
        rate: service.rate,
        status: service.status,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] PUT /api/services/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        serviceId: req.params.id,
        requestBody: req.body,
      }
    );

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// DELETE /api/services/:id - Delete Service
router.delete("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE /api/services/${
      req.params.id
    } - Request received`
  );
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      console.warn(
        `[${new Date().toISOString()}] DELETE /api/services/${
          req.params.id
        } - ERROR 404 - Service not found`
      );
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] DELETE /api/services/${
        req.params.id
      } - SUCCESS 200 - Service deleted: ${service.name}`
    );
    res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] DELETE /api/services/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        serviceId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
