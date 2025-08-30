const express = require("express");
const Doctor = require("../models/Doctor");
const { validate } = require("../middleware/validation");
const {
  paginate,
  buildSearchQuery,
  combineQueries,
} = require("../lib/pagination");
const {
  createDoctorController,
  listDoctorsController,
  updateDoctorController,
  deleteDoctorController,
  getDoctorDropdownController,
} = require("../controllers/doctor/doctor");

const router = express.Router();

router.get("/", listDoctorsController);
router.post("/", createDoctorController);
router.get("/dropdown-list", getDoctorDropdownController);
router.put("/:id", updateDoctorController);
router.delete("/:id", deleteDoctorController);

// GET /api/doctors/specializations - Get Unique Specializations
router.get("/specializations", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/doctors/specializations - Request received`
  );
  try {
    const specializations = await Doctor.distinct("specialization", {
      isActive: true,
    });

    const dropdownData = specializations.map((spec) => ({
      value: spec,
      label: spec,
    }));

    console.log(
      `[${new Date().toISOString()}] GET /api/doctors/specializations - SUCCESS 200 - Retrieved ${
        dropdownData.length
      } specializations`
    );

    res.json({
      success: true,
      data: dropdownData,
      total: dropdownData.length,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/doctors/specializations - ERROR 500:`,
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

// GET /api/doctors/departments - Get Unique Departments
router.get("/departments", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/doctors/departments - Request received`
  );
  try {
    const departments = await Doctor.distinct("department", { isActive: true });

    const dropdownData = departments.map((dept) => ({
      value: dept,
      label: dept,
    }));

    console.log(
      `[${new Date().toISOString()}] GET /api/doctors/departments - SUCCESS 200 - Retrieved ${
        dropdownData.length
      } departments`
    );

    res.json({
      success: true,
      data: dropdownData,
      total: dropdownData.length,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/doctors/departments - ERROR 500:`,
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

// GET /api/doctors/:id - Get Single Doctor
router.get("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/doctors/${
      req.params.id
    } - Request received`
  );
  try {
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/doctors/${
          req.params.id
        } - ERROR 404 - Doctor not found`
      );
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] GET /api/doctors/${
        req.params.id
      } - SUCCESS 200 - Doctor retrieved`
    );

    res.json({
      success: true,
      data: {
        id: doctor._id,
        doctorName: doctor.doctorName,
        employeeId: doctor.employeeId,
        displayName: doctor.displayName,
        nameWithSpecialization: doctor.nameWithSpecialization,
        specialization: doctor.specialization,
        qualification: doctor.qualification,
        email: doctor.email,
        mobileNo: doctor.mobileNo,
        department: doctor.department,
        designation: doctor.designation,
        consultationFee: doctor.consultationFee,
        emergencyContactNo: doctor.emergencyContactNo,
        address: doctor.address,
        joiningDate: doctor.joiningDate,
        isActive: doctor.isActive,
        isConsultant: doctor.isConsultant,
        availableDays: doctor.availableDays,
        consultationTimings: doctor.consultationTimings,
        notes: doctor.notes,
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/doctors/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        doctorId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
