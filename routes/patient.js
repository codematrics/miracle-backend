const express = require("express");
const Patient = require("../models/Patient");
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

module.exports = router;
