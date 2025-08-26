const Patient = require("../../models/Patient");
const { default: z } = require("zod");
const { createPatientSchema } = require("../../validations/patientSchema");

function generateUHID() {
  const now = new Date();
  // Format: YYYYMMDDHHMMSS + milliseconds
  const datePart =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const milliPart = String(now.getMilliseconds()).padStart(3, "0");
  return "UHID" + datePart + milliPart;
}

const createPatientController = async (req, res) => {
  try {
    const validatedData = createPatientSchema.parse(req.body);

    // Generate unique UHID
    let uhid;
    let exists = true;
    while (exists) {
      uhid = generateUHID();
      exists = await Patient.findOne({ uhidNo: uhid });
    }
    validatedData.uhidNo = uhid;

    const patient = new Patient(validatedData);
    await patient.save();

    return res.json({
      message: "Patient created successfully",
      data: patient,
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: error.issues[0]?.message, data: null, status: false });
    }
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getPatientDropdownController = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [
        { name: searchRegex },
        { relativeName: searchRegex },
        { mobileNumber: searchRegex },
        { uhidNo: searchRegex },
      ],
    };

    const total = await Patient.countDocuments(query);
    const patients = await Patient.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    console.log(total, patients);

    // Map to dropdown format
    const data = patients.map((p) => ({
      value: p._id,
      label: `${p.name} | ${p.relativeName || "-"} | ${
        p.mobileNumber || "-"
      } | ${p.uhidNo || "-"} | ${p.age}yrs | ${p.gender}`,
      name: p.name,
      uhidNo: p.uhidNo,
      mobileNumber: p.mobileNumber,
      age: p.age,
      gender: p.gender,
      patientType: p.patientType,
      relation: p.relation,
      relativeName: p.relativeName,
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

module.exports = { createPatientController, getPatientDropdownController };
