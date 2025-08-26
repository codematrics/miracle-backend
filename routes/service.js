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
const {
  createServiceController,
  updateServiceController,
  deleteServiceController,
  listServiceController,
  listParametersWithServiceLinkController,
  updateServiceLinkedParametersController,
  getServiceDropdownController,
} = require("../controllers/service/service");

const router = express.Router();

router.get("/", listServiceController);
router.get("/dropdown-list", getServiceDropdownController);
router.post("/", createServiceController);
router.put("/:id", updateServiceController);
router.delete("/:id", deleteServiceController);
router.get("/linking/:id", listParametersWithServiceLinkController);
router.put("/linking/:id", updateServiceLinkedParametersController);

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
module.exports = router;
