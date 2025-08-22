const express = require("express");
const Patient = require("../models/Patient");
const Visit = require("../models/Visit");
const Doctor = require("../models/Doctor");
const { validate } = require("../middleware/validation");
const {
  createPatientSchema,
  patientQuerySchema,
} = require("../validations/patientSchema");
const { paginate, buildSearchQuery } = require("../lib/pagination");

const router = express.Router();

router.get("/", validate(patientQuerySchema, "query"), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/patients - Request received`
  );
  try {
    const { page, limit, search } = req.query;

    const searchQuery = buildSearchQuery(search, [
      "patientName",
      "mobileNo",
      "idNo",
    ]);

    const result = await paginate(Patient, {
      query: searchQuery,
      page,
      limit,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/patients - SUCCESS 200 - Retrieved ${
        result.data.length
      } patients`
    );
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      total: result.total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/patients - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get(
  "/dropdown-data",
  validate(patientQuerySchema, "query"),
  async (req, res) => {
    console.log(
      `[${new Date().toISOString()}] GET /api/patients/dropdown-data - Request received`
    );
    try {
      const patients = await Patient.find()
        .select(
          "_id patientName fatherOrHusbandName uhid mobileNo age ageUnit gender patientType"
        ) // only needed fields
        .lean();

      const patientList = patients.map((p) => ({
        id: p._id.toString(),
        label: p.patientName,
        fathername: p.fatherOrHusbandName,
        uhid: p.uhid,
        UHID: p.uhid,
        mobileno: p.mobileNo,
        age: p.age,
        patientType: p.patientType,
        gender:
          p.gender === "Male" ? "M" : p.gender === "Female" ? "F" : p.gender,
      }));

      res.json({
        success: true,
        data: patientList,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] GET /api/patients - ERROR 500:`,
        {
          message: error.message,
          stack: error.stack,
        }
      );
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.get("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/patients/${
      req.params.id
    } - Request received`
  );
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/patients/${
          req.params.id
        } - ERROR 404 - Patient not found`
      );
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] GET /api/patients/${
        req.params.id
      } - SUCCESS 200 - Patient retrieved`
    );
    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/patients/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        patientId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post("/", validate(createPatientSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/patients - Request received`
  );
  try {
    const existingPatient = await Patient.findOne({
      $or: [{ mobileNo: req.body.mobileNo }, { idNo: req.body.idNo }],
    });

    if (existingPatient) {
      console.warn(
        `[${new Date().toISOString()}] POST /api/patients - ERROR 400 - Patient already exists with mobile/ID`
      );
      return res.status(400).json({
        success: false,
        message: "Patient with this mobile number or ID already exists",
      });
    }

    const patient = new Patient(req.body);
    await patient.save();

    console.log(
      `[${new Date().toISOString()}] POST /api/patients - SUCCESS 201 - Patient created: ${
        patient.patientName
      }`
    );
    res.status(201).json({
      success: true,
      message: "Patient created successfully",
      data: patient,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/patients - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        requestBody: req.body,
      }
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// GET /api/patients/:uhid/details - Get Comprehensive Patient Details
router.get("/:uhid/details", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/patients/${req.params.uhid}/details - Request received`
  );
  try {
    const { uhid } = req.params;

    // Find patient by UHID
    const patient = await Patient.findOne({ uhid }).lean();
    if (!patient) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/patients/${uhid}/details - ERROR 404 - Patient not found`
      );
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Get all visits for this patient with doctor details
    const visits = await Visit.aggregate([
      { $match: { patientId: patient._id } },
      { $sort: { visitDate: -1 } }, // Most recent first
      {
        $lookup: {
          from: "doctors",
          let: { doctorName: "$visitingdoctor" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$doctorName", "$$doctorName"]
                }
              }
            }
          ],
          as: "doctorDetails"
        }
      },
      {
        $project: {
          visitId: 1,
          visitDate: 1,
          visitingdoctor: 1,
          visittype: 1,
          refby: 1,
          chiefComplaint: 1,
          vitals: 1,
          diagnosis: 1,
          pastHistory: 1,
          allergies: 1,
          investigation: 1,
          advice: 1,
          medications: 1,
          services: 1,
          totalAmount: 1,
          status: 1,
          createdAt: 1,
          doctorInfo: { $arrayElemAt: ["$doctorDetails", 0] }
        }
      }
    ]);

    // Get most recent visit details
    const recentVisit = visits[0] || null;
    const previousVisits = visits.slice(1); // All visits except the most recent

    // Format patient address
    const address = patient.address ? 
      `${patient.address.village}, ${patient.address.district}, ${patient.address.state}`.replace(/,\s*,/g, ',').replace(/^,|,$/g, '') 
      : '';

    // Format patient name with relation
    const patientName = `${patient.patientName} ${patient.relation} ${patient.fatherOrHusbandName}`;

    // Format age and gender
    const ageGender = `${patient.age} ${patient.ageUnit} / ${patient.gender.charAt(0).toUpperCase()}`;

    // Prepare response
    const patientDetails = {
      uhid: patient.uhid,
      patientName: patientName,
      mobileNo: patient.mobileNo,
      ageGender: ageGender,
      address: address,
      recentVisit: recentVisit ? {
        visitNo: recentVisit.visitId,
        visitDate: recentVisit.visitDate,
        doctorName: recentVisit.visitingdoctor,
        licenseNo: recentVisit.doctorInfo?.licenseNo || 'N/A',
        specialization: recentVisit.doctorInfo?.qualification || 'N/A',
        department: recentVisit.doctorInfo?.department || 'General Medicine',
        chiefComplaint: recentVisit.chiefComplaint || 'N/A',
        vitals: recentVisit.vitals || {},
        diagnosis: recentVisit.diagnosis || {},
        pastHistory: recentVisit.pastHistory || 'N/A',
        allergies: recentVisit.allergies || 'None',
        investigation: recentVisit.investigation || 'N/A',
        advice: recentVisit.advice || 'N/A',
        medications: recentVisit.medications || []
      } : null,
      previousVisits: previousVisits.map((visit, index) => ({
        serialNo: index + 1,
        visitNo: visit.visitId,
        visitDate: visit.visitDate,
        doctorName: visit.visitingdoctor,
        advice: visit.advice || 'N/A'
      }))
    };

    console.log(
      `[${new Date().toISOString()}] GET /api/patients/${uhid}/details - SUCCESS 200 - Patient details retrieved`
    );

    res.json({
      success: true,
      data: patientDetails,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/patients/${req.params.uhid}/details - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        uhid: req.params.uhid,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
