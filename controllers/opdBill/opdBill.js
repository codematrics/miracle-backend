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

exports.createOPDBill = async (req, res) => {
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
