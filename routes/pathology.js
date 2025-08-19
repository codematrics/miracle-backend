const express = require("express");
const Pathology = require("../models/Pathology");
const Patient = require("../models/Patient");
const OpdBilling = require("../models/OpdBilling");
const { validate } = require("../middleware/validation");
const {
  createPathologySchema,
  updatePathologySchema,
  pathologyQuerySchema,
  bulkCreatePathologySchema,
  updateStatusSchema,
} = require("../validations/pathologySchema");
const { paginate, buildSearchQuery, buildDateRangeQuery, combineQueries } = require("../lib/pagination");

const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Pathology routes are working!" });
});

// GET /api/pathology - List Pathology Entries with Filters & Pagination
router.get("/", validate(pathologyQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/pathology - Request received`
  );
  try {
    const { 
      page, limit, search, status, priority, reportName, patientId, 
      uhid, visitNo, from, to, consultantDoctor, referringDoctor, all 
    } = req.query;

    // Build individual query parts
    const statusQuery = status ? { status } : {};
    const priorityQuery = priority ? { priority } : {};
    const reportNameQuery = reportName ? { reportName: { $regex: reportName, $options: "i" } } : {};
    const patientQuery = patientId ? { patientId } : {};
    const uhidQuery = uhid ? { uhid } : {};
    const visitNoQuery = visitNo ? { visitNo } : {};
    const consultantQuery = consultantDoctor ? { consultantDoctor: { $regex: consultantDoctor, $options: "i" } } : {};
    const referringQuery = referringDoctor ? { referringDoctor: { $regex: referringDoctor, $options: "i" } } : {};
    const dateQuery = buildDateRangeQuery('orderDate', from, to);
    const searchQuery = buildSearchQuery(search, [
      'accession',
      'patientName',
      'uhid',
      'visitNo',
      'reportName',
      'serviceName',
      'consultantDoctor',
      'referringDoctor',
      'technicianName',
      'pathologistName'
    ]);

    // Combine all queries
    const finalQuery = combineQueries(
      statusQuery, priorityQuery, reportNameQuery, patientQuery, uhidQuery,
      visitNoQuery, consultantQuery, referringQuery, dateQuery, searchQuery
    );

    const result = await paginate(Pathology, {
      query: finalQuery,
      page,
      limit,
      all: all === 'true',
      populate: {
        path: "patientId",
        select: "patientName uhid mobileNo age ageUnit gender"
      }
    });

    // Format data for response
    const formattedEntries = result.data.map((entry) => ({
      id: entry._id,
      accession: entry.accession,
      orderDate: entry.orderDate,
      reportName: entry.reportName,
      serviceName: entry.serviceName,
      consultantDoctor: entry.consultantDoctor,
      referringDoctor: entry.referringDoctor,
      uhid: entry.uhid,
      patientName: entry.patientName,
      age: entry.age,
      ageUnit: entry.ageUnit,
      ageDisplay: entry.ageDisplay,
      sex: entry.sex,
      visitNo: entry.visitNo,
      status: entry.status,
      priority: entry.priority,
      sampleCollectionDate: entry.sampleCollectionDate,
      reportDate: entry.reportDate,
      technicianName: entry.technicianName,
      pathologistName: entry.pathologistName,
      totalAmount: entry.totalAmount,
      paidAmount: entry.paidAmount,
      balanceAmount: entry.balanceAmount,
      remarks: entry.remarks,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      patient: entry.patientId ? {
        id: entry.patientId._id,
        name: entry.patientId.patientName,
        uhid: entry.patientId.uhid,
        mobileNo: entry.patientId.mobileNo
      } : null
    }));

    const logMessage = all === 'true' 
      ? `Retrieved all ${result.data.length} pathology entries`
      : `Retrieved ${result.data.length} pathology entries`;

    console.log(
      `[${new Date().toISOString()}] GET /api/pathology - SUCCESS 200 - ${logMessage}`
    );

    res.json({
      success: true,
      data: formattedEntries,
      pagination: result.pagination,
      total: result.total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/pathology - ERROR 500:`,
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

// GET /api/pathology/:id - Get Single Pathology Entry
router.get("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/pathology/${
      req.params.id
    } - Request received`
  );
  try {
    const entry = await Pathology.findById(req.params.id).populate([
      {
        path: "patientId",
        select: "patientName uhid mobileNo age ageUnit gender address"
      },
      {
        path: "billId",
        select: "billId billing.grandTotal billing.paidAmount status"
      }
    ]);

    if (!entry) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/pathology/${
          req.params.id
        } - ERROR 404 - Pathology entry not found`
      );
      return res.status(404).json({
        success: false,
        message: "Pathology entry not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] GET /api/pathology/${
        req.params.id
      } - SUCCESS 200 - Pathology entry retrieved`
    );
    res.json({
      success: true,
      data: {
        id: entry._id,
        accession: entry.accession,
        orderDate: entry.orderDate,
        reportName: entry.reportName,
        serviceName: entry.serviceName,
        consultantDoctor: entry.consultantDoctor,
        referringDoctor: entry.referringDoctor,
        doctorDisplay: entry.doctorDisplay,
        uhid: entry.uhid,
        patientName: entry.patientName,
        patientDisplay: entry.patientDisplay,
        age: entry.age,
        ageUnit: entry.ageUnit,
        ageDisplay: entry.ageDisplay,
        sex: entry.sex,
        visitNo: entry.visitNo,
        status: entry.status,
        priority: entry.priority,
        sampleCollectionDate: entry.sampleCollectionDate,
        reportDate: entry.reportDate,
        technicianName: entry.technicianName,
        pathologistName: entry.pathologistName,
        reportData: entry.reportData,
        totalAmount: entry.totalAmount,
        paidAmount: entry.paidAmount,
        balanceAmount: entry.balanceAmount,
        remarks: entry.remarks,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        patient: entry.patientId,
        bill: entry.billId
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/pathology/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        entryId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/pathology - Create New Pathology Entry
router.post("/", validate(createPathologySchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/pathology - Request received`
  );
  try {
    const entryData = req.body;

    // Validate patient exists if patientId provided
    if (entryData.patientId) {
      const patient = await Patient.findById(entryData.patientId);
      if (!patient) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/pathology - ERROR 404 - Patient not found: ${
            entryData.patientId
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

    // Validate bill exists if billId provided
    if (entryData.billId) {
      const bill = await OpdBilling.findById(entryData.billId);
      if (!bill) {
        console.warn(
          `[${new Date().toISOString()}] POST /api/pathology - ERROR 404 - Bill not found: ${
            entryData.billId
          }`
        );
        return res.status(404).json({
          success: false,
          message: "OPD Bill not found",
          errors: [
            {
              field: "billId",
              message: "Bill with this ID does not exist",
            },
          ],
        });
      }
    }

    const pathologyEntry = new Pathology(entryData);
    await pathologyEntry.save();

    console.log(
      `[${new Date().toISOString()}] POST /api/pathology - SUCCESS 201 - Pathology entry created: ${
        pathologyEntry.accession
      }`
    );
    res.status(201).json({
      success: true,
      message: "Pathology entry created successfully",
      data: {
        id: pathologyEntry._id,
        accession: pathologyEntry.accession,
        orderDate: pathologyEntry.orderDate,
        reportName: pathologyEntry.reportName,
        serviceName: pathologyEntry.serviceName,
        consultantDoctor: pathologyEntry.consultantDoctor,
        referringDoctor: pathologyEntry.referringDoctor,
        uhid: pathologyEntry.uhid,
        patientName: pathologyEntry.patientName,
        ageDisplay: pathologyEntry.ageDisplay,
        sex: pathologyEntry.sex,
        visitNo: pathologyEntry.visitNo,
        status: pathologyEntry.status,
        priority: pathologyEntry.priority,
        totalAmount: pathologyEntry.totalAmount,
        createdAt: pathologyEntry.createdAt,
        updatedAt: pathologyEntry.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/pathology - ERROR 500:`,
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

    // Handle duplicate accession error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.accession) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [{
          field: "accession",
          message: "Accession number already exists"
        }]
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/pathology/bulk - Create Multiple Pathology Entries
router.post("/bulk", validate(bulkCreatePathologySchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/pathology/bulk - Request received`
  );
  try {
    const { entries } = req.body;
    
    const createdEntries = [];
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      try {
        const pathologyEntry = new Pathology(entries[i]);
        await pathologyEntry.save();
        createdEntries.push({
          index: i,
          data: {
            id: pathologyEntry._id,
            accession: pathologyEntry.accession,
            patientName: pathologyEntry.patientName,
            uhid: pathologyEntry.uhid
          }
        });
      } catch (error) {
        errors.push({
          index: i,
          entry: entries[i],
          error: error.message
        });
      }
    }

    console.log(
      `[${new Date().toISOString()}] POST /api/pathology/bulk - SUCCESS 201 - Created ${createdEntries.length}/${entries.length} entries`
    );

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdEntries.length} out of ${entries.length} pathology entries`,
      data: {
        created: createdEntries,
        errors: errors,
        summary: {
          total: entries.length,
          success: createdEntries.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/pathology/bulk - ERROR 500:`,
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

// PUT /api/pathology/:id - Update Pathology Entry
router.put("/:id", validate(updatePathologySchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] PUT /api/pathology/${
      req.params.id
    } - Request received`
  );
  try {
    const existingEntry = await Pathology.findById(req.params.id);
    if (!existingEntry) {
      console.warn(
        `[${new Date().toISOString()}] PUT /api/pathology/${
          req.params.id
        } - ERROR 404 - Pathology entry not found`
      );
      return res.status(404).json({
        success: false,
        message: "Pathology entry not found",
      });
    }

    const pathologyEntry = await Pathology.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    console.log(
      `[${new Date().toISOString()}] PUT /api/pathology/${
        req.params.id
      } - SUCCESS 200 - Pathology entry updated: ${pathologyEntry.accession}`
    );
    res.json({
      success: true,
      message: "Pathology entry updated successfully",
      data: {
        id: pathologyEntry._id,
        accession: pathologyEntry.accession,
        orderDate: pathologyEntry.orderDate,
        reportName: pathologyEntry.reportName,
        serviceName: pathologyEntry.serviceName,
        consultantDoctor: pathologyEntry.consultantDoctor,
        referringDoctor: pathologyEntry.referringDoctor,
        uhid: pathologyEntry.uhid,
        patientName: pathologyEntry.patientName,
        ageDisplay: pathologyEntry.ageDisplay,
        sex: pathologyEntry.sex,
        visitNo: pathologyEntry.visitNo,
        status: pathologyEntry.status,
        priority: pathologyEntry.priority,
        sampleCollectionDate: pathologyEntry.sampleCollectionDate,
        reportDate: pathologyEntry.reportDate,
        technicianName: pathologyEntry.technicianName,
        pathologistName: pathologyEntry.pathologistName,
        totalAmount: pathologyEntry.totalAmount,
        paidAmount: pathologyEntry.paidAmount,
        balanceAmount: pathologyEntry.balanceAmount,
        remarks: pathologyEntry.remarks,
        createdAt: pathologyEntry.createdAt,
        updatedAt: pathologyEntry.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] PUT /api/pathology/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        entryId: req.params.id,
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

// PATCH /api/pathology/status - Update Status for Multiple Entries
router.patch("/status", validate(updateStatusSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] PATCH /api/pathology/status - Request received`
  );
  try {
    const { ids, status, technicianName, pathologistName, sampleCollectionDate, reportDate, remarks } = req.body;

    const updateData = { status };
    if (technicianName) updateData.technicianName = technicianName;
    if (pathologistName) updateData.pathologistName = pathologistName;
    if (sampleCollectionDate) updateData.sampleCollectionDate = new Date(sampleCollectionDate);
    if (reportDate) updateData.reportDate = new Date(reportDate);
    if (remarks) updateData.remarks = remarks;

    const result = await Pathology.updateMany(
      { _id: { $in: ids } },
      updateData
    );

    console.log(
      `[${new Date().toISOString()}] PATCH /api/pathology/status - SUCCESS 200 - Updated ${result.modifiedCount} entries`
    );

    res.json({
      success: true,
      message: `Successfully updated status for ${result.modifiedCount} pathology entries`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        updatedStatus: status
      }
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] PATCH /api/pathology/status - ERROR 500:`,
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

// DELETE /api/pathology/:id - Delete Pathology Entry
router.delete("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE /api/pathology/${
      req.params.id
    } - Request received`
  );
  try {
    const pathologyEntry = await Pathology.findByIdAndDelete(req.params.id);

    if (!pathologyEntry) {
      console.warn(
        `[${new Date().toISOString()}] DELETE /api/pathology/${
          req.params.id
        } - ERROR 404 - Pathology entry not found`
      );
      return res.status(404).json({
        success: false,
        message: "Pathology entry not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] DELETE /api/pathology/${
        req.params.id
      } - SUCCESS 200 - Pathology entry deleted: ${pathologyEntry.accession}`
    );
    res.json({
      success: true,
      message: "Pathology entry deleted successfully",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] DELETE /api/pathology/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        entryId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;