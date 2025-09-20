const { default: z } = require("zod");
const Beds = require("../../models/Beds");
const IPD = require("../../models/IPD");
const { createIPDSchema, updateIPDSchema } = require("../../validations/ipd");
const Patient = require("../../models/Patient");
const Doctor = require("../../models/Doctor");
const Service = require("../../models/Service");
const {
  SERVICE_APPLICABLE,
  SERVICE_CATEGORY,
  VISIT_TYPE,
} = require("../../constants/enums");
const LabOrder = require("../../models/LabOrder");
const LabOrderTest = require("../../models/LabOrderTest");
const Visit = require("../../models/Visit");
const { generateVisitID } = require("../visit/visit");

const createIPDController = async (req, res) => {
  try {
    const validatedData = createIPDSchema.parse(req.body);

    const patient = await Patient.findById(validatedData.patient);

    if (!patient) {
      return res.status(404).json({
        message: "Patient Not Found",
        data: null,
        status: false,
      });
    }
    const doctor = await Doctor.findById(validatedData.referringDoctor);

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor Not Found",
        data: null,
        status: false,
      });
    }

    const bed = await Beds.findById(validatedData.bed);

    if (!bed) {
      return res.status(404).json({
        message: "Bed Not Found",
        data: null,
        status: false,
      });
    }

    if (bed.status === "occupied" || bed.status === "maintenance") {
      return res.status(400).json({
        message: "Bed is not available",
        data: null,
        status: false,
      });
    }

    const ipdExists = await IPD.findOne({
      patient: validatedData.patient,
      patientStatus: "In Treatment",
    });

    if (ipdExists) {
      return res.status(400).json({
        message: "Patient is already admitted",
        data: null,
        status: false,
      });
    }

    const ipdServices = await Service.find({
      $and: [
        {
          _id: {
            $in: validatedData.services?.map((service) => service.serviceId),
          },
        },
        {
          serviceApplicableOn: {
            $in: [SERVICE_APPLICABLE.IPD, SERVICE_APPLICABLE.BOTH],
          },
        },
      ],
    });

    if (ipdServices.length !== (validatedData.services || []).length) {
      return res.status(404).json({
        message: "Some Services Not Found",
        data: null,
        status: false,
      });
    }

    const ipd = new IPD({
      ...validatedData,
      billNumber: `IPD-${Date.now()}`,
      patient: patient._id,
      referringDoctor: doctor._id,
      bed: bed._id,
      services: ipdServices.map((service) => ({
        serviceId: service._id,
        quantity: 1,
        price: service.price,
      })),
    });

    await ipd.save();

    await Beds.findByIdAndUpdate(bed._id, {
      status: "occupied",
      patientId: patient._id,
    });

    const labServices = ipdServices.filter(
      (s) =>
        s.headType === SERVICE_CATEGORY.PATHOLOGY ||
        s.headType === SERVICE_CATEGORY.RADIOLOGY
    );

    const visitData = {
      patientId: patient._id,
      consultingDoctorId: validatedData.referringDoctor,
      visitType: VISIT_TYPE.IPD,
    };

    const visit = await Visit.create({ ...visitData, code: generateVisitID() });

    if (labServices.length) {
      const labOrder = await LabOrder.create({
        patient: patient._id,
        visit: visit._id,
        billingType: "IPD",
        billingId: ipd._id,
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
      message: "IPD bill is created",
      data: ipd,
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

const listIPDController = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    // const searchRegex = new RegExp(search, "i");
    // const query = {
    //   ...(searchRegex && {
    //     $or: [
    //       { patient: searchRegex },
    //       { bed: searchRegex },
    //       { referringDoctor: searchRegex },
    //       { billNumber: searchRegex },
    //     ],
    //   }),
    //   $and: [
    //     status && {
    //       status: status,
    //     },
    //   ].filter(Boolean),
    // };
    const query = {};

    const total = await IPD.countDocuments(query);
    const ipd = await IPD.find(query)
      .populate("patient bed referringDoctor services.serviceId")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "IPD fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        ipd,
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

const updateIPDController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateIPDSchema.parse(req.body);

    // Check for existing bed
    const existing = await IPD.findOne({
      _id: id,
    });

    if (!existing) {
      return res.status(400).json({
        message: "IPD with this Id Not Found",
        data: null,
        status: false,
      });
    }
    if (validatedData.referringDoctor) {
      const referringDoctor = await Doctor.findOne({
        _id: validatedData.referringDoctor,
      });

      if (!referringDoctor) {
        return res.status(400).json({
          message: "Referring Doctor with this Id Not Found",
          data: null,
          status: false,
        });
      }
    }

    if (
      validatedData.bed &&
      validatedData.bed?.toString() !== existing.bed?.toString()
    ) {
      const bed = await Beds.findById(validatedData.bed);

      if (!bed) {
        return res.json({
          message: "Bed not found",
          data: null,
          status: false,
        });
      }

      if (bed.status === "occupied" || bed.status === "maintenance") {
        return res.status(400).json({
          message: "Bed is not available",
          data: null,
          status: false,
        });
      }
    }
    if (validatedData.services && validatedData.services.length) {
      const ipdServices = await Service.find({
        $and: [
          {
            _id: {
              $in: validatedData.services?.map((service) => service.serviceId),
            },
          },
          {
            serviceApplicableOn: {
              $in: [SERVICE_APPLICABLE.IPD, SERVICE_APPLICABLE.BOTH],
            },
          },
        ],
      });

      if (ipdServices.length !== (validatedData.services || []).length) {
        return res.status(404).json({
          message: "Some Services Not Found",
          data: null,
          status: false,
        });
      }
    }

    if (
      validatedData.patientStatus &&
      validatedData.patientStatus === "Discharged"
    ) {
      await Beds.findByIdAndUpdate(existing.bed, {
        status: "available",
        patientId: null,
      });
    } else if (validatedData.bed) {
      await Beds.findByIdAndUpdate(validatedData.bed, { status: "occupied" });
      if (validatedData.bed.toString() !== existing.bed.toString()) {
        await Beds.findByIdAndUpdate(existing.bed, { status: "available" });
      }
    }

    console.log(validatedData);
    const ipd = await IPD.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "IPD updated successfully",
      data: ipd,
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
  listIPDController,
  createIPDController,
  updateIPDController,
};
