const { default: z } = require("zod");
const Patient = require("../../models/Patient");
const Visit = require("../../models/Visit");
const { createVisitSchema } = require("../../validations/visitSchema");

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
module.exports = { createVisitController };
