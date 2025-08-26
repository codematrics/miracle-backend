const { default: z } = require("zod");
const Patient = require("../../models/Patient");
const Visit = require("../../models/Visit");
const { createVisitSchema } = require("../../validations/visitSchema");
const Service = require("../../models/Service");
const { VISIT_STATUS } = require("../../constants/enums");

function generateVisitID() {
  const now = new Date();
  const datePart =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const milliPart = String(now.getMilliseconds()).padStart(3, "0");
  return "VISIT" + datePart + milliPart;
}

const createVisitController = async (req, res) => {
  try {
    const validatedData = createVisitSchema.parse(req.body);

    // Check if patient exists
    const patient = await Patient.findById(validatedData.patientId);
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found", data: null, status: false });
    }

    const visit = new Visit({
      patientId: validatedData.patientId,
      consultingDoctorId: validatedData.consultingDoctorId,
      visitType: validatedData.visitType,
      referredBy: validatedData.referredBy,
      visitNote: validatedData.visitNote,
      medicoLegal: validatedData.medicoLegal || false,
      insuranceType: validatedData.insuranceType,
      policyNumber: validatedData.policyNumber,
      code: generateVisitID(),
    });

    await visit.save();

    return res.json({
      message: "Visit created successfully",
      data: visit,
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: error.errors[0].message, data: null, status: false });
    }
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listVisitController = async (req, res) => {
  try {
    const { status = "", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const query = {
      $and: [
        status && {
          status: status,
        },
      ].filter(Boolean),
    };

    const total = await Visit.countDocuments(query);
    const visits = await Visit.find(query)
      .populate("patientId consultingDoctorId")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return res.json({
      message: "Visit fetched successfully",
      data: { total, page: pageNum, limit: limitNum, visits },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const updateStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(VISIT_STATUS).includes(status)) {
      return res
        .status(404)
        .json({ message: "Invalid Status", data: null, status: false });
    }

    const visit = await Visit.findById(id);
    if (!visit) {
      return res
        .status(404)
        .json({ message: "visit not found", data: null, status: false });
    }

    const updatedVisit = await Visit.findByIdAndUpdate(id, { status });

    return res.json({
      message: "Visit updated successfully",
      data: updatedVisit,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

module.exports = {
  createVisitController,
  listVisitController,
  updateStatusController,
  generateVisitID,
};
