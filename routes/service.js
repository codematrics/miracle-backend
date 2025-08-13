const express = require("express");
const Service = require("../models/Service");
const { validate } = require("../middleware/validation");
const {
  createServiceSchema,
  updateServiceSchema,
  serviceQuerySchema,
} = require("../validations/serviceSchema");

const router = express.Router();

// GET /api/services - List Services with Filters & Pagination
router.get("/", validate(serviceQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/services - Request received`
  );
  try {
    const { page, limit, search, category, status, all } = req.query;

    let query = {};
    
    // Text search in name and description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        // Backward compatibility
        { serviceName: { $regex: search, $options: "i" } },
        { serviceCode: { $regex: search, $options: "i" } },
      ];
    }
    
    // Category filter
    if (category) {
      query.category = category;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }

    let services;
    let total;

    if (all === 'true') {
      // Get all services without pagination
      services = await Service.find(query).sort({ createdAt: -1 });
      total = services.length;

      // Format data for response
      const formattedServices = services.map(service => ({
        id: service._id,
        name: service.name,
        code: service.code,
        description: service.description,
        category: service.category,
        rate: service.rate,
        status: service.status,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt
      }));

      console.log(
        `[${new Date().toISOString()}] GET /api/services - SUCCESS 200 - Retrieved all ${
          services.length
        } services`
      );
      res.json({
        success: true,
        data: formattedServices,
        total,
      });
    } else {
      // Get services with pagination
      services = await Service.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      total = await Service.countDocuments(query);

      // Format data for response
      const formattedServices = services.map(service => ({
        id: service._id,
        name: service.name,
        code: service.code,
        description: service.description,
        category: service.category,
        rate: service.rate,
        status: service.status,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt
      }));

      console.log(
        `[${new Date().toISOString()}] GET /api/services - SUCCESS 200 - Retrieved ${
          services.length
        } services`
      );
      res.json({
        success: true,
        data: formattedServices,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total: total,
          limit: limit
        },
        total,
      });
    }
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
        updatedAt: service.updatedAt
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

// POST /api/services - Create New Service
router.post("/", validate(createServiceSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/services - Request received`
  );
  try {
    // Check if service with same code exists
    const existingService = await Service.findOne({
      code: req.body.code
    });

    if (existingService) {
      console.warn(
        `[${new Date().toISOString()}] POST /api/services - ERROR 400 - Service already exists with code: ${req.body.code}`
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [{
          field: "code",
          message: "Service code already exists"
        }]
      });
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
        createdAt: service.createdAt,
        updatedAt: service.updatedAt
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
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
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
        _id: { $ne: req.params.id }
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
          errors: [{
            field: "code",
            message: "Service code already exists"
          }]
        });
      }
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

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
        updatedAt: service.updatedAt
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
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
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