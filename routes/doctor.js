const express = require("express");
const Doctor = require("../models/Doctor");
const { validate } = require("../middleware/validation");
const {
  paginate,
  buildSearchQuery,
  combineQueries,
} = require("../lib/pagination");

const router = express.Router();

// GET /api/doctors - List Doctors with Filters & Pagination
router.get("/", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/doctors - Request received`
  );
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      specialization, 
      department, 
      isActive, 
      isConsultant,
      all 
    } = req.query;

    // Build query filters
    const specializationQuery = specialization ? { specialization } : {};
    const departmentQuery = department ? { department } : {};
    const activeQuery = isActive !== undefined ? { isActive: isActive === "true" } : {};
    const consultantQuery = isConsultant !== undefined ? { isConsultant: isConsultant === "true" } : {};
    
    const searchQuery = buildSearchQuery(search, [
      "doctorName",
      "employeeId",
      "specialization",
      "department",
      "qualification",
      "email",
      "mobileNo",
    ]);

    // Combine all queries
    const finalQuery = combineQueries(
      specializationQuery,
      departmentQuery,
      activeQuery,
      consultantQuery,
      searchQuery
    );

    const result = await paginate(Doctor, {
      query: finalQuery,
      page,
      limit,
      all: all === "true",
      sort: { doctorName: 1 },
    });

    // Format data for response
    const formattedDoctors = result.data.map((doctor) => ({
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
    }));

    const logMessage =
      all === "true"
        ? `Retrieved all ${result.data.length} doctors`
        : `Retrieved ${result.data.length} doctors`;

    console.log(
      `[${new Date().toISOString()}] GET /api/doctors - SUCCESS 200 - ${logMessage}`
    );

    res.json({
      success: true,
      data: formattedDoctors,
      pagination: result.pagination,
      total: result.total,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/doctors - ERROR 500:`,
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

// GET /api/doctors/dropdown - Get Doctors for Dropdown
router.get("/dropdown", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/doctors/dropdown - Request received`
  );
  try {
    const { specialization, department, isConsultant } = req.query;

    // Build query for active doctors only
    let query = { isActive: true };
    
    if (specialization) query.specialization = specialization;
    if (department) query.department = department;
    if (isConsultant !== undefined) query.isConsultant = isConsultant === "true";

    const doctors = await Doctor.find(query)
      .select("doctorName employeeId specialization department qualification consultationFee")
      .sort({ doctorName: 1 });

    // Format for dropdown
    const dropdownData = doctors.map((doctor) => ({
      value: doctor._id,
      label: doctor.displayName,
      name: doctor.doctorName,
      employeeId: doctor.employeeId,
      specialization: doctor.specialization,
      department: doctor.department,
      consultationFee: doctor.consultationFee,
      nameWithSpecialization: doctor.nameWithSpecialization,
    }));

    console.log(
      `[${new Date().toISOString()}] GET /api/doctors/dropdown - SUCCESS 200 - Retrieved ${
        dropdownData.length
      } doctors for dropdown`
    );

    res.json({
      success: true,
      data: dropdownData,
      total: dropdownData.length,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/doctors/dropdown - ERROR 500:`,
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

// GET /api/doctors/specializations - Get Unique Specializations
router.get("/specializations", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/doctors/specializations - Request received`
  );
  try {
    const specializations = await Doctor.distinct("specialization", { isActive: true });
    
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

// POST /api/doctors - Create New Doctor
router.post("/", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/doctors - Request received`
  );
  try {
    const doctorData = req.body;

    // Check if email already exists (if provided)
    if (doctorData.email) {
      const existingEmailDoctor = await Doctor.findOne({
        email: doctorData.email,
      });
      if (existingEmailDoctor) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
          errors: [
            {
              field: "email",
              message: "A doctor with this email already exists",
            },
          ],
        });
      }
    }

    const doctor = new Doctor(doctorData);
    await doctor.save();

    console.log(
      `[${new Date().toISOString()}] POST /api/doctors - SUCCESS 201 - Doctor created: ${
        doctor.doctorName
      } (${doctor.employeeId})`
    );

    res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      data: {
        id: doctor._id,
        doctorName: doctor.doctorName,
        employeeId: doctor.employeeId,
        displayName: doctor.displayName,
        specialization: doctor.specialization,
        department: doctor.department,
        isActive: doctor.isActive,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/doctors - ERROR 500:`,
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

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        errors: [
          {
            field,
            message: `A doctor with this ${field} already exists`,
          },
        ],
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// PUT /api/doctors/:id - Update Doctor
router.put("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] PUT /api/doctors/${
      req.params.id
    } - Request received`
  );
  try {
    const doctorId = req.params.id;
    const updateData = req.body;

    // Check if email already exists for another doctor (if email is being updated)
    if (updateData.email) {
      const existingEmailDoctor = await Doctor.findOne({
        email: updateData.email,
        _id: { $ne: doctorId },
      });
      if (existingEmailDoctor) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
          errors: [
            {
              field: "email",
              message: "Another doctor with this email already exists",
            },
          ],
        });
      }
    }

    const doctor = await Doctor.findByIdAndUpdate(doctorId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!doctor) {
      console.warn(
        `[${new Date().toISOString()}] PUT /api/doctors/${doctorId} - ERROR 404 - Doctor not found`
      );
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] PUT /api/doctors/${doctorId} - SUCCESS 200 - Doctor updated: ${
        doctor.doctorName
      }`
    );

    res.json({
      success: true,
      message: "Doctor updated successfully",
      data: {
        id: doctor._id,
        doctorName: doctor.doctorName,
        employeeId: doctor.employeeId,
        displayName: doctor.displayName,
        specialization: doctor.specialization,
        department: doctor.department,
        isActive: doctor.isActive,
        updatedAt: doctor.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] PUT /api/doctors/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        doctorId: req.params.id,
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

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        errors: [
          {
            field,
            message: `Another doctor with this ${field} already exists`,
          },
        ],
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// DELETE /api/doctors/:id - Delete Doctor (Soft delete by setting isActive to false)
router.delete("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE /api/doctors/${
      req.params.id
    } - Request received`
  );
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!doctor) {
      console.warn(
        `[${new Date().toISOString()}] DELETE /api/doctors/${
          req.params.id
        } - ERROR 404 - Doctor not found`
      );
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] DELETE /api/doctors/${
        req.params.id
      } - SUCCESS 200 - Doctor deactivated: ${doctor.doctorName}`
    );

    res.json({
      success: true,
      message: "Doctor deactivated successfully",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] DELETE /api/doctors/${
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