const { default: z } = require("zod");
const {
  VISIT_TYPE,
  SERVICE_APPLICABLE,
  SERVICE_CATEGORY,
} = require("../../constants/enums");
const Doctor = require("../../models/Doctor");
const LabOrder = require("../../models/LabOrder");
const OpdBilling = require("../../models/OpdBilling");
const Patient = require("../../models/Patient");
const Service = require("../../models/Service");
const Visit = require("../../models/Visit");
const {
  createOpdBillingSchema,
} = require("../../validations/opdBillingSchema");
const LabOrderTest = require("../../models/LabOrderTest");
const { generateVisitID } = require("../visit/visit");

const listOPDController = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const query = {};

    const total = await OpdBilling.countDocuments(query);
    const opd = await OpdBilling.find(query)
      .populate("patient visit consultantDoctor services")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "OPD fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        opd,
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
const createOPDBill = async (req, res) => {
  try {
    const validatedData = createOpdBillingSchema.parse(req.body);

    const patient = await Patient.findById(validatedData.patient);

    if (!patient) {
      return res.status(404).json({
        message: "Patient Not Found",
        data: null,
        status: false,
      });
    }
    const doctor = await Doctor.findById(validatedData.consultantDoctor);

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor Not Found",
        data: null,
        status: false,
      });
    }

    const visitData = {
      patientId: patient._id,
      consultingDoctorId: doctor._id,
      referredBy: validatedData.referredBy,
      visitType: VISIT_TYPE.OPD,
    };

    const visit = await Visit.create({ ...visitData, code: generateVisitID() });
    const services = await Service.find({
      _id: { $in: validatedData.services?.map((service) => service.serviceId) },
      serviceApplicableOn: {
        $in: [SERVICE_APPLICABLE.OPD, SERVICE_APPLICABLE.BOTH],
      },
    });

    if (services.length !== validatedData.services.length) {
      return res.status(404).json({
        message: "Some Services Not Found",
        data: null,
        status: false,
      });
    }

    const opdBill = new OpdBilling({
      ...validatedData,
      patient: patient._id,
      consultantDoctor: doctor._id,
      visit: visit._id,
    });

    await opdBill.save();

    // Filter services that require lab order tests (Pathology and Radiology)
    const labServices = services.filter(
      (s) =>
        s.headType === SERVICE_CATEGORY.PATHOLOGY ||
        s.headType === SERVICE_CATEGORY.RADIOLOGY
    );

    if (labServices.length) {
      const labOrder = await LabOrder.create({
        patient: patient._id,
        visit: visit._id,
        billingType: "OpdBilling",
        billingId: opdBill._id,
        doctor: doctor._id,
      });

      for (let index = 0; index < labServices.length; index++) {
        const service = labServices[index];

        await LabOrderTest.create({
          labOrderId: labOrder._id,
          serviceId: service._id,
        });
      }
    }

    return res.status(200).json({
      message: "OPD bill is created Found",
      data: opdBill,
      status: false,
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

const updateOPDController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = createOpdBillingSchema.parse(req.body);

    // Check for existing bed
    const existing = await OpdBilling.findOne({
      _id: id,
    });

    if (!existing) {
      return res.status(400).json({
        message: "OPD with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const existingPatient = await Patient.findOne({
      uhidNo: validatedData?.patient,
    });

    if (!existingPatient) {
      return res.status(400).json({
        message: "Patient with this Id Not Found",
        data: null,
        status: false,
      });
    }

    if (validatedData.consultantDoctor) {
      const consultantDoctor = await Doctor.findOne({
        _id: validatedData.consultantDoctor,
      });

      if (!consultantDoctor) {
        return res.status(400).json({
          message: "Consultant Doctor with this Id Not Found",
          data: null,
          status: false,
        });
      }
    }

    if (validatedData.services && validatedData.services.length) {
      const opdServices = await Service.find({
        $and: [
          {
            _id: {
              $in: validatedData.services?.map((service) => service.serviceId),
            },
          },
          {
            serviceApplicableOn: {
              $in: [SERVICE_APPLICABLE.OPD, SERVICE_APPLICABLE.BOTH],
            },
          },
        ],
      });

      if (opdServices.length !== (validatedData.services || []).length) {
        return res.status(404).json({
          message: "Some Services Not Found",
          data: null,
          status: false,
        });
      }
    }

    const opd = await OpdBilling.findByIdAndUpdate(id, {
      ...validatedData,
      patient: existingPatient._id,
    });

    return res.json({
      message: "OPD updated successfully",
      data: opd,
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

const getOneOPDController = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing bed
    const existing = await OpdBilling.findOne({
      _id: id,
    })
      .populate("consultantDoctor patient")
      .populate({
        path: "services",
        populate: {
          path: "serviceId",
        },
      });

    if (!existing) {
      return res.status(400).json({
        message: "OPD with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "OPD fetched successfully",
      data: existing,
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
  createOPDBill,
  listOPDController,
  getOneOPDController,
  updateOPDController,
};
