const express = require("express");
const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const Service = require("../models/Service");
const { validate } = require("../middleware/validation");
const {
  createVisitSchema,
  updateVisitSchema,
  visitQuerySchema,
} = require("../validations/visitSchema");

const router = express.Router();

// GET /api/visits - List Visits with Filters & Pagination
router.get("/", validate(visitQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/visits - Request received`
  );
  try {
    const { page, limit, search, status, patientId, from, to } = req.query;

    let query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Patient filter
    if (patientId) {
      query.patientId = patientId;
    }

    // Date range filter
    if (from || to) {
      query.visitDate = {};
      if (from) query.visitDate.$gte = new Date(from);
      if (to) query.visitDate.$lte = new Date(to);
    }

    // Text search in visit ID, patient info, doctor, etc.
    if (search) {
      query.$or = [
        { visitId: { $regex: search, $options: "i" } },
        { refby: { $regex: search, $options: "i" } },
        { visitingdoctor: { $regex: search, $options: "i" } },
        { visittype: { $regex: search, $options: "i" } },
      ];
    }

    const visits = await Visit.find(query)
      .populate("patientId", "patientName uhid mobileNo")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Visit.countDocuments(query);

    // Format data for response
    const formattedVisits = visits.map((visit) => ({
      id: visit._id,
      visitId: visit.visitId,
      patient: visit.patientId
        ? {
            id: visit.patientId._id,
            name: visit.patientId.patientName || visit.patientId.name,
            uhid: visit.patientId.uhid,
            mobileNo: visit.patientId.mobileNo,
          }
        : null,
      refby: visit.refby,
      visitingdoctor: visit.visitingdoctor,
      visittype: visit.visittype,
      medicolegal: visit.medicolegal,
      mediclaim_type: visit.mediclaim_type,
      services: visit.services,
      totalAmount: visit.totalAmount,
      visitDate: visit.visitDate,
      status: visit.status,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    }));

    console.log(
      `[${new Date().toISOString()}] GET /api/visits - SUCCESS 200 - Retrieved ${
        visits.length
      } visits`
    );
    res.json({
      success: true,
      data: formattedVisits,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total: total,
        limit: limit,
      },
      total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/visits - ERROR 500:`,
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

// GET /api/visits/:id - Get Single Visit
router.get("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/visits/${
      req.params.id
    } - Request received`
  );
  try {
    const visit = await Visit.findById(req.params.id).populate(
      "patientId",
      "patientName name uhid mobileNo age ageUnit gender"
    );

    if (!visit) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/visits/${
          req.params.id
        } - ERROR 404 - Visit not found`
      );
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] GET /api/visits/${
        req.params.id
      } - SUCCESS 200 - Visit retrieved`
    );
    res.json({
      success: true,
      data: {
        id: visit._id,
        visitId: visit.visitId,
        patient: visit.patientId
          ? {
              id: visit.patientId._id,
              name: visit.patientId.patientName || visit.patientId.name,
              uhid: visit.patientId.uhid,
              mobileNo: visit.patientId.mobileNo,
              age: visit.patientId.age,
              ageUnit: visit.patientId.ageUnit,
              gender: visit.patientId.gender,
            }
          : null,
        refby: visit.refby,
        visitingdoctor: visit.visitingdoctor,
        visittype: visit.visittype,
        medicolegal: visit.medicolegal,
        mediclaim_type: visit.mediclaim_type,
        services: visit.services,
        totalAmount: visit.totalAmount,
        visitDate: visit.visitDate,
        status: visit.status,
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/visits/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        visitId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/visits - Create New Visit
router.post("/", validate(createVisitSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/visits - Request received`
  );
  try {
    const visitData = req.body;

    // Validate patient exists
    if (visitData.patientId) {
      const patient = await Patient.findById(visitData.patientId);
      if (!patient) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/visits - ERROR 404 - Patient not found: ${
            visitData.patientId
          }`
        );
        return res.status(404).json({
          success: false,
          message: "Patient not found",
          errors: [
            {
              field: "patientId",
              message: "Patient with this ID does not exist",
            },
          ],
        });
      }
    }

    // Validate all services exist
    const serviceIds = visitData.services.map((s) => s.serviceId);
    const existingServices = await Service.find({ _id: { $in: serviceIds } });

    if (existingServices.length !== serviceIds.length) {
      const foundServiceIds = existingServices.map((s) => s._id.toString());
      const missingServiceIds = serviceIds.filter(
        (id) => !foundServiceIds.includes(id)
      );

      console.warn(
        `[${new Date().toISOString()}] POST /api/visits - ERROR 404 - Services not found: ${missingServiceIds.join(
          ", "
        )}`
      );
      return res.status(404).json({
        success: false,
        message: "One or more services not found",
        errors: [
          {
            field: "services",
            message: `Services with IDs ${missingServiceIds.join(
              ", "
            )} do not exist`,
          },
        ],
      });
    }

    // Verify service data matches database
    for (const serviceData of visitData.services) {
      const dbService = existingServices.find(
        (s) => s._id.toString() === serviceData.serviceId
      );
      if (dbService) {
        // Update service data from database to ensure consistency
        serviceData.serviceName = dbService.name;
        serviceData.serviceCode = dbService.code;
        serviceData.rate = dbService.rate;
      }
    }

    const visit = new Visit(visitData);
    await visit.save();

    // Populate patient data for response
    await visit.populate("patientId", "patientName name uhid mobileNo");

    console.log(
      `[${new Date().toISOString()}] POST /api/visits - SUCCESS 201 - Visit created: ${
        visit.visitId
      }`
    );
    res.status(201).json({
      success: true,
      message: "Visit created successfully",
      data: {
        id: visit._id,
        visitId: visit.visitId,
        patient: visit.patientId
          ? {
              id: visit.patientId._id,
              name: visit.patientId.patientName || visit.patientId.name,
              uhid: visit.patientId.uhid,
              mobileNo: visit.patientId.mobileNo,
            }
          : null,
        refby: visit.refby,
        visitingdoctor: visit.visitingdoctor,
        visittype: visit.visittype,
        medicolegal: visit.medicolegal,
        mediclaim_type: visit.mediclaim_type,
        services: visit.services,
        totalAmount: visit.totalAmount,
        visitDate: visit.visitDate,
        status: visit.status,
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/visits - ERROR 500:`,
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

// POST /api/visits/patient/:patientId - Create Visit for Specific Patient
router.post(
  "/patient/:patientId",
  validate(createVisitSchema),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] POST /api/visits/patient/${
        req.params.patientId
      } - Request received`
    );
    try {
      // Validate patient exists
      const patient = await Patient.findById(req.params.patientId);
      if (!patient) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/visits/patient/${
            req.params.patientId
          } - ERROR 404 - Patient not found`
        );
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Add patient ID to visit data
      const visitData = {
        ...req.body,
        patientId: req.params.patientId,
      };

      // Validate all services exist and update service data
      const serviceIds = visitData.services.map((s) => s.serviceId);
      const existingServices = await Service.find({ _id: { $in: serviceIds } });

      if (existingServices.length !== serviceIds.length) {
        const foundServiceIds = existingServices.map((s) => s._id.toString());
        const missingServiceIds = serviceIds.filter(
          (id) => !foundServiceIds.includes(id)
        );

        console.warn(
          `[${new Date().toISOString()}] POST /api/visits/patient/${
            req.params.patientId
          } - ERROR 404 - Services not found: ${missingServiceIds.join(", ")}`
        );
        return res.status(404).json({
          success: false,
          message: "One or more services not found",
          errors: [
            {
              field: "services",
              message: `Services with IDs ${missingServiceIds.join(
                ", "
              )} do not exist`,
            },
          ],
        });
      }

      // Update service data from database
      for (const serviceData of visitData.services) {
        const dbService = existingServices.find(
          (s) => s._id.toString() === serviceData.serviceId
        );
        if (dbService) {
          serviceData.serviceName = dbService.name;
          serviceData.serviceCode = dbService.code;
          serviceData.rate = dbService.rate;
        }
      }

      const visit = new Visit(visitData);
      await visit.save();

      // Populate patient data for response
      await visit.populate("patientId", "patientName name uhid mobileNo");

      console.log(
        `[${new Date().toISOString()}] POST /api/visits/patient/${
          req.params.patientId
        } - SUCCESS 201 - Visit created: ${visit.visitId}`
      );
      res.status(201).json({
        success: true,
        message: "Visit created successfully",
        data: {
          id: visit._id,
          visitId: visit.visitId,
          patient: {
            id: visit.patientId._id,
            name: visit.patientId.patientName || visit.patientId.name,
            uhid: visit.patientId.uhid,
            mobileNo: visit.patientId.mobileNo,
          },
          refby: visit.refby,
          visitingdoctor: visit.visitingdoctor,
          visittype: visit.visittype,
          medicolegal: visit.medicolegal,
          mediclaim_type: visit.mediclaim_type,
          services: visit.services,
          totalAmount: visit.totalAmount,
          visitDate: visit.visitDate,
          status: visit.status,
          createdAt: visit.createdAt,
          updatedAt: visit.updatedAt,
        },
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] POST /api/visits/patient/${
          req.params.patientId
        } - ERROR 500:`,
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
  }
);

module.exports = router;
