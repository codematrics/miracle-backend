const { default: z } = require("zod");
const { updateBedSchema } = require("../../validations/bed");
const {
  createAppointmentSchema,
  updateAppointmentSchema,
} = require("../../validations/appointment");
const Doctor = require("../../models/Doctor");
const Patient = require("../../models/Patient");
const Appointment = require("../../models/Appointment");
const { ROLES } = require("../../constants/enums");

const createAppointmentController = async (req, res) => {
  try {
    const validatedData = createAppointmentSchema.parse(req.body);

    const doctor = await Doctor.findOne({
      _id: validatedData.doctor,
    });

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor Not Found",
        data: null,
        status: false,
      });
    }

    const patient = await Patient.findOne({
      _id: validatedData.patient,
    });

    if (!patient) {
      return res.status(404).json({
        message: "Patient Not Found",
        data: null,
        status: false,
      });
    }

    const existing = await Appointment.findOne({
      patient: validatedData.patient,
      status: "scheduled",
      doctor: validatedData.doctor,
      appointmentDate: validatedData.appointmentDate,
    });

    if (existing) {
      return res.status(400).json({
        message: "Appointment with this patient already exists",
        data: null,
        status: false,
      });
    }
    const appointment = new Appointment({
      ...validatedData,
      appointmentNumber: `APPT-${Date.now()}`,
    });
    await appointment.save();

    return res.json({
      message: "Appointment created successfully",
      data: appointment,
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

const listAppointmentsController = async (req, res) => {
  try {
    const { user, doctor } = req;
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    console.log(doctor, user);
    const query = {
      $and: [
        status && {
          status: status,
        },
        user.role === ROLES.DOCTOR && {
          doctor: doctor._id,
        },
      ].filter(Boolean),
    };

    console.log(await Appointment.find({ doctor: doctor._id }));
    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate("patient doctor")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "Appointments fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        appointments,
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

const updateAppointmentController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateAppointmentSchema.parse(req.body);

    // Check for existing bed
    const existing = await Appointment.findOne({
      _id: id,
    });

    if (!existing) {
      return res.status(400).json({
        message: "Appointment with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const bed = await Appointment.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Appointment updated successfully",
      data: bed,
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

module.exports = {
  listAppointmentsController,
  createAppointmentController,
  updateAppointmentController,
};
