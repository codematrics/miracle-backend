const express = require("express");
const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const Service = require("../models/Service");
const Doctor = require("../models/Doctor");
const LabOrder = require("../models/LabOrder");
const { ORDER_STATUS } = require("../constants/enums");
const { validate } = require("../middleware/validation");
const {
  createVisitSchema,
  updateVisitSchema,
  visitQuerySchema,
} = require("../validations/visitSchema");
const {
  paginate,
  buildSearchQuery,
  buildDateRangeQuery,
  combineQueries,
} = require("../lib/pagination");

const router = express.Router();

// GET /api/visits - List Visits with Filters & Pagination
router.get("/", validate(visitQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/visits - Request received`
  );
  try {
    const { 
      page, 
      limit, 
      search, 
      status, 
      patientId, 
      from, 
      to, 
      all,
      mobileNo,
      patientName,
      uhid,
      doctorName,
      visitType,
      refby
    } = req.query;

    // If we have patient-specific filters, we need to use aggregation
    const hasPatientFilters = mobileNo || patientName || uhid;

    if (hasPatientFilters) {
      // Use aggregation pipeline for patient-specific filtering
      const pipeline = [
        // Lookup patient details
        {
          $lookup: {
            from: "patients",
            localField: "patientId",
            foreignField: "_id",
            as: "patient",
          },
        },
        { $unwind: "$patient" },

        // Apply filters
        {
          $match: {
            ...(status && { status }),
            ...(patientId && { patientId: new require('mongoose').Types.ObjectId(patientId) }),
            ...(from && { visitDate: { $gte: new Date(from) } }),
            ...(to && { visitDate: { ...( from && { $gte: new Date(from) }), $lte: new Date(to) } }),
            ...(mobileNo && { "patient.mobileNo": { $regex: mobileNo, $options: "i" } }),
            ...(patientName && { "patient.patientName": { $regex: patientName, $options: "i" } }),
            ...(uhid && { "patient.uhid": { $regex: uhid, $options: "i" } }),
            ...(doctorName && { visitingdoctor: { $regex: doctorName, $options: "i" } }),
            ...(visitType && { visittype: { $regex: visitType, $options: "i" } }),
            ...(refby && { refby: { $regex: refby, $options: "i" } }),
            ...(search && {
              $or: [
                { visitId: { $regex: search, $options: "i" } },
                { refby: { $regex: search, $options: "i" } },
                { visitingdoctor: { $regex: search, $options: "i" } },
                { visittype: { $regex: search, $options: "i" } },
                { "patient.patientName": { $regex: search, $options: "i" } },
                { "patient.uhid": { $regex: search, $options: "i" } },
                { "patient.mobileNo": { $regex: search, $options: "i" } },
              ],
            }),
          },
        },

        // Sort by visit date (newest first)
        { $sort: { visitDate: -1 } },

        // Add pagination if not requesting all
        ...(all !== "true" ? [
          { $skip: (parseInt(page) - 1) * parseInt(limit) },
          { $limit: parseInt(limit) }
        ] : []),

        // Project fields to match expected format
        {
          $project: {
            _id: 1,
            visitId: 1,
            patientId: "$patient",
            refby: 1,
            visitingdoctor: 1,
            visittype: 1,
            medicolegal: 1,
            mediclaim_type: 1,
            services: 1,
            totalAmount: 1,
            visitDate: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      // Get total count for pagination
      const countPipeline = [
        {
          $lookup: {
            from: "patients",
            localField: "patientId",
            foreignField: "_id",
            as: "patient",
          },
        },
        { $unwind: "$patient" },
        {
          $match: {
            ...(status && { status }),
            ...(patientId && { patientId: new require('mongoose').Types.ObjectId(patientId) }),
            ...(from && { visitDate: { $gte: new Date(from) } }),
            ...(to && { visitDate: { ...( from && { $gte: new Date(from) }), $lte: new Date(to) } }),
            ...(mobileNo && { "patient.mobileNo": { $regex: mobileNo, $options: "i" } }),
            ...(patientName && { "patient.patientName": { $regex: patientName, $options: "i" } }),
            ...(uhid && { "patient.uhid": { $regex: uhid, $options: "i" } }),
            ...(doctorName && { visitingdoctor: { $regex: doctorName, $options: "i" } }),
            ...(visitType && { visittype: { $regex: visitType, $options: "i" } }),
            ...(refby && { refby: { $regex: refby, $options: "i" } }),
            ...(search && {
              $or: [
                { visitId: { $regex: search, $options: "i" } },
                { refby: { $regex: search, $options: "i" } },
                { visitingdoctor: { $regex: search, $options: "i" } },
                { visittype: { $regex: search, $options: "i" } },
                { "patient.patientName": { $regex: search, $options: "i" } },
                { "patient.uhid": { $regex: search, $options: "i" } },
                { "patient.mobileNo": { $regex: search, $options: "i" } },
              ],
            }),
          },
        },
        { $count: "total" },
      ];

      const [visits, totalCount] = await Promise.all([
        Visit.aggregate(pipeline),
        Visit.aggregate(countPipeline),
      ]);

      const total = totalCount[0]?.total || 0;
      const totalPages = all === "true" ? 1 : Math.ceil(total / parseInt(limit));

      const result = {
        data: visits,
        pagination: all === "true" ? null : {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
        total,
      };
    } else {
      // Use regular query for better performance when no patient filters
      const statusQuery = status ? { status } : {};
      const patientQuery = patientId ? { patientId } : {};
      const dateQuery = buildDateRangeQuery("visitDate", from, to);
      const doctorQuery = doctorName ? { visitingdoctor: { $regex: doctorName, $options: "i" } } : {};
      const visitTypeQuery = visitType ? { visittype: { $regex: visitType, $options: "i" } } : {};
      const refbyQuery = refby ? { refby: { $regex: refby, $options: "i" } } : {};
      const searchQuery = buildSearchQuery(search, [
        "visitId",
        "refby",
        "visitingdoctor",
        "visittype",
      ]);

      // Combine all queries
      const finalQuery = combineQueries(
        statusQuery,
        patientQuery,
        dateQuery,
        doctorQuery,
        visitTypeQuery,
        refbyQuery,
        searchQuery
      );

      var result = await paginate(Visit, {
        query: finalQuery,
        page,
        limit,
        all: all === "true",
        populate: {
          path: "patientId",
          select: "patientName uhid mobileNo",
        },
      });
    }

    // Format data for response
    const formattedVisits = result.data.map((visit) => ({
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
        result.data.length
      } visits`
    );
    res.json({
      success: true,
      data: formattedVisits,
      pagination: result.pagination,
      total: result.total,
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

    // Validate doctor exists and get doctor information
    const doctor = await Doctor.findOne({ employeeId: visitData.doctorId, isActive: true });
    if (!doctor) {
      console.warn(
        `[${new Date().toISOString()}] POST /api/visits - ERROR 404 - Doctor not found: ${
          visitData.doctorId
        }`
      );
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
        errors: [
          {
            field: "doctorId",
            message: "Doctor with this Employee ID does not exist or is inactive",
          },
        ],
      });
    }

    // Replace doctorId with visitingdoctor name
    visitData.visitingdoctor = doctor.doctorName;
    delete visitData.doctorId;

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
        serviceData.category = dbService.category; // keep category for lab order logic
      }
    }

    const visit = new Visit(visitData);
    await visit.save();

    // --- 🔥 Auto Create Lab Orders ---
    const pathologyServices = existingServices.filter(
      (s) => s.category === "pathology"
    );
    const radiologyServices = existingServices.filter(
      (s) => s.category === "radiology"
    );

    // Create separate lab orders for pathology and radiology
    const createLabOrderForCategory = async (services, category) => {
      if (services.length === 0) return null;

      const order = new LabOrder({
        patientId: visit.patientId,
        visitId: visit._id,
        doctorName: visitData.visitingdoctor,
        doctorSpecialization: "",
        orderDate: new Date(),
        status: ORDER_STATUS.PENDING,
        patientInfo: {
          name: visitData.patientId ? "" : visitData.patientName, // Will be populated below
          uhid: visitData.patientId ? "" : visitData.uhid,
          age: visitData.patientId ? "" : visitData.age,
          gender: visitData.patientId ? "" : visitData.gender,
          mobileNo: visitData.patientId ? "" : visitData.mobileNo,
        },
      });

      // If we have a patientId, populate patient info
      if (visitData.patientId) {
        const patient = await Patient.findById(visitData.patientId);
        if (patient) {
          order.patientInfo = {
            name: patient.patientName,
            uhid: patient.uhid,
            age: `${patient.age} ${patient.ageUnit}`,
            gender: patient.gender,
            mobileNo: patient.mobileNo,
          };
        }
      }

      await order.save();

      // Create LabOrderTest for each service in this category
      for (const service of services) {
        const labOrderTest = new (require("../models/LabOrderTest"))({
          labOrderId: order._id,
          serviceId: service._id,
          status: "pending",
          serviceInfo: {
            name: service.name,
            code: service.code,
            category: service.category,
          },
        });
        await labOrderTest.save();

        // Create placeholder LabResults for each parameter of this service
        const parameters = await require("../models/ParameterMaster")
          .find({
            serviceId: service._id,
            isActive: true,
          })
          .sort({ sortOrder: 1 });

        for (const parameter of parameters) {
          const labResult = new (require("../models/LabResult"))({
            labOrderTestId: labOrderTest._id,
            parameterId: parameter._id,
            value: "",
            unit: parameter.unit || "",
            referenceRange: parameter.referenceRange || "",
            status: "pending",
            enteredBy: visit.patientId, // Temporary - should be actual user
            parameterInfo: {
              name: parameter.parameterName,
              code: parameter.parameterCode,
              dataType: parameter.dataType,
              methodology: parameter.methodology,
            },
          });
          await labResult.save();
        }
      }

      return order;
    };

    const pathologyOrder = await createLabOrderForCategory(
      pathologyServices,
      "pathology"
    );
    const radiologyOrder = await createLabOrderForCategory(
      radiologyServices,
      "radiology"
    );

    const createdOrders = [pathologyOrder, radiologyOrder].filter(Boolean);

    if (createdOrders.length > 0) {
      console.log(
        `[VISIT] Created ${createdOrders.length} lab orders for visit ${visit.visitId} (${pathologyServices.length} pathology, ${radiologyServices.length} radiology services)`
      );
    }

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

      // Validate doctor exists and get doctor information
      const doctor = await Doctor.findOne({ employeeId: req.body.doctorId, isActive: true });
      if (!doctor) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/visits/patient/${
            req.params.patientId
          } - ERROR 404 - Doctor not found: ${req.body.doctorId}`
        );
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
          errors: [
            {
              field: "doctorId",
              message: "Doctor with this Employee ID does not exist or is inactive",
            },
          ],
        });
      }

      // Add patient ID to visit data and replace doctorId with visitingdoctor name
      const visitData = {
        ...req.body,
        patientId: req.params.patientId,
        visitingdoctor: doctor.doctorName,
      };
      delete visitData.doctorId;

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
          serviceData.category = dbService.category; // keep category for lab order logic
        }
      }

      const visit = new Visit(visitData);
      await visit.save();

      // --- 🔥 Auto Create Lab Orders ---
      const pathologyServices = existingServices.filter(
        (s) => s.category === "pathology"
      );
      const radiologyServices = existingServices.filter(
        (s) => s.category === "radiology"
      );

      // Create separate lab orders for pathology and radiology
      const createLabOrderForCategory = async (services, category) => {
        if (services.length === 0) return null;

        const order = new LabOrder({
          patientId: visit.patientId,
          visitId: visit._id,
          doctorName: doctor.doctorName,
          doctorSpecialization: doctor.specialization,
          orderDate: new Date(),
          status: ORDER_STATUS.PENDING,
          patientInfo: {
            name: patient.patientName,
            uhid: patient.uhid,
            age: `${patient.age} ${patient.ageUnit}`,
            gender: patient.gender,
            mobileNo: patient.mobileNo,
          },
        });
        await order.save();

        // Create LabOrderTest for each service in this category
        for (const service of services) {
          const labOrderTest = new (require("../models/LabOrderTest"))({
            labOrderId: order._id,
            serviceId: service._id,
            status: "pending",
            serviceInfo: {
              name: service.name,
              code: service.code,
              category: service.category,
            },
          });
          await labOrderTest.save();

          // Create placeholder LabResults for each parameter of this service
          const parameters = await require("../models/ParameterMaster")
            .find({
              serviceId: service._id,
              isActive: true,
            })
            .sort({ sortOrder: 1 });

          for (const parameter of parameters) {
            const labResult = new (require("../models/LabResult"))({
              labOrderTestId: labOrderTest._id,
              parameterId: parameter._id,
              value: "",
              unit: parameter.unit || "",
              referenceRange: parameter.referenceRange || "",
              status: "pending",
              enteredBy: visit.patientId, // Temporary - should be actual user
              parameterInfo: {
                name: parameter.parameterName,
                code: parameter.parameterCode,
                dataType: parameter.dataType,
                methodology: parameter.methodology,
              },
            });
            await labResult.save();
          }
        }

        return order;
      };

      const pathologyOrder = await createLabOrderForCategory(
        pathologyServices,
        "pathology"
      );
      const radiologyOrder = await createLabOrderForCategory(
        radiologyServices,
        "radiology"
      );

      const createdOrders = [pathologyOrder, radiologyOrder].filter(Boolean);

      if (createdOrders.length > 0) {
        console.log(
          `[VISIT] Created ${createdOrders.length} lab orders for patient visit ${visit.visitId} (${pathologyServices.length} pathology, ${radiologyServices.length} radiology services)`
        );
      }

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
