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
  entryOrdersQuerySchema,
  authorizationQuerySchema,
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

// Function to update lab order status based on test statuses
async function updateLabOrderStatus(labOrderId) {
  const tests = await LabOrderTest.find({ labOrderId });
  const labOrder = await LabOrder.findById(labOrderId);

  if (!labOrder || !tests.length) return;

  const statuses = tests.map((test) => test.status);
  let newStatus;

  if (statuses.every((status) => status === "authorized")) {
    newStatus = "authorized";
  } else if (
    statuses.every((status) => status === "saved" || status === "authorized")
  ) {
    newStatus = "saved";
  } else if (
    statuses.every(
      (status) =>
        status === "collected" || status === "saved" || status === "authorized"
    )
  ) {
    newStatus = "collected";
  } else {
    newStatus = "pending";
  }

  if (labOrder.status !== newStatus) {
    labOrder.status = newStatus;
    await labOrder.save();
  }
}

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
        category, // Add category filter for pathology/radiology separation
        mobileNo, // Patient mobile number filter
        patientName, // Patient name filter
        uhid, // Patient UHID filter
      } = req.query;

      // Build individual query parts
      const statusQuery = status ? { status } : {};
      const priorityQuery = priority ? { priority } : {};
      const patientQuery = patientId ? { patientId } : {};
      const doctorQuery = doctorId ? { doctorId } : {};
      const accessionQuery = accessionNo ? { accessionNo } : {};
      const dateQuery = buildDateRangeQuery("orderDate", from, to);
      
      // Patient-specific filters
      const mobileNoQuery = mobileNo ? { "patientInfo.mobileNo": { $regex: mobileNo, $options: "i" } } : {};
      const patientNameQuery = patientName ? { "patientInfo.name": { $regex: patientName, $options: "i" } } : {};
      const uhidQuery = uhid ? { "patientInfo.uhid": { $regex: uhid, $options: "i" } } : {};
      
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
        searchQuery,
        mobileNoQuery,
        patientNameQuery,
        uhidQuery
      );

      // If category is specified, we need to join with LabOrderTest to filter by service category
      let ordersQuery;

      if (category) {
        // Find orders that have tests in the specified category
        const ordersWithCategoryTests = await LabOrder.aggregate([
          { $match: finalQuery },
          {
            $lookup: {
              from: "labordertests",
              localField: "_id",
              foreignField: "labOrderId",
              as: "tests",
            },
          },
          {
            $lookup: {
              from: "services",
              localField: "tests.serviceId",
              foreignField: "_id",
              as: "services",
            },
          },
          {
            $match: {
              "services.category": category,
            },
          },
          {
            $lookup: {
              from: "visits",
              localField: "visitId",
              foreignField: "_id",
              as: "visit",
            },
          },
          { $sort: { orderDate: -1 } },
        ]);

        // Apply pagination if needed
        const startIndex =
          !all || all !== "true" ? (parseInt(page) - 1) * parseInt(limit) : 0;
        const endIndex =
          !all || all !== "true"
            ? startIndex + parseInt(limit)
            : ordersWithCategoryTests.length;
        const paginatedOrders = ordersWithCategoryTests.slice(
          startIndex,
          endIndex
        );

        // Format each order as one row, with combined service info
        const formattedOrders = await Promise.all(
          paginatedOrders.map(async (order) => {
            // Get tests for this order in the specified category
            const categoryTests = await LabOrderTest.find({
              labOrderId: order._id,
            }).populate({
              path: "serviceId",
              match: { category: category },
              select: "name code category reportName",
            });

            const validTests = categoryTests.filter((test) => test.serviceId);

            // Combine service names and report names
            const serviceNames = validTests
              .map((t) => t.serviceId.name)
              .join(", ");
            const reportNames = validTests
              .map((t) => t.serviceId.reportName || t.serviceId.name)
              .join(", ");

            return {
              id: order._id, // LabOrder ID (for popup)
              accessionNo: order.accessionNo,
              orderDate: order.orderDate,
              reportName: reportNames,
              serviceName: serviceNames,
              consultantDoctor: order.doctorName,
              referringDoctor: order.doctorName,
              uhid: order.patientInfo?.uhid,
              patientName: order.patientInfo?.name,
              ageGender: `${order.patientInfo?.age}/${
                order.patientInfo?.gender?.charAt(0) || ""
              }`,
              visitNo: order.visit?.[0]?.visitId || order.visitId || "",
              status: order.status, // Overall order status
              statusDisplay: order.statusDisplay,
              priority: order.priority,
              serviceCategory: category,
              totalTests: validTests.length,
              // Additional fields for popup
              tests: validTests,
            };
          })
        );

        res.json({
          success: true,
          data: formattedOrders,
          total: formattedOrders.length,
        });
      } else {
        // Original logic for non-category filtered requests
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
            ? `Retrieved all ${formattedOrders.length} lab orders`
            : `Retrieved ${formattedOrders.length} lab orders`;

        console.log(
          `[${new Date().toISOString()}] GET /api/lab/orders - SUCCESS 200 - ${logMessage}`
        );

        res.json({
          success: true,
          data: formattedOrders,
          pagination: result.pagination,
          total: result.total,
        });
      }
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
      const { page, limit, search, priority, from, to, category } = req.query;

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

      // Find orders that have tests in the specified category and appropriate status
      let ordersQuery;
      if (category) {
        ordersQuery = await LabOrder.aggregate([
          { $match: finalQuery },
          {
            $lookup: {
              from: "labordertests",
              localField: "_id",
              foreignField: "labOrderId",
              as: "tests",
            },
          },
          {
            $lookup: {
              from: "services",
              localField: "tests.serviceId",
              foreignField: "_id",
              as: "services",
            },
          },
          {
            $match: {
              "services.category": category,
            },
          },
          {
            $lookup: {
              from: "visits",
              localField: "visitId",
              foreignField: "_id",
              as: "visit",
            },
          },
          { $sort: { priority: 1, orderDate: 1 } },
        ]);
      } else {
        ordersQuery = await LabOrder.find(finalQuery)
          .sort({ priority: 1, orderDate: 1 })
          .lean();
      }

      // Apply pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedOrders = ordersQuery.slice(startIndex, endIndex);

      // Format data for response - one row per order
      const formattedOrders = await Promise.all(
        paginatedOrders.map(async (order) => {
          // Get tests for this order in the specified category
          const testsQuery = category
            ? { labOrderId: order._id }
            : { labOrderId: order._id };

          const tests = await LabOrderTest.find(testsQuery).populate({
            path: "serviceId",
            select: "name code category reportName",
            match: category ? { category: category } : {},
          });

          const validTests = tests.filter(
            (test) =>
              test.serviceId &&
              (!category || test.serviceId.category === category)
          );

          // Get visit info if available
          const visitInfo =
            order.visitId || order.visit?.[0]
              ? order.visit?.[0] ||
                (await require("../models/Visit").findById(order.visitId))
              : null;

          // Combine service names and report names
          const serviceNames = validTests
            .map((t) => t.serviceId.name)
            .join(", ");
          const reportNames = validTests
            .map((t) => t.serviceId.reportName || t.serviceId.name)
            .join(", ");

          return {
            id: order._id, // LabOrder ID (for popup)
            accessionNo: order.accessionNo,
            orderDate: order.orderDate,
            reportName: reportNames,
            serviceName: serviceNames,
            consultantDoctor: order.doctorName,
            referringDoctor: order.doctorName,
            uhid: order.patientInfo?.uhid,
            patientName: order.patientInfo?.name,
            ageGender: `${order.patientInfo?.age}/${
              order.patientInfo?.gender?.charAt(0) || ""
            }`,
            visitNo: visitInfo?.visitId || order.visitId || "",
            status: order.status, // Overall order status
            statusDisplay: order.statusDisplay,
            priority: order.priority,
            serviceCategory: category,
            totalTests: validTests.length,
            tests: validTests, // Include tests for popup
            createdAt: order.createdAt,
          };
        })
      );

      console.log(
        `[${new Date().toISOString()}] GET /api/lab/collection - SUCCESS 200 - Retrieved ${
          formattedOrders.length
        } collection orders`
      );

      res.json({
        success: true,
        data: formattedOrders,
        total: formattedOrders.length,
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

// GET /api/lab/orders/:orderId/details - Get Order Details with All Tests (for popup)
router.get("/orders/:orderId/details", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/orders/${
      req.params.orderId
    }/details - Request received`
  );
  try {
    const { orderId } = req.params;
    const { category } = req.query;

    // Get the lab order with patient and visit info
    const labOrder = await LabOrder.findById(orderId)
      .populate("patientId", "patientName uhid mobileNo age ageUnit gender")
      .populate("visitId", "visitId");

    if (!labOrder) {
      return res.status(404).json({
        success: false,
        message: "Lab order not found",
      });
    }

    // Get all tests for this order, optionally filtered by category
    const tests = await LabOrderTest.find({ labOrderId: orderId }).populate({
      path: "serviceId",
      select: "name code category reportName",
      match: category ? { category: category } : {},
    });

    // Filter out tests where serviceId population failed (wrong category)
    const validTests = tests.filter((test) => test.serviceId);

    // For each test, get its parameters and current results
    const testsWithDetails = await Promise.all(
      validTests.map(async (test) => {
        // Get parameters for this service
        const parameters = await ParameterMaster.find({
          serviceId: test.serviceId._id,
          isActive: true,
        });
        console.log(
          await ParameterMaster.find({
            serviceId: test.serviceId._id,
            isActive: true,
          }),
          "got",
          test.serviceId._id
        );

        // Get existing results
        const results = await LabResult.find({
          labOrderTestId: test._id,
        }).populate("parameterId", "parameterName unit referenceRange");

        // Create a map of results by parameter ID
        const resultsByParameter = results.reduce((acc, result) => {
          acc[result.parameterId._id.toString()] = result;
          return acc;
        }, {});

        return {
          testId: test._id,
          reportName: test.serviceId.reportName || test.serviceId.name,
          serviceName: test.serviceId.name,
          serviceCode: test.serviceId.code,
          category: test.serviceId.category,
          sampleType: test.sampleType || "whole_blood",
          containerType: test.containerType || "plain_tube",
          status: test.status,
          statusDisplay: test.statusDisplay,
          collectedAt: test.collectedAt,
          collectedBy: test.collectedBy,
          savedAt: test.savedAt,
          savedBy: test.savedBy,
          authorizedAt: test.authorizedAt,
          authorizedBy: test.authorizedBy,
          // Quality control flags
          qualityFlags: {
            hemolyzed: test.hemolyzed || false,
            lipemic: test.lipemic || false,
            icteric: test.icteric || false,
          },
          // Additional test metadata
          instructions: test.instructions,
          technician: test.technician,
          machineUsed: test.machineUsed,
          remarks: test.remarks,
          parameters: parameters.map((param) => ({
            parameterId: param._id,
            parameterName: param.parameterName,
            parameterCode: param.parameterCode,
            unit: param.unit,
            referenceRange: param.referenceRange,
            dataType: param.dataType,
            options: param.options || [],
            methodology: param.methodology,
            sortOrder: param.sortOrder,
            // Include current result if exists
            currentResult: resultsByParameter[param._id.toString()]
              ? {
                  id: resultsByParameter[param._id.toString()]._id,
                  value: resultsByParameter[param._id.toString()].value,
                  status: resultsByParameter[param._id.toString()].status,
                  interpretation:
                    resultsByParameter[param._id.toString()].interpretation,
                  isCritical:
                    resultsByParameter[param._id.toString()].isCritical,
                  isAbnormal:
                    resultsByParameter[param._id.toString()].isAbnormal,
                  enteredAt: resultsByParameter[param._id.toString()].enteredAt,
                  savedAt: resultsByParameter[param._id.toString()].savedAt,
                  authorizedAt:
                    resultsByParameter[param._id.toString()].authorizedAt,
                }
              : null,
          })),
        };
      })
    );

    // Format the response
    const orderDetails = {
      id: labOrder._id,
      accessionNo: labOrder.accessionNo,
      orderDate: labOrder.orderDate,
      consultantDoctor: labOrder.doctorName,
      referringDoctor: labOrder.doctorName,
      uhid: labOrder.patientInfo?.uhid,
      patientName: labOrder.patientInfo?.name,
      ageGender: `${labOrder.patientInfo?.age}/${
        labOrder.patientInfo?.gender?.charAt(0) || ""
      }`,
      visitNo: labOrder.visitId?.visitId || labOrder.visitId || "",
      status: labOrder.status,
      statusDisplay: labOrder.statusDisplay,
      priority: labOrder.priority,
      instructions: labOrder.instructions,
      tests: testsWithDetails,
      totalTests: testsWithDetails.length,
    };

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/orders/${orderId}/details - SUCCESS 200 - Retrieved order details with ${
        testsWithDetails.length
      } tests`
    );

    res.json({
      success: true,
      data: orderDetails,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/lab/orders/${
        req.params.orderId
      }/details - ERROR 500:`,
      { message: error.message, stack: error.stack }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/lab/reports/:reportId - Get Report Details with Parameters (for popup)
router.get("/reports/:reportId", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/reports/${
      req.params.reportId
    } - Request received`
  );
  try {
    const { reportId } = req.params;

    // Get the lab order test with all related data
    const labOrderTest = await LabOrderTest.findById(reportId)
      .populate({
        path: "labOrderId",
        select: "accessionNo patientInfo doctorName orderDate visitId priority",
        populate: {
          path: "visitId",
          select: "visitId",
        },
      })
      .populate("serviceId", "name code category reportName");

    if (!labOrderTest) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Get parameters for this service
    const parameters = await ParameterMaster.find({
      serviceId: labOrderTest.serviceId._id,
      isActive: true,
    }).sort({ sortOrder: 1 });

    // Get existing results
    const results = await LabResult.find({
      labOrderTestId: reportId,
    }).populate("parameterId", "parameterName unit referenceRange");

    // Create a map of results by parameter ID for easy lookup
    const resultsByParameter = results.reduce((acc, result) => {
      acc[result.parameterId._id.toString()] = result;
      return acc;
    }, {});

    // Format the response
    const reportDetails = {
      id: labOrderTest._id,
      accessionNo: labOrderTest.labOrderId.accessionNo,
      orderDate: labOrderTest.labOrderId.orderDate,
      reportName:
        labOrderTest.serviceId.reportName || labOrderTest.serviceId.name,
      serviceName: labOrderTest.serviceId.name,
      consultantDoctor: labOrderTest.labOrderId.doctorName,
      referringDoctor: labOrderTest.labOrderId.doctorName,
      uhid: labOrderTest.labOrderId.patientInfo?.uhid,
      patientName: labOrderTest.labOrderId.patientInfo?.name,
      ageGender: `${labOrderTest.labOrderId.patientInfo?.age}/${
        labOrderTest.labOrderId.patientInfo?.gender?.charAt(0) || ""
      }`,
      visitNo: labOrderTest.labOrderId.visitId?.visitId || "",
      status: labOrderTest.status,
      statusDisplay: labOrderTest.statusDisplay,
      priority: labOrderTest.labOrderId.priority,
      parameters: parameters.map((param) => ({
        parameterId: param._id,
        parameterName: param.parameterName,
        parameterCode: param.parameterCode,
        unit: param.unit,
        referenceRange: param.referenceRange,
        dataType: param.dataType,
        methodology: param.methodology,
        sortOrder: param.sortOrder,
        // Include current result if exists
        currentResult: resultsByParameter[param._id.toString()]
          ? {
              id: resultsByParameter[param._id.toString()]._id,
              value: resultsByParameter[param._id.toString()].value,
              status: resultsByParameter[param._id.toString()].status,
              interpretation:
                resultsByParameter[param._id.toString()].interpretation,
              isCritical: resultsByParameter[param._id.toString()].isCritical,
              isAbnormal: resultsByParameter[param._id.toString()].isAbnormal,
              enteredAt: resultsByParameter[param._id.toString()].enteredAt,
              savedAt: resultsByParameter[param._id.toString()].savedAt,
              authorizedAt:
                resultsByParameter[param._id.toString()].authorizedAt,
            }
          : null,
      })),
    };

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/reports/${reportId} - SUCCESS 200 - Retrieved report details`
    );

    res.json({
      success: true,
      data: reportDetails,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/lab/reports/${
        req.params.reportId
      } - ERROR 500:`,
      { message: error.message, stack: error.stack }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/lab/reports/update-test-details - Update Test Sample/Container Details
router.post("/reports/update-test-details", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/lab/reports/update-test-details - Request received`
  );
  try {
    const { reportId, sampleType, containerType, instructions, updatedBy } =
      req.body;

    // Validate sample type and container type against enums
    const { SAMPLE_TYPES, CONTAINER_TYPES } = require("../constants/enums");

    const updateData = {};

    if (sampleType && Object.values(SAMPLE_TYPES).includes(sampleType)) {
      updateData.sampleType = sampleType;
    }

    if (
      containerType &&
      Object.values(CONTAINER_TYPES).includes(containerType)
    ) {
      updateData.containerType = containerType;
    }

    if (instructions !== undefined) {
      updateData.instructions = instructions;
    }

    const updatedTest = await LabOrderTest.findByIdAndUpdate(
      reportId,
      updateData,
      { new: true }
    );

    if (!updatedTest) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] POST /api/lab/reports/update-test-details - SUCCESS 200 - Updated test details for ${reportId}`
    );

    res.json({
      success: true,
      message: "Test details updated successfully",
      data: {
        reportId,
        sampleType: updatedTest.sampleType,
        containerType: updatedTest.containerType,
        instructions: updatedTest.instructions,
        updatedBy,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/lab/reports/update-test-details - ERROR 500:`,
      { message: error.message, stack: error.stack }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/lab/reports/bulk-update-status - Update Multiple Reports Status (NEW)
router.post("/reports/bulk-update-status", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/lab/reports/bulk-update-status - Request received`
  );
  try {
    const { reportIds, status, updatedBy, remarks } = req.body;

    // Validate input
    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "reportIds array is required and must not be empty",
        errors: [
          {
            field: "reportIds",
            message: "Must be a non-empty array of report IDs",
          },
        ],
      });
    }

    // Validate status
    const validStatuses = ["pending", "collected", "saved", "authorized"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
        errors: [
          {
            field: "status",
            message: "Status must be one of: " + validStatuses.join(", "),
          },
        ],
      });
    }

    // Prepare update data
    const updateData = { status };
    const now = new Date();

    switch (status) {
      case "collected":
        updateData.collectedAt = now;
        updateData.collectedBy = updatedBy;
        break;
      case "saved":
        updateData.savedAt = now;
        updateData.savedBy = updatedBy;
        break;
      case "authorized":
        updateData.authorizedAt = now;
        updateData.authorizedBy = updatedBy;
        break;
    }

    if (remarks) {
      updateData.remarks = remarks;
    }

    // Update all tests in parallel
    const updatePromises = reportIds.map((reportId) =>
      LabOrderTest.findByIdAndUpdate(reportId, updateData, { new: true })
    );

    const updatedTests = await Promise.all(updatePromises);
    const validTests = updatedTests.filter((test) => test !== null);

    if (validTests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No valid tests found for update",
      });
    }

    // Update parent order status for each affected order
    const affectedOrderIds = [...new Set(validTests.map(test => test.labOrderId))];
    for (const labOrderId of affectedOrderIds) {
      await updateLabOrderStatus(labOrderId);
    }

    // Check if any tests failed to update
    const failedUpdates = reportIds.length - validTests.length;
    const successMessage =
      failedUpdates > 0
        ? `Successfully updated ${validTests.length} tests to ${status}. ${failedUpdates} tests not found.`
        : `Successfully updated ${validTests.length} tests to ${status}`;

    console.log(
      `[${new Date().toISOString()}] POST /api/lab/reports/bulk-update-status - SUCCESS 200 - Updated ${
        validTests.length
      }/${reportIds.length} tests to ${status}`
    );

    res.json({
      success: true,
      message: successMessage,
      data: {
        updatedCount: validTests.length,
        failedCount: failedUpdates,
        totalRequested: reportIds.length,
        status,
        statusDisplay: validTests[0]?.statusDisplay || status,
        updatedBy,
        updatedAt: now,
        updatedTests: validTests.map((test) => ({
          testId: test._id,
          status: test.status,
          statusDisplay: test.statusDisplay,
        })),
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/lab/reports/bulk-update-status - ERROR 500:`,
      { message: error.message, stack: error.stack }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/lab/reports/update-status - Update Report Status (Single test)
router.post("/reports/update-status", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/lab/reports/update-status - Request received`
  );
  try {
    const { reportId, status, updatedBy, remarks } = req.body;

    // Validate status
    const validStatuses = ["pending", "collected", "saved", "authorized"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
        errors: [
          {
            field: "status",
            message: "Status must be one of: " + validStatuses.join(", "),
          },
        ],
      });
    }

    // Update the LabOrderTest status
    const updateData = { status };
    const now = new Date();

    switch (status) {
      case "collected":
        updateData.collectedAt = now;
        updateData.collectedBy = updatedBy;
        break;
      case "saved":
        updateData.savedAt = now;
        updateData.savedBy = updatedBy;
        break;
      case "authorized":
        updateData.authorizedAt = now;
        updateData.authorizedBy = updatedBy;
        break;
    }

    if (remarks) {
      updateData.remarks = remarks;
    }

    const updatedTest = await LabOrderTest.findByIdAndUpdate(
      reportId,
      updateData,
      { new: true }
    );

    if (!updatedTest) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Update parent order status
    await updateLabOrderStatus(updatedTest.labOrderId);

    console.log(
      `[${new Date().toISOString()}] POST /api/lab/reports/update-status - SUCCESS 200 - Updated report ${reportId} to ${status}`
    );

    res.json({
      success: true,
      message: `Report status updated to ${status}`,
      data: {
        reportId,
        status,
        statusDisplay: updatedTest.statusDisplay,
        updatedBy,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/lab/reports/update-status - ERROR 500:`,
      { message: error.message, stack: error.stack }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

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

// GET /api/lab/entry-orders - Get Orders Ready for Result Entry (Grouped by Order)
router.get("/entry-orders", validate(entryOrdersQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/entry-orders - Request received`
  );
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      priority, 
      category, 
      mobileNo, 
      patientName, 
      uhid,
      from,
      to 
    } = req.query;

    // Build aggregation pipeline to get orders with collected tests
    let pipeline = [
      // Match collected tests
      { $match: { status: "collected" } },

      // Lookup order details
      {
        $lookup: {
          from: "laborders",
          localField: "labOrderId",
          foreignField: "_id",
          as: "labOrder",
        },
      },
      { $unwind: "$labOrder" },

      // Lookup service details
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: "$service" },

      // Filter by category if specified
      ...(category ? [{ $match: { "service.category": category } }] : []),

      // Filter by priority if specified
      ...(priority ? [{ $match: { "labOrder.priority": priority } }] : []),

      // Patient-specific filters for entry-orders
      ...(mobileNo ? [{ $match: { "labOrder.patientInfo.mobileNo": { $regex: mobileNo, $options: "i" } } }] : []),
      ...(patientName ? [{ $match: { "labOrder.patientInfo.name": { $regex: patientName, $options: "i" } } }] : []),
      ...(uhid ? [{ $match: { "labOrder.patientInfo.uhid": { $regex: uhid, $options: "i" } } }] : []),

      // Date range filter for entry-orders
      ...(from || to ? [{ $match: { "labOrder.orderDate": { 
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) })
      } } }] : []),

      // Search filter
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "labOrder.accessionNo": { $regex: search, $options: "i" } },
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
                ],
              },
            },
          ]
        : []),

      // Group by lab order (accession number)
      {
        $group: {
          _id: "$labOrderId",
          orderId: { $first: "$labOrderId" },
          accessionNo: { $first: "$labOrder.accessionNo" },
          orderDate: { $first: "$labOrder.orderDate" },
          patientInfo: { $first: "$labOrder.patientInfo" },
          doctorName: { $first: "$labOrder.doctorName" },
          priority: { $first: "$labOrder.priority" },
          visitId: { $first: "$labOrder.visitId" },
          // Collect all tests for this order
          tests: {
            $push: {
              testId: "$_id",
              serviceName: "$service.name",
              reportName: { $ifNull: ["$service.reportName", "$service.name"] },
              serviceCode: "$service.code",
              category: "$service.category",
              status: "$status",
              collectedAt: "$collectedAt",
              sampleType: "$sampleType",
              containerType: "$containerType",
            },
          },
          totalTests: { $sum: 1 },
          // Combine service and report names
          serviceNames: { $addToSet: "$service.name" },
          reportNames: {
            $addToSet: { $ifNull: ["$service.reportName", "$service.name"] },
          },
        },
      },

      // Add visit info
      {
        $lookup: {
          from: "visits",
          localField: "visitId",
          foreignField: "_id",
          as: "visit",
        },
      },

      // Format the output
      {
        $project: {
          id: "$orderId",
          accessionNo: 1,
          orderDate: 1,
          reportName: {
            $reduce: {
              input: "$reportNames",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
                  "$$this",
                ],
              },
            },
          },
          serviceName: {
            $reduce: {
              input: "$serviceNames",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
                  "$$this",
                ],
              },
            },
          },
          consultantDoctor: "$doctorName",
          referringDoctor: "$doctorName",
          uhid: "$patientInfo.uhid",
          patientName: "$patientInfo.name",
          ageGender: {
            $concat: [
              { $toString: "$patientInfo.age" },
              "/",
              { $substr: ["$patientInfo.gender", 0, 1] },
            ],
          },
          visitNo: { $ifNull: [{ $arrayElemAt: ["$visit.visitId", 0] }, ""] },
          status: "collected",
          priority: 1,
          totalTests: 1,
          tests: 1,
        },
      },

      // Sort by order date (newest first)
      { $sort: { orderDate: -1 } },

      // Pagination
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    const orders = await LabOrderTest.aggregate(pipeline);

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/entry-orders - SUCCESS 200 - Retrieved ${
        orders.length
      } orders for entry`
    );

    res.json({
      success: true,
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/lab/entry-orders - ERROR 500:`,
      { message: error.message, stack: error.stack }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/lab/entry - Get Tests Ready for Result Entry (Individual Tests)
router.get("/entry", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/entry - Request received`
  );
  try {
    const { page = 1, limit = 10, search, priority, category } = req.query;

    // Find collected tests that need result entry, with category filtering
    let testQuery = { status: "collected" };
    if (priority) testQuery.priority = priority;

    let tests = await LabOrderTest.find(testQuery)
      .populate({
        path: "labOrderId",
        select: "accessionNo patientInfo priority orderDate visitId doctorName",
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
      .populate("serviceId", "name code category reportName")
      .sort({ "labOrderId.priority": 1, createdAt: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Filter out tests where labOrderId didn't match search criteria
    tests = tests.filter((test) => test.labOrderId !== null);

    // Filter by category if specified
    if (category) {
      tests = tests.filter((test) => test.serviceId?.category === category);
    }

    // Format tests for 3-page workflow
    const formattedTests = await Promise.all(
      tests.map(async (test) => {
        // Get visit info if available
        const visitInfo = test.labOrderId?.visitId
          ? await require("../models/Visit").findById(test.labOrderId.visitId)
          : null;

        // Get parameters for this test
        const parameters = await ParameterMaster.find({
          serviceId: test.serviceId._id,
          isActive: true,
        }).sort({ sortOrder: 1 });

        // Get existing results
        const results = await LabResult.find({
          labOrderTestId: test._id,
        }).populate("parameterId");

        return {
          id: test._id,
          labOrderId: test.labOrderId._id,
          accessionNo: test.labOrderId.accessionNo,
          orderDate: test.labOrderId.orderDate,
          reportName: test.serviceId?.reportName || test.serviceId?.name,
          serviceName: test.serviceId?.name,
          consultantDoctor: test.labOrderId.doctorName,
          referringDoctor: test.labOrderId.doctorName,
          uhid: test.labOrderId.patientInfo?.uhid,
          patientName: test.labOrderId.patientInfo?.name,
          ageGender: `${test.labOrderId.patientInfo?.age}/${
            test.labOrderId.patientInfo?.gender?.charAt(0) || ""
          }`,
          visitNo: visitInfo?.visitId || test.labOrderId.visitId || "",
          status: test.status,
          statusDisplay: test.statusDisplay,
          priority: test.labOrderId.priority,
          parameters,
          results,
          testData: test,
        };
      })
    );

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/entry - SUCCESS 200 - Retrieved ${
        formattedTests.length
      } tests for entry`
    );

    res.json({
      success: true,
      data: formattedTests,
      total: formattedTests.length,
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

    // Update the LabOrderTest status to "saved" after all parameters are saved
    const updatedTest = await LabOrderTest.findByIdAndUpdate(labOrderTestId, {
      status: "saved",
      savedBy: enteredBy,
      savedAt: new Date(),
      ...(technician && { technician }),
    }, { new: true });

    // Update parent order status
    if (updatedTest) {
      await updateLabOrderStatus(updatedTest.labOrderId);
    }

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

// GET /api/lab/authorization - Get Orders Ready for Authorization (Grouped by Order)
router.get("/authorization", validate(authorizationQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/lab/authorization - Request received`
  );
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      priority, 
      category, 
      mobileNo, 
      patientName, 
      uhid,
      from,
      to 
    } = req.query;

    // Build aggregation pipeline to get orders with saved tests
    let pipeline = [
      // Match saved tests
      { $match: { status: "saved" } },

      // Lookup order details
      {
        $lookup: {
          from: "laborders",
          localField: "labOrderId",
          foreignField: "_id",
          as: "labOrder",
        },
      },
      { $unwind: "$labOrder" },

      // Lookup service details
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: "$service" },

      // Filter by category if specified
      ...(category ? [{ $match: { "service.category": category } }] : []),

      // Filter by priority if specified
      ...(priority ? [{ $match: { "labOrder.priority": priority } }] : []),

      // Patient-specific filters for authorization
      ...(mobileNo ? [{ $match: { "labOrder.patientInfo.mobileNo": { $regex: mobileNo, $options: "i" } } }] : []),
      ...(patientName ? [{ $match: { "labOrder.patientInfo.name": { $regex: patientName, $options: "i" } } }] : []),
      ...(uhid ? [{ $match: { "labOrder.patientInfo.uhid": { $regex: uhid, $options: "i" } } }] : []),

      // Date range filter for authorization
      ...(from || to ? [{ $match: { "labOrder.orderDate": { 
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) })
      } } }] : []),

      // Search filter
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "labOrder.accessionNo": { $regex: search, $options: "i" } },
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
                ],
              },
            },
          ]
        : []),

      // Group by lab order (accession number)
      {
        $group: {
          _id: "$labOrderId",
          orderId: { $first: "$labOrderId" },
          accessionNo: { $first: "$labOrder.accessionNo" },
          orderDate: { $first: "$labOrder.orderDate" },
          patientInfo: { $first: "$labOrder.patientInfo" },
          doctorName: { $first: "$labOrder.doctorName" },
          priority: { $first: "$labOrder.priority" },
          visitId: { $first: "$labOrder.visitId" },
          // Collect all tests for this order
          tests: {
            $push: {
              testId: "$_id",
              serviceName: "$service.name",
              reportName: { $ifNull: ["$service.reportName", "$service.name"] },
              serviceCode: "$service.code",
              category: "$service.category",
              status: "$status",
              savedAt: "$savedAt",
              sampleType: "$sampleType",
              containerType: "$containerType",
            },
          },
          totalTests: { $sum: 1 },
          // Combine service and report names
          serviceNames: { $addToSet: "$service.name" },
          reportNames: {
            $addToSet: { $ifNull: ["$service.reportName", "$service.name"] },
          },
        },
      },

      // Add visit info
      {
        $lookup: {
          from: "visits",
          localField: "visitId",
          foreignField: "_id",
          as: "visit",
        },
      },

      // Format the output
      {
        $project: {
          id: "$orderId",
          accessionNo: 1,
          orderDate: 1,
          reportName: {
            $reduce: {
              input: "$reportNames",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
                  "$$this",
                ],
              },
            },
          },
          serviceName: {
            $reduce: {
              input: "$serviceNames",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
                  "$$this",
                ],
              },
            },
          },
          consultantDoctor: "$doctorName",
          referringDoctor: "$doctorName",
          uhid: "$patientInfo.uhid",
          patientName: "$patientInfo.name",
          ageGender: {
            $concat: [
              { $toString: "$patientInfo.age" },
              "/",
              { $substr: ["$patientInfo.gender", 0, 1] },
            ],
          },
          visitNo: { $ifNull: [{ $arrayElemAt: ["$visit.visitId", 0] }, ""] },
          status: "saved",
          priority: 1,
          totalTests: 1,
          tests: 1,
        },
      },

      // Sort by priority and order date
      { $sort: { priority: 1, orderDate: -1 } },

      // Pagination
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    const orders = await LabOrderTest.aggregate(pipeline);

    console.log(
      `[${new Date().toISOString()}] GET /api/lab/authorization - SUCCESS 200 - Retrieved ${
        orders.length
      } orders for authorization`
    );

    res.json({
      success: true,
      data: orders,
      total: orders.length,
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

// POST /api/lab/authorization/update-and-authorize - Update Parameter Values and Authorize
router.post("/authorization/update-and-authorize", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/lab/authorization/update-and-authorize - Request received`
  );
  try {
    const { labOrderTestId, results, authorizedBy, clinicalRemarks } = req.body;

    // Validate lab order test exists
    const labOrderTest = await LabOrderTest.findById(labOrderTestId);
    if (!labOrderTest) {
      return res.status(404).json({
        success: false,
        message: "Lab order test not found",
      });
    }

    // Get patient info for interpretation
    const labOrder = await LabOrder.findById(labOrderTest.labOrderId);
    const patientGender = labOrder?.patientInfo?.gender;
    const patientAge = parseInt(labOrder?.patientInfo?.age) || 0;

    // Update and authorize each result
    const authorizedResults = await Promise.all(
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

        // Find existing result
        let labResult = await LabResult.findOne({
          labOrderTestId,
          parameterId,
        });

        if (labResult) {
          // Update existing result
          labResult.value = value;
          labResult.status = "authorized";
          labResult.authorizedBy = authorizedBy;
          labResult.authorizedAt = new Date();
          if (technicalRemarks) labResult.technicalRemarks = technicalRemarks;
          if (instrumentUsed) labResult.instrumentUsed = instrumentUsed;
          if (methodUsed) labResult.methodUsed = methodUsed;
          if (dilutionFactor) labResult.dilutionFactor = dilutionFactor;
          if (flags) labResult.flags = { ...labResult.flags, ...flags };
          if (clinicalRemarks) labResult.clinicalRemarks = clinicalRemarks;
        } else {
          // Create new result (shouldn't happen in normal flow, but handle it)
          labResult = new LabResult({
            labOrderTestId,
            parameterId,
            value,
            unit: parameter.unit,
            referenceRange: parameter.getRange
              ? parameter.getRange(patientGender, patientAge)
              : parameter.referenceRange,
            status: "authorized",
            enteredBy: authorizedBy,
            savedBy: authorizedBy,
            savedAt: new Date(),
            authorizedBy,
            authorizedAt: new Date(),
            technicalRemarks,
            instrumentUsed,
            methodUsed,
            dilutionFactor,
            flags,
            clinicalRemarks,
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

        await labResult.save();
        return labResult;
      })
    );

    // Update the LabOrderTest status to "authorized"
    const updatedTest = await LabOrderTest.findByIdAndUpdate(labOrderTestId, {
      status: "authorized",
      authorizedBy: authorizedBy,
      authorizedAt: new Date(),
    }, { new: true });

    // Update parent order status
    if (updatedTest) {
      await updateLabOrderStatus(updatedTest.labOrderId);
    }

    console.log(
      `[${new Date().toISOString()}] POST /api/lab/authorization/update-and-authorize - SUCCESS 200 - Updated and authorized ${
        authorizedResults.length
      } results`
    );

    res.json({
      success: true,
      message: `Successfully updated and authorized ${authorizedResults.length} test results`,
      data: authorizedResults,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/lab/authorization/update-and-authorize - ERROR 500:`,
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

      // Update LabOrderTest status for affected tests
      const affectedTestIds = [...new Set(validResults.map(result => result.labOrderTestId))];
      for (const testId of affectedTestIds) {
        // Check if all results for this test are now authorized
        const allResultsForTest = await LabResult.find({ labOrderTestId: testId });
        const allAuthorized = allResultsForTest.every(result => result.status === "authorized");
        
        if (allAuthorized) {
          // Update the test status to authorized
          const updatedTest = await LabOrderTest.findByIdAndUpdate(testId, {
            status: "authorized",
            authorizedBy,
            authorizedAt: new Date(),
          }, { new: true });
          
          // Update parent order status
          if (updatedTest) {
            await updateLabOrderStatus(updatedTest.labOrderId);
          }
        }
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
