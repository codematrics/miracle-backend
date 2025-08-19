const express = require("express");
const LabOrder = require("../models/LabOrder");
const LabOrderTest = require("../models/LabOrderTest");
const LabResult = require("../models/LabResult");
const ParameterMaster = require("../models/ParameterMaster");
const Patient = require("../models/Patient");
const Service = require("../models/Service");
const OpdBilling = require("../models/OpdBilling");
const { SERVICE_CATEGORIES } = require("../constants/enums");
const { validate } = require("../middleware/validation");
const {
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderQuerySchema,
  updateLabOrderTestSchema,
  collectSamplesSchema,
  createParameterSchema,
  updateParameterSchema,
  parameterQuerySchema,
  saveResultsSchema,
  updateResultSchema,
  authorizeResultsSchema,
  resultQuerySchema,
  reportQuerySchema,
  bulkUpdateStatusSchema,
} = require("../validations/labSchemas");
const {
  paginate,
  buildSearchQuery,
  buildDateRangeQuery,
  combineQueries,
} = require("../lib/pagination");

const router = express.Router();

// Simple test route to verify lab routes work
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Lab routes are working!" });
});

// =============================================================================
// LAB ORDERS MANAGEMENT
// =============================================================================

// GET /api/lab/orders - List Lab Orders with Filters & Pagination
router.get(
  "/orders",
  validate(labOrderQuerySchema, "query"),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] GET /api/lab/orders - Request received`
    );
    try {
      const {
        page,
        limit,
        search,
        status,
        priority,
        patientId,
        doctorId,
        accessionNo,
        from,
        to,
        all,
      } = req.query;

      // Build individual query parts
      const statusQuery = status ? { status } : {};
      const priorityQuery = priority ? { priority } : {};
      const patientQuery = patientId ? { patientId } : {};
      const doctorQuery = doctorId ? { doctorId } : {};
      const accessionQuery = accessionNo ? { accessionNo } : {};
      const dateQuery = buildDateRangeQuery("orderDate", from, to);
      const searchQuery = buildSearchQuery(search, [
        "accessionNo",
        "patientInfo.name",
        "patientInfo.uhid",
        "patientInfo.mobileNo",
        "doctorInfo.name",
      ]);

      // Combine all queries
      const finalQuery = combineQueries(
        statusQuery,
        priorityQuery,
        patientQuery,
        doctorQuery,
        accessionQuery,
        dateQuery,
        searchQuery
      );

      const result = await paginate(LabOrder, {
        query: finalQuery,
        page,
        limit,
        all: all === "true",
        populate: [
          {
            path: "patientId",
            select: "patientName uhid mobileNo age ageUnit gender",
          },
          {
            path: "doctorId",
            select: "username email",
          },
        ],
      });

      // Get test counts for each order
      const orderIds = result.data.map((order) => order._id);
      const testCounts = await LabOrderTest.aggregate([
        { $match: { labOrderId: { $in: orderIds } } },
        { $group: { _id: "$labOrderId", totalTests: { $sum: 1 } } },
      ]);

      const testCountMap = testCounts.reduce((acc, item) => {
        acc[item._id.toString()] = item.totalTests;
        return acc;
      }, {});

      // Format data for response
      const formattedOrders = result.data.map((order) => ({
        id: order._id,
        accessionNo: order.accessionNo,
        formattedAccession: order.formattedAccession,
        patientInfo: order.patientInfo,
        doctorInfo: order.doctorInfo,
        status: order.status,
        statusDisplay: order.statusDisplay,
        priority: order.priority,
        orderDate: order.orderDate,
        instructions: order.instructions,
        totalTests: testCountMap[order._id.toString()] || 0,
        collectedAt: order.collectedAt,
        savedAt: order.savedAt,
        authorizedAt: order.authorizedAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        patient: order.patientId
          ? {
              id: order.patientId._id,
              name: order.patientId.patientName,
              uhid: order.patientId.uhid,
              mobileNo: order.patientId.mobileNo,
            }
          : null,
      }));

      const logMessage =
        all === "true"
          ? `Retrieved all ${result.data.length} lab orders`
          : `Retrieved ${result.data.length} lab orders`;

      console.log(
        `[${new Date().toISOString()}] GET /api/lab/orders - SUCCESS 200 - ${logMessage}`
      );

      res.json({
        success: true,
        data: formattedOrders,
        pagination: result.pagination,
        total: result.total,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] GET /api/lab/orders - ERROR 500:`,
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
  }
);

// GET /api/lab/orders/:id - Get Single Lab Order with Tests
router.get("/orders/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/orders/${
      req.params.id
    } - Request received`
  );
  try {
    const labOrder = await LabOrder.findById(req.params.id).populate([
      {
        path: "patientId",
        select: "patientName uhid mobileNo age ageUnit gender address",
      },
      {
        path: "doctorId",
        select: "username email",
      },
      {
        path: "opdBillingId",
        select: "billId billing.grandTotal",
      },
    ]);

    if (!labOrder) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/lab/orders/${
          req.params.id
        } - ERROR 404 - Lab order not found`
      );
      return res.status(404).json({
        success: false,
        message: "Lab order not found",
      });
    }

    // Get associated tests with results
    const tests = await LabOrderTest.find({ labOrderId: req.params.id })
      .populate("serviceId", "name code category")
      .lean();

    // Get results for all tests
    const testIds = tests.map((test) => test._id);
    const results = await LabResult.find({ labOrderTestId: { $in: testIds } })
      .populate("parameterId", "parameterName unit referenceRange")
      .lean();

    // Group results by test
    const resultsByTest = results.reduce((acc, result) => {
      if (!acc[result.labOrderTestId]) acc[result.labOrderTestId] = [];
      acc[result.labOrderTestId].push(result);
      return acc;
    }, {});

    // Add results to tests
    const testsWithResults = tests.map((test) => ({
      ...test,
      results: resultsByTest[test._id] || [],
    }));

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/orders/${
        req.params.id
      } - SUCCESS 200 - Lab order retrieved`
    );
    res.json({
      success: true,
      data: {
        ...labOrder.toJSON(),
        tests: testsWithResults,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/lab/orders/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        orderId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/lab/orders - Create Lab Order from OPD Billing
router.post("/orders", validate(createLabOrderSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/lab/orders - Request received`
  );
  try {
    const {
      patientId,
      visitId,
      opdBillingId,
      doctorId,
      serviceIds,
      priority,
      instructions,
    } = req.body;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      console.warn(
        `[${new Date().toISOString()}] POST /api/lab/orders - ERROR 404 - Patient not found: ${patientId}`
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

    // Validate services exist and are pathology services
    const services = await Service.find({
      _id: { $in: serviceIds },
      category: SERVICE_CATEGORIES.LABORATORY,
      status: "active",
    });

    if (services.length !== serviceIds.length) {
      const foundServiceIds = services.map((s) => s._id.toString());
      const missingServiceIds = serviceIds.filter(
        (id) => !foundServiceIds.includes(id)
      );

      console.warn(
        `[${new Date().toISOString()}] POST /api/lab/orders - ERROR 400 - Invalid laboratory services: ${missingServiceIds.join(
          ", "
        )}`
      );
      return res.status(400).json({
        success: false,
        message: "Invalid laboratory services",
        errors: [
          {
            field: "serviceIds",
            message: `Services with IDs ${missingServiceIds.join(
              ", "
            )} are either not found, not pathology services, or inactive`,
          },
        ],
      });
    }

    // Create lab order
    const labOrder = new LabOrder({
      patientId,
      visitId,
      opdBillingId,
      doctorId,
      priority,
      instructions,
      patientInfo: {
        name: patient.patientName,
        uhid: patient.uhid,
        age: `${patient.age} ${patient.ageUnit}`,
        gender: patient.gender,
        mobileNo: patient.mobileNo,
      },
    });

    await labOrder.save();

    // Create lab order tests for each service
    const labOrderTests = await Promise.all(
      services.map(async (service) => {
        const labOrderTest = new LabOrderTest({
          labOrderId: labOrder._id,
          serviceId: service._id,
          serviceInfo: {
            name: service.name,
            code: service.code,
            category: service.category,
          },
        });

        await labOrderTest.save();

        // Create placeholder results for parameters
        const parameters = await ParameterMaster.find({
          serviceId: service._id,
          isActive: true,
        }).sort({ sortOrder: 1 });

        const labResults = await Promise.all(
          parameters.map(async (parameter) => {
            const labResult = new LabResult({
              labOrderTestId: labOrderTest._id,
              parameterId: parameter._id,
              value: "",
              unit: parameter.unit,
              referenceRange: parameter.referenceRange,
              status: "pending",
              enteredBy: doctorId, // Temporarily using doctor ID, should be actual user
              parameterInfo: {
                name: parameter.parameterName,
                code: parameter.parameterCode,
                dataType: parameter.dataType,
                methodology: parameter.methodology,
              },
            });

            await labResult.save();
            return labResult;
          })
        );

        return {
          ...labOrderTest.toJSON(),
          results: labResults,
        };
      })
    );

    console.log(
      `[${new Date().toISOString()}] POST /api/lab/orders - SUCCESS 201 - Lab order created: ${
        labOrder.accessionNo
      }`
    );
    res.status(201).json({
      success: true,
      message: "Lab order created successfully",
      data: {
        ...labOrder.toJSON(),
        tests: labOrderTests,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/lab/orders - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        requestBody: req.body,
      }
    );

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

// PUT /api/lab/orders/:id - Update Lab Order
router.put("/orders/:id", validate(updateLabOrderSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] PUT /api/lab/orders/${
      req.params.id
    } - Request received`
  );
  try {
    const labOrder = await LabOrder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "patientId", select: "patientName uhid mobileNo" },
      { path: "doctorId", select: "username email" },
    ]);

    if (!labOrder) {
      console.warn(
        `[${new Date().toISOString()}] PUT /api/lab/orders/${
          req.params.id
        } - ERROR 404 - Lab order not found`
      );
      return res.status(404).json({
        success: false,
        message: "Lab order not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] PUT /api/lab/orders/${
        req.params.id
      } - SUCCESS 200 - Lab order updated: ${labOrder.accessionNo}`
    );
    res.json({
      success: true,
      message: "Lab order updated successfully",
      data: labOrder,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] PUT /api/lab/orders/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        orderId: req.params.id,
      }
    );

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

// =============================================================================
// COLLECTION WORKFLOW
// =============================================================================

// GET /api/lab/collection - Get Orders Pending Collection
router.get(
  "/collection",
  validate(labOrderQuerySchema, "query"),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] GET /api/lab/collection - Request received`
    );
    try {
      const { page, limit, search, priority, from, to } = req.query;

      // Only show orders with status pending or collected
      const statusQuery = { status: { $in: ["pending", "collected"] } };
      const priorityQuery = priority ? { priority } : {};
      const dateQuery = buildDateRangeQuery("orderDate", from, to);
      const searchQuery = buildSearchQuery(search, [
        "accessionNo",
        "patientInfo.name",
        "patientInfo.uhid",
        "patientInfo.mobileNo",
      ]);

      const finalQuery = combineQueries(
        statusQuery,
        priorityQuery,
        dateQuery,
        searchQuery
      );

      const result = await paginate(LabOrder, {
        query: finalQuery,
        page,
        limit,
        sort: { priority: 1, orderDate: 1 }, // Urgent first, then by order date
      });

      // Get associated tests for each order
      const orderIds = result.data.map((order) => order._id);
      const tests = await LabOrderTest.find({
        labOrderId: { $in: orderIds },
        status: { $in: ["pending", "collected"] },
      })
        .populate("serviceId", "name code category")
        .lean();

      // Group tests by order
      const testsByOrder = tests.reduce((acc, test) => {
        if (!acc[test.labOrderId]) acc[test.labOrderId] = [];
        acc[test.labOrderId].push(test);
        return acc;
      }, {});

      // Format data for response
      const formattedOrders = result.data.map((order) => ({
        id: order._id,
        accessionNo: order.accessionNo,
        formattedAccession: order.formattedAccession,
        patientInfo: order.patientInfo,
        status: order.status,
        statusDisplay: order.statusDisplay,
        priority: order.priority,
        orderDate: order.orderDate,
        instructions: order.instructions,
        tests: testsByOrder[order._id] || [],
        createdAt: order.createdAt,
      }));

      console.log(
        `[${new Date().toISOString()}] GET /api/lab/collection - SUCCESS 200 - Retrieved ${
          result.data.length
        } collection orders`
      );

      res.json({
        success: true,
        data: formattedOrders,
        pagination: result.pagination,
        total: result.total,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] GET /api/lab/collection - ERROR 500:`,
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
  }
);

// POST /api/lab/collection/collect - Mark Samples as Collected
router.post(
  "/collection/collect",
  validate(collectSamplesSchema),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] POST /api/lab/collection/collect - Request received`
    );
    try {
      const { testIds, collectedBy, collectionData = {} } = req.body;

      // Update test statuses to collected
      const updatePromises = testIds.map(async (testId) => {
        const updateData = {
          status: "collected",
          collectedBy,
          collectedAt: new Date(),
          ...(collectionData[testId] || {}),
        };

        return LabOrderTest.findByIdAndUpdate(testId, updateData, {
          new: true,
        });
      });

      const updatedTests = await Promise.all(updatePromises);
      const validTests = updatedTests.filter((test) => test !== null);

      if (validTests.length === 0) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/lab/collection/collect - ERROR 404 - No valid tests found`
        );
        return res.status(404).json({
          success: false,
          message: "No valid tests found for collection",
        });
      }

      console.log(
        `[${new Date().toISOString()}] POST /api/lab/collection/collect - SUCCESS 200 - Collected ${
          validTests.length
        } samples`
      );

      res.json({
        success: true,
        message: `Successfully marked ${validTests.length} samples as collected`,
        data: {
          collectedTests: validTests.length,
          collectedBy,
          collectedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] POST /api/lab/collection/collect - ERROR 500:`,
        {
          message: error.message,
          stack: error.stack,
          requestBody: req.body,
        }
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// =============================================================================
// RESULT ENTRY WORKFLOW
// =============================================================================

// GET /api/lab/entry - Get Tests Ready for Result Entry
router.get("/entry", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/entry - Request received`
  );
  try {
    const { page = 1, limit = 10, search, priority } = req.query;

    // Find collected tests that need result entry
    const query = { status: "collected" };
    if (priority) query.priority = priority;

    const tests = await LabOrderTest.find(query)
      .populate({
        path: "labOrderId",
        select: "accessionNo patientInfo priority orderDate",
        match: search
          ? {
              $or: [
                { "patientInfo.name": { $regex: search, $options: "i" } },
                { "patientInfo.uhid": { $regex: search, $options: "i" } },
                { accessionNo: { $regex: search, $options: "i" } },
              ],
            }
          : {},
      })
      .populate("serviceId", "name code category")
      .sort({ "labOrderId.priority": 1, createdAt: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Filter out tests where labOrderId didn't match search criteria
    const filteredTests = tests.filter((test) => test.labOrderId !== null);

    // Get parameters for each test
    const testsWithParameters = await Promise.all(
      filteredTests.map(async (test) => {
        const parameters = await ParameterMaster.find({
          serviceId: test.serviceId._id,
          isActive: true,
        }).sort({ sortOrder: 1 });

        // Get existing results
        const results = await LabResult.find({
          labOrderTestId: test._id,
        }).populate("parameterId");

        return {
          ...test.toJSON(),
          parameters,
          results,
        };
      })
    );

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/entry - SUCCESS 200 - Retrieved ${
        testsWithParameters.length
      } tests for entry`
    );

    res.json({
      success: true,
      data: testsWithParameters,
      total: testsWithParameters.length,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/lab/entry - ERROR 500:`,
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

// POST /api/lab/entry/save - Save Test Results
router.post("/entry/save", validate(saveResultsSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/lab/entry/save - Request received`
  );
  try {
    const { labOrderTestId, results, enteredBy, technician } = req.body;

    // Validate lab order test exists
    const labOrderTest = await LabOrderTest.findById(labOrderTestId);
    if (!labOrderTest) {
      console.warn(
        `[${new Date().toISOString()}] POST /api/lab/entry/save - ERROR 404 - Lab order test not found: ${labOrderTestId}`
      );
      return res.status(404).json({
        success: false,
        message: "Lab order test not found",
      });
    }

    // Get patient info for interpretation
    const labOrder = await LabOrder.findById(labOrderTest.labOrderId);
    const patientGender = labOrder?.patientInfo?.gender;
    const patientAge = parseInt(labOrder?.patientInfo?.age) || 0;

    // Save each result
    const savedResults = await Promise.all(
      results.map(async (resultData) => {
        const {
          parameterId,
          value,
          technicalRemarks,
          instrumentUsed,
          methodUsed,
          dilutionFactor,
          flags,
        } = resultData;

        // Get parameter details for interpretation
        const parameter = await ParameterMaster.findById(parameterId);
        if (!parameter) {
          throw new Error(`Parameter not found: ${parameterId}`);
        }

        // Find or create result
        let labResult = await LabResult.findOne({
          labOrderTestId,
          parameterId,
        });

        if (labResult) {
          // Update existing result
          labResult.value = value;
          labResult.status = "saved";
          labResult.savedBy = enteredBy;
          labResult.savedAt = new Date();
          if (technicalRemarks) labResult.technicalRemarks = technicalRemarks;
          if (instrumentUsed) labResult.instrumentUsed = instrumentUsed;
          if (methodUsed) labResult.methodUsed = methodUsed;
          if (dilutionFactor) labResult.dilutionFactor = dilutionFactor;
          if (flags) labResult.flags = { ...labResult.flags, ...flags };
        } else {
          // Create new result
          labResult = new LabResult({
            labOrderTestId,
            parameterId,
            value,
            unit: parameter.unit,
            referenceRange: parameter.getRange
              ? parameter.getRange(patientGender, patientAge)
              : parameter.referenceRange,
            status: "saved",
            enteredBy,
            savedBy: enteredBy,
            savedAt: new Date(),
            technicalRemarks,
            instrumentUsed,
            methodUsed,
            dilutionFactor,
            flags,
            parameterInfo: {
              name: parameter.parameterName,
              code: parameter.parameterCode,
              dataType: parameter.dataType,
              methodology: parameter.methodology,
            },
          });
        }

        // Interpret the result
        labResult.interpretResult(parameter, patientGender, patientAge);

        if (technician) labResult.technician = technician;

        await labResult.save();
        return labResult;
      })
    );

    console.log(
      `[${new Date().toISOString()}] POST /api/lab/entry/save - SUCCESS 200 - Saved ${
        savedResults.length
      } results`
    );

    res.json({
      success: true,
      message: `Successfully saved ${savedResults.length} test results`,
      data: savedResults,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/lab/entry/save - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        requestBody: req.body,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// =============================================================================
// AUTHORIZATION WORKFLOW
// =============================================================================

// GET /api/lab/authorization - Get Saved Results Ready for Authorization
router.get("/authorization", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/authorization - Request received`
  );
  try {
    const { page = 1, limit = 10, search, priority, isCritical } = req.query;

    // Build query for saved tests
    let matchQuery = { status: "saved" };
    if (priority) matchQuery["labOrderId.priority"] = priority;
    if (isCritical === "true") matchQuery.isCritical = true;

    const tests = await LabOrderTest.aggregate([
      {
        $match: matchQuery,
      },
      {
        $lookup: {
          from: "laborders",
          localField: "labOrderId",
          foreignField: "_id",
          as: "labOrder",
        },
      },
      {
        $unwind: "$labOrder",
      },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $unwind: "$service",
      },
      {
        $lookup: {
          from: "labresults",
          localField: "_id",
          foreignField: "labOrderTestId",
          as: "results",
        },
      },
      {
        $match: search
          ? {
              $or: [
                {
                  "labOrder.patientInfo.name": {
                    $regex: search,
                    $options: "i",
                  },
                },
                {
                  "labOrder.patientInfo.uhid": {
                    $regex: search,
                    $options: "i",
                  },
                },
                { "labOrder.accessionNo": { $regex: search, $options: "i" } },
              ],
            }
          : {},
      },
      {
        $sort: { "labOrder.priority": 1, createdAt: 1 },
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit),
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/authorization - SUCCESS 200 - Retrieved ${
        tests.length
      } tests for authorization`
    );

    res.json({
      success: true,
      data: tests,
      total: tests.length,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/lab/authorization - ERROR 500:`,
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

// POST /api/lab/authorization/authorize - Authorize Test Results
router.post(
  "/authorization/authorize",
  validate(authorizeResultsSchema),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] POST /api/lab/authorization/authorize - Request received`
    );
    try {
      const { resultIds, authorizedBy, clinicalRemarks, bulkRemarks } =
        req.body;

      // Update result statuses to authorized
      const updatePromises = resultIds.map(async (resultId) => {
        const updateData = {
          status: "authorized",
          authorizedBy,
          authorizedAt: new Date(),
        };

        if (clinicalRemarks) updateData.clinicalRemarks = clinicalRemarks;
        if (bulkRemarks) updateData.clinicalRemarks = bulkRemarks;

        return LabResult.findByIdAndUpdate(resultId, updateData, { new: true });
      });

      const authorizedResults = await Promise.all(updatePromises);
      const validResults = authorizedResults.filter(
        (result) => result !== null
      );

      if (validResults.length === 0) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/lab/authorization/authorize - ERROR 404 - No valid results found`
        );
        return res.status(404).json({
          success: false,
          message: "No valid results found for authorization",
        });
      }

      console.log(
        `[${new Date().toISOString()}] POST /api/lab/authorization/authorize - SUCCESS 200 - Authorized ${
          validResults.length
        } results`
      );

      res.json({
        success: true,
        message: `Successfully authorized ${validResults.length} test results`,
        data: {
          authorizedResults: validResults.length,
          authorizedBy,
          authorizedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] POST /api/lab/authorization/authorize - ERROR 500:`,
        {
          message: error.message,
          stack: error.stack,
          requestBody: req.body,
        }
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// =============================================================================
// REPORT GENERATION
// =============================================================================

// GET /api/lab/report/:accessionNo - Generate Lab Report
router.get(
  "/report/:accessionNo",
  validate(reportQuerySchema, "query"),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] GET /api/lab/report/${
        req.params.accessionNo
      } - Request received`
    );
    try {
      const { accessionNo } = req.params;
      const {
        format = "json",
        includeRanges = true,
        includeFlags = true,
        includeRemarks = true,
      } = req.query;

      // Find the lab order
      const labOrder = await LabOrder.findOne({ accessionNo })
        .populate(
          "patientId",
          "patientName uhid mobileNo age ageUnit gender address"
        )
        .populate("doctorId", "username email")
        .populate("opdBillingId", "billId billing");

      if (!labOrder) {
        console.warn(
          `[${new Date().toISOString()}] GET /api/lab/report/${accessionNo} - ERROR 404 - Lab order not found`
        );
        return res.status(404).json({
          success: false,
          message: "Lab report not found",
        });
      }

      // Get all tests for this order
      const tests = await LabOrderTest.find({ labOrderId: labOrder._id })
        .populate("serviceId", "name code category")
        .sort({ createdAt: 1 });

      // Get all results for these tests
      const testIds = tests.map((test) => test._id);
      const results = await LabResult.find({
        labOrderTestId: { $in: testIds },
        status: "authorized", // Only include authorized results
      })
        .populate(
          "parameterId",
          "parameterName parameterCode unit referenceRange methodology"
        )
        .populate("authorizedBy", "username")
        .sort({ "parameterId.sortOrder": 1 });

      // Group results by test
      const resultsByTest = results.reduce((acc, result) => {
        if (!acc[result.labOrderTestId]) acc[result.labOrderTestId] = [];
        acc[result.labOrderTestId].push(result);
        return acc;
      }, {});

      // Build the report data
      const reportData = {
        reportHeader: {
          accessionNo: labOrder.accessionNo,
          reportDate: new Date(),
          status: labOrder.status,
          orderDate: labOrder.orderDate,
          reportType: "Laboratory Report",
        },
        patientInfo: {
          name: labOrder.patientId?.patientName || labOrder.patientInfo.name,
          uhid: labOrder.patientId?.uhid || labOrder.patientInfo.uhid,
          age: labOrder.patientInfo.age,
          gender: labOrder.patientInfo.gender,
          mobileNo: labOrder.patientInfo.mobileNo,
          address: labOrder.patientId?.address,
        },
        doctorInfo: {
          name: labOrder.doctorInfo.name || labOrder.doctorId?.username,
          email: labOrder.doctorId?.email,
        },
        billingInfo: labOrder.opdBillingId
          ? {
              billId: labOrder.opdBillingId.billId,
              amount: labOrder.opdBillingId.billing?.grandTotal,
            }
          : null,
        tests: tests.map((test) => {
          const testResults = resultsByTest[test._id] || [];
          return {
            testId: test._id,
            serviceName: test.serviceId?.name || test.serviceInfo.name,
            serviceCode: test.serviceId?.code || test.serviceInfo.code,
            category: test.serviceId?.category || test.serviceInfo.category,
            status: test.status,
            collectedAt: test.collectedAt,
            authorizedAt: test.authorizedAt,
            results: testResults.map((result) => ({
              parameterId: result.parameterId._id,
              parameterName: result.parameterId.parameterName,
              parameterCode: result.parameterId.parameterCode,
              value: result.displayValue,
              unit: result.unit,
              referenceRange: includeRanges ? result.referenceRange : undefined,
              interpretation: result.interpretationDisplay,
              isCritical: result.isCritical,
              isAbnormal: result.isAbnormal,
              methodology: result.parameterId.methodology,
              flags: includeFlags ? result.qualityFlags : undefined,
              technicalRemarks: includeRemarks
                ? result.technicalRemarks
                : undefined,
              clinicalRemarks: includeRemarks
                ? result.clinicalRemarks
                : undefined,
              authorizedBy: result.authorizedBy?.username,
              authorizedAt: result.authorizedAt,
            })),
          };
        }),
        summary: {
          totalTests: tests.length,
          completedTests: tests.filter((test) => test.status === "authorized")
            .length,
          criticalResults: results.filter((result) => result.isCritical).length,
          abnormalResults: results.filter((result) => result.isAbnormal).length,
        },
        generatedAt: new Date(),
        generatedBy: "Hospital Management System",
      };

      if (format === "pdf") {
        // TODO: Implement PDF generation using libraries like puppeteer or pdfkit
        console.log(
          `[${new Date().toISOString()}] GET /api/lab/report/${accessionNo} - PDF generation not yet implemented`
        );
        return res.status(501).json({
          success: false,
          message: "PDF report generation not yet implemented",
        });
      }

      console.log(
        `[${new Date().toISOString()}] GET /api/lab/report/${accessionNo} - SUCCESS 200 - Report generated`
      );

      res.json({
        success: true,
        data: reportData,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] GET /api/lab/report/${
          req.params.accessionNo
        } - ERROR 500:`,
        {
          message: error.message,
          stack: error.stack,
          accessionNo: req.params.accessionNo,
        }
      );
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// =============================================================================
// PARAMETER MANAGEMENT
// =============================================================================

// GET /api/lab/parameters - List Parameters
router.get(
  "/parameters",
  validate(parameterQuerySchema, "query"),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] GET /api/lab/parameters - Request received`
    );
    try {
      const { serviceId, isActive, dataType, search, all } = req.query;

      let query = {};
      if (serviceId) query.serviceId = serviceId;
      if (isActive !== undefined) query.isActive = isActive === "true";
      if (dataType) query.dataType = dataType;
      if (search) {
        query.$or = [
          { parameterName: { $regex: search, $options: "i" } },
          { parameterCode: { $regex: search, $options: "i" } },
        ];
      }

      const parameters = await ParameterMaster.find(query)
        .populate({
          path: "serviceId",
          select: "name code category",
          match: { category: SERVICE_CATEGORIES.LABORATORY },
        })
        .sort({ serviceId: 1, sortOrder: 1 });

      // Filter out parameters where service population failed (non-pathology services)
      const filteredParameters = parameters.filter((param) => param.serviceId);

      console.log(
        `[${new Date().toISOString()}] GET /api/lab/parameters - SUCCESS 200 - Retrieved ${
          filteredParameters.length
        } pathology parameters`
      );

      res.json({
        success: true,
        data: filteredParameters,
        total: filteredParameters.length,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] GET /api/lab/parameters - ERROR 500:`,
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
  }
);

// POST /api/lab/parameters - Create Parameter
router.post(
  "/parameters",
  validate(createParameterSchema),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] POST /api/lab/parameters - Request received`
    );
    try {
      const { serviceId } = req.body;

      // Validate service exists and is a pathology service
      const service = await Service.findOne({
        _id: serviceId,
        category: SERVICE_CATEGORIES.LABORATORY,
        status: "active",
      });

      if (!service) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/lab/parameters - ERROR 400 - Invalid pathology service: ${serviceId}`
        );
        return res.status(400).json({
          success: false,
          message: "Invalid pathology service",
          errors: [
            {
              field: "serviceId",
              message:
                "Service is either not found, not a pathology service, or inactive",
            },
          ],
        });
      }

      const parameter = new ParameterMaster(req.body);
      await parameter.save();

      console.log(
        `[${new Date().toISOString()}] POST /api/lab/parameters - SUCCESS 201 - Parameter created: ${
          parameter.parameterName
        }`
      );
      res.status(201).json({
        success: true,
        message: "Parameter created successfully",
        data: parameter,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] POST /api/lab/parameters - ERROR 500:`,
        {
          message: error.message,
          stack: error.stack,
          requestBody: req.body,
        }
      );

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Parameter code already exists for this service",
        });
      }

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
