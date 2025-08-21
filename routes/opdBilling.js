const express = require("express");
const OpdBilling = require("../models/OpdBilling");
const Patient = require("../models/Patient");
const Service = require("../models/Service");
const { validate } = require("../middleware/validation");
const {
  createOpdBillingSchema,
  updateOpdBillingSchema,
  opdBillingQuerySchema,
} = require("../validations/opdBillingSchema");
const {
  paginate,
  buildSearchQuery,
  buildDateRangeQuery,
  combineQueries,
} = require("../lib/pagination");
const LabOrder = require("../models/LabOrder");
const { ORDER_STATUS } = require("../constants/enums");

const router = express.Router();

// GET /api/opd-billing - List OPD Bills with Filters & Pagination
router.get("/", validate(opdBillingQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/opd-billing - Request received`
  );
  try {
    const { page, limit, search, status, patientId, from, to, all } = req.query;

    // Build individual query parts
    const statusQuery = status ? { status } : {};
    const patientQuery = patientId ? { patientId } : {};
    const dateQuery = buildDateRangeQuery("billDate", from, to);
    const searchQuery = buildSearchQuery(search, [
      "billId",
      "patientInfo.name",
      "patientInfo.uhid",
      "patientInfo.mobileNo",
      "consultantDoctor",
      "refby",
    ]);

    // Combine all queries
    const finalQuery = combineQueries(
      statusQuery,
      patientQuery,
      dateQuery,
      searchQuery
    );

    const result = await paginate(OpdBilling, {
      query: finalQuery,
      page,
      limit,
      all: all === "true",
      populate: {
        path: "patientId",
        select: "patientName uhid mobileNo",
      },
    });

    // Format data for response
    const formattedBills = result.data.map((bill) => ({
      id: bill._id,
      billId: bill.billId,
      patient: bill.patientId
        ? {
            id: bill.patientId._id,
            name: bill.patientId.patientName,
            uhid: bill.patientId.uhid,
            mobileNo: bill.patientId.mobileNo,
          }
        : bill.patientInfo,
      patientInfo: bill.patientInfo,
      patientCategory: bill.patientCategory,
      refby: bill.refby,
      consultantDoctor: bill.consultantDoctor,
      priority: bill.priority,
      paymentMode: bill.paymentMode,
      services: bill.services,
      billing: bill.billing,
      status: bill.status,
      billDate: bill.billDate,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
    }));

    const logMessage =
      all === "true"
        ? `Retrieved all ${result.data.length} OPD bills`
        : `Retrieved ${result.data.length} OPD bills`;

    console.log(
      `[${new Date().toISOString()}] GET /api/opd-billing - SUCCESS 200 - ${logMessage}`
    );

    res.json({
      success: true,
      data: formattedBills,
      pagination: result.pagination,
      total: result.total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/opd-billing - ERROR 500:`,
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

// GET /api/opd-billing/:id - Get Single OPD Bill
router.get("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/opd-billing/${
      req.params.id
    } - Request received`
  );
  try {
    const bill = await OpdBilling.findById(req.params.id).populate(
      "patientId",
      "patientName uhid mobileNo age ageUnit gender"
    );

    if (!bill) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/opd-billing/${
          req.params.id
        } - ERROR 404 - OPD Bill not found`
      );
      return res.status(404).json({
        success: false,
        message: "OPD Bill not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] GET /api/opd-billing/${
        req.params.id
      } - SUCCESS 200 - OPD Bill retrieved`
    );
    res.json({
      success: true,
      data: {
        id: bill._id,
        billId: bill.billId,
        patient: bill.patientId
          ? {
              id: bill.patientId._id,
              name: bill.patientId.patientName,
              uhid: bill.patientId.uhid,
              mobileNo: bill.patientId.mobileNo,
              age: bill.patientId.age,
              ageUnit: bill.patientId.ageUnit,
              gender: bill.patientId.gender,
            }
          : null,
        patientInfo: bill.patientInfo,
        patientCategory: bill.patientCategory,
        refby: bill.refby,
        consultantDoctor: bill.consultantDoctor,
        priority: bill.priority,
        paymentMode: bill.paymentMode,
        paidAmount: bill.paidAmount,
        services: bill.services,
        billing: bill.billing,
        status: bill.status,
        billDate: bill.billDate,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/opd-billing/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        billId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

function calculateBilling(data) {
  // 1. Gross Amount (sum of service amounts)
  const grossAmount = data.services.reduce(
    (sum, s) => sum + s.rate * s.quantity,
    0
  );

  // 2. Discount Calculation
  const discountAmount = data.billing.discountPercent
    ? (grossAmount * data.billing.discountPercent) / 100
    : data.billing.discountValue;

  // 3. Net Amount = Gross - Discount
  const netAmount = grossAmount - discountAmount;

  // 4. Grand Total (for now same as net, unless tax/charges are added later)
  const grandTotal = netAmount;

  // 5. Balance = GrandTotal - Paid
  const balanceAmount = grandTotal - data.billing.paidAmount;

  // ✅ Attach calculated values back into billing
  return {
    ...data,
    billing: {
      ...data.billing,
      grossAmount,
      netAmount,
      grandTotal,
      balanceAmount,
    },
  };
}

// POST /api/opd-billing - Create New OPD Bill
router.post("/", validate(createOpdBillingSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/opd-billing - Request received`
  );
  try {
    const billData = calculateBilling(req.body);

    // Validate patient exists
    if (billData.patientId) {
      const patient = await Patient.findById(billData.patientId);
      if (!patient) {
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

    // Validate services exist
    const serviceIds = billData.services.map((s) => s.serviceId);
    const existingServices = await Service.find({ _id: { $in: serviceIds } });

    if (existingServices.length !== serviceIds.length) {
      const foundServiceIds = existingServices.map((s) => s._id.toString());
      const missingServiceIds = serviceIds.filter(
        (id) => !foundServiceIds.includes(id)
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

    // Sync service details from DB
    for (const serviceData of billData.services) {
      const dbService = existingServices.find(
        (s) => s._id.toString() === serviceData.serviceId
      );
      if (dbService) {
        serviceData.serviceName = dbService.name;
        serviceData.serviceCode = dbService.code;
        serviceData.rate = dbService.rate;
        serviceData.amount = dbService.rate * serviceData.quantity;
        serviceData.category = dbService.category; // keep category for lab order logic
      }
    }

    // Save OPD Bill
    const opdBill = new OpdBilling(billData);
    await opdBill.save();

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
        patientId: opdBill.patientId,
        opdBillingId: opdBill._id,
        doctorName: billData.consultantDoctor,
        doctorSpecialization: billData.doctorSpecialization || "",
        orderDate: new Date(),
        status: ORDER_STATUS.PENDING,
        patientInfo: billData.patientInfo,
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
            enteredBy: opdBill.patientId, // Temporary - should be actual user
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
        `[OPD-BILLING] Created ${createdOrders.length} lab orders for bill ${opdBill.billId} (${pathologyServices.length} pathology, ${radiologyServices.length} radiology services)`
      );
    }

    await opdBill.populate("patientId", "patientName uhid mobileNo");

    res.status(201).json({
      success: true,
      message: "OPD Bill created successfully",
      data: opdBill,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/opd-billing - ERROR 500:`,
      error
    );
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/opd-billing/:id - Update OPD Bill
router.put("/:id", validate(updateOpdBillingSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] PUT /api/opd-billing/${
      req.params.id
    } - Request received`
  );
  try {
    // Check if bill exists
    const existingBill = await OpdBilling.findById(req.params.id);
    if (!existingBill) {
      console.warn(
        `[${new Date().toISOString()}] PUT /api/opd-billing/${
          req.params.id
        } - ERROR 404 - OPD Bill not found`
      );
      return res.status(404).json({
        success: false,
        message: "OPD Bill not found",
      });
    }

    const updateData = req.body;

    // If services are being updated, validate them
    if (updateData.services) {
      const serviceIds = updateData.services.map((s) => s.serviceId);
      const existingServices = await Service.find({ _id: { $in: serviceIds } });

      if (existingServices.length !== serviceIds.length) {
        const foundServiceIds = existingServices.map((s) => s._id.toString());
        const missingServiceIds = serviceIds.filter(
          (id) => !foundServiceIds.includes(id)
        );

        console.warn(
          `[${new Date().toISOString()}] PUT /api/opd-billing/${
            req.params.id
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
    }

    const opdBill = await OpdBilling.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(
      `[${new Date().toISOString()}] PUT /api/opd-billing/${
        req.params.id
      } - SUCCESS 200 - OPD Bill updated: ${opdBill.billId}`
    );
    res.json({
      success: true,
      message: "OPD Bill updated successfully",
      data: {
        id: opdBill._id,
        billId: opdBill.billId,
        patientInfo: opdBill.patientInfo,
        patientCategory: opdBill.patientCategory,
        refby: opdBill.refby,
        consultantDoctor: opdBill.consultantDoctor,
        priority: opdBill.priority,
        paymentMode: opdBill.paymentMode,
        paidAmount: opdBill.paidAmount,
        services: opdBill.services,
        billing: opdBill.billing,
        status: opdBill.status,
        billDate: opdBill.billDate,
        createdAt: opdBill.createdAt,
        updatedAt: opdBill.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] PUT /api/opd-billing/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        billId: req.params.id,
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

// DELETE /api/opd-billing/:id - Delete OPD Bill
router.delete("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE /api/opd-billing/${
      req.params.id
    } - Request received`
  );
  try {
    const opdBill = await OpdBilling.findByIdAndDelete(req.params.id);

    if (!opdBill) {
      console.warn(
        `[${new Date().toISOString()}] DELETE /api/opd-billing/${
          req.params.id
        } - ERROR 404 - OPD Bill not found`
      );
      return res.status(404).json({
        success: false,
        message: "OPD Bill not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] DELETE /api/opd-billing/${
        req.params.id
      } - SUCCESS 200 - OPD Bill deleted: ${opdBill.billId}`
    );
    res.json({
      success: true,
      message: "OPD Bill deleted successfully",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] DELETE /api/opd-billing/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        billId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
