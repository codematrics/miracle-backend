const { default: z } = require("zod");
const Doctor = require("../../models/Doctor");
const {
  createDoctorSchema,
  updateDoctorSchema,
} = require("../../validations/doctorSchema");

const createDoctorController = async (req, res) => {
  try {
    const validatedData = createDoctorSchema.parse(req.body);

    // Check for existing licenseNumber
    const existing = await Doctor.findOne({
      licenseNumber: validatedData.licenseNumber,
    });
    if (existing) {
      return res.status(400).json({
        message: "Doctor with this license number already exists",
        data: null,
        status: false,
      });
    }

    const doctor = new Doctor(validatedData);
    await doctor.save();

    return res.json({
      message: "Doctor created successfully",
      data: doctor,
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(error);
      return res
        .status(400)
        .json({ message: error.issues[0]?.message, data: null, status: false });
    }

    console.error(error);
    return res.status(500).json({
      message: error.message || "Server error",
      data: null,
      status: false,
    });
  }
};

const listDoctorsController = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      department = "",
      specialization = "",
      status = "",
      order = "desc",
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const sortOrder = order === "asc" ? 1 : -1;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [
        { name: searchRegex },
        { mobileNo: searchRegex },
        { email: searchRegex },
      ],
      $and: [
        department && { department: department },
        specialization && { specialization: specialization },
        status && {
          status: status,
        },
      ].filter(Boolean),
    };

    const total = await Doctor.countDocuments(query);
    const doctors = await Doctor.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "Doctors fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        doctors,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const updateDoctorController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateDoctorSchema.parse(req.body);

    // Check for existing licenseNumber
    const existing = await Doctor.findOne({
      _id: id,
    });
    if (!existing) {
      return res.status(400).json({
        message: "Doctor with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const doctor = await Doctor.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Doctor updated successfully",
      data: doctor,
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(error);
      return res
        .status(400)
        .json({ message: error.issues[0]?.message, data: null, status: false });
    }

    console.error(error);
    return res.status(500).json({
      message: error.message || "Server error",
      data: null,
      status: false,
    });
  }
};

const deleteDoctorController = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing licenseNumber
    const existing = await Doctor.findByIdAndDelete(id);
    if (!existing) {
      return res.status(400).json({
        message: "Doctor with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "Doctor deleted successfully",
      data: null,
      status: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server error",
      data: null,
      status: false,
    });
  }
};

const getDoctorDropdownController = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ name: searchRegex }],
    };

    const total = await Doctor.countDocuments(query);
    const doctors = await Doctor.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Map to dropdown format
    const data = doctors.map((d) => ({
      value: d._id,
      label: `${d.name} | ${d.department || "-"} | ${
        d.specialization || "-"
      } | ${d.mobileNo || "-"}`,
    }));

    return res.json({
      data,
      hasMore: pageNum * limitNum < total,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

module.exports = {
  createDoctorController,
  listDoctorsController,
  updateDoctorController,
  deleteDoctorController,
  getDoctorDropdownController,
};
