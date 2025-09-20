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
const {
  createPatientController,
  getPatientDropdownController,
} = require("../controllers/patient/patient");

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

// router.get(
//   "/dropdown-data",
//   validate(patientQuerySchema, "query"),
//   async (req, res) => {
//     console.log(
//       `[${new Date().toISOString()}] GET /api/patients/dropdown-data - Request received`
//     );
//     try {
//       const patients = await Patient.find()
//         .select(
//           "_id patientName fatherOrHusbandName uhid mobileNo age ageUnit gender patientType"
//         ) // only needed fields
//         .lean();

//       const patientList = patients.map((p) => ({
//         id: p._id.toString(),
//         label: p.patientName,
//         fathername: p.fatherOrHusbandName,
//         uhid: p.uhid,
//         UHID: p.uhid,
//         mobileno: p.mobileNo,
//         age: p.age,
//         patientType: p.patientType,
//         gender:
//           p.gender === "Male" ? "M" : p.gender === "Female" ? "F" : p.gender,
//       }));

//       res.json({
//         success: true,
//         data: patientList,
//       });
//     } catch (error) {
//       console.error(
//         `[${new Date().toISOString()}] GET /api/patients - ERROR 500:`,
//         {
//           message: error.message,
//           stack: error.stack,
//         }
//       );
//       res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   }
// );

router.get("/dropdown-list", getPatientDropdownController);

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

// router.post("/", validate(createPatientSchema), async (req, res) => {
//   console.log(
//     `[${new Date().toISOString()}] POST /api/patients - Request received`
//   );
//   try {
//     const existingPatient = await Patient.findOne({
//       $or: [{ mobileNo: req.body.mobileNo }, { idNo: req.body.idNo }],
//     });

//     if (existingPatient) {
//       console.warn(
//         `[${new Date().toISOString()}] POST /api/patients - ERROR 400 - Patient already exists with mobile/ID`
//       );
//       return res.status(400).json({
//         success: false,
//         message: "Patient with this mobile number or ID already exists",
//       });
//     }

//     const patient = new Patient(req.body);
//     await patient.save();

//     console.log(
//       `[${new Date().toISOString()}] POST /api/patients - SUCCESS 201 - Patient created: ${
//         patient.patientName
//       }`
//     );
//     res.status(201).json({
//       success: true,
//       message: "Patient created successfully",
//       data: patient,
//     });
//   } catch (error) {
//     console.error(
//       `[${new Date().toISOString()}] POST /api/patients - ERROR 500:`,
//       {
//         message: error.message,
//         stack: error.stack,
//         requestBody: req.body,
//       }
//     );
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });

router.post("/", createPatientController);

// GET /api/patients/:uhid/details - Get Patient Details with Visit History
router.get("/:uhid/details", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/patients/${
      req.params.uhid
    }/details - Request received`
  );
  try {
    const { uhid } = req.params;

    // Find patient by UHID
    const patient = await Patient.findOne({ uhidNo: uhid }).lean();
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
          localField: "consultingDoctorId",
          foreignField: "_id",
          as: "doctorDetails",
        },
      },
      {
        $project: {
          code: 1,
          visitDate: 1,
          visitType: 1,
          referredBy: 1,
          status: 1,
          createdAt: 1,
          doctorInfo: { $arrayElemAt: ["$doctorDetails", 0] },
        },
      },
    ]);

    // Get most recent visit details
    const recentVisit = visits[0] || null;
    const previousVisits = visits.slice(1); // All visits except the most recent

    // Format patient address
    const addressParts = [];
    if (patient.address) {
      if (patient.address.street) addressParts.push(patient.address.street);
      if (patient.address.city) addressParts.push(patient.address.city);
      if (patient.address.district) addressParts.push(patient.address.district);
      if (patient.address.state) addressParts.push(patient.address.state);
    }
    const address = addressParts.join(", ") || "Not provided";

    // Format patient name with relation
    const patientName = `${patient.name} ${patient.relation} ${
      patient.relativeName || ""
    }`.trim();

    // Format age and gender
    const ageGender = `${patient.age || "N/A"} Year / ${
      patient.gender?.charAt(0)?.toUpperCase() || "N/A"
    }`;

    // Prepare response
    const patientDetails = {
      uhid: patient.uhidNo,
      patientName: patientName,
      mobileNo: patient.mobileNumber || "Not provided",
      ageGender: ageGender,
      address: address,
      recentVisit: recentVisit
        ? {
            visitNo: recentVisit.code,
            visitDate: recentVisit.visitDate,
            visitType: recentVisit.visitType,
            doctorName: recentVisit.doctorInfo?.name || "Not assigned",
            doctorQualification:
              recentVisit.doctorInfo?.qualification || "Not provided",
            referredBy: recentVisit.referredBy || "Direct",
            status: recentVisit.status,
          }
        : null,
      previousVisits: previousVisits.map((visit, index) => ({
        serialNo: index + 1,
        visitNo: visit.code,
        visitDate: visit.visitDate,
        visitType: visit.visitType,
        doctorName: visit.doctorInfo?.name || "Not assigned",
        referredBy: visit.referredBy || "Direct",
        status: visit.status,
      })),
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
      `[${new Date().toISOString()}] GET /api/patients/${
        req.params.uhid
      }/details - ERROR 500:`,
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
