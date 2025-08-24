const { default: z } = require("zod");
const LabTest = require("../../models/LabTest");
const {
  createLabTestSchema,
  updateLabTestSchema,
} = require("../../validations/labTestSchema");
const Service = require("../../models/Service");

const createLabTestController = async (req, res) => {
  try {
    const validatedData = createLabTestSchema.parse(req.body);

    const existing = await LabTest.findOne({
      testName: validatedData.testName,
      reportType: validatedData.reportType,
    });

    if (existing) {
      return res.status(400).json({
        message: "Lab test with same name & report type already exists",
        data: null,
        status: false,
      });
    }

    const labTest = new LabTest(validatedData);
    await labTest.save();

    return res.json({
      message: "Lab test created successfully",
      data: labTest,
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
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

const updateLabTestController = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(req.body, "req");
    const validatedData = updateLabTestSchema.parse(req.body);

    const service = await LabTest.findById(id);
    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found", data: null, status: false });
    }

    console.log(validatedData, "validatedData");

    const updatedService = await LabTest.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Lab Test updated successfully",
      data: updatedService,
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
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const deleteLabTestController = async (req, res) => {
  try {
    const { id } = req.params;
    const labTest = await LabTest.findById(id);
    if (!labTest) {
      return res
        .status(404)
        .json({ message: "Lab Test not found", data: null, status: false });
    }

    await LabTest.findByIdAndDelete(id);
    return res.json({
      message: "Lab Test deleted successfully",
      data: null,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listLabTestController = async (req, res) => {
  try {
    const {
      search = "",
      reportType = "",
      status = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const searchRegex = new RegExp(search, "i");

    const query = {
      $or: [{ testName: searchRegex }],
      $and: [
        status && {
          isActive: status,
        },
        reportType && {
          reportType: reportType,
        },
      ].filter(Boolean),
    };

    const total = await LabTest.countDocuments(query);
    const labTests = await LabTest.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return res.json({
      message: "Lab Tests fetched successfully",
      data: { total, page: pageNum, limit: limitNum, labTests },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listServicesWithLabTestLinkController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Lab test ID is required",
        data: null,
        status: false,
      });
    }

    // Fetch all services
    const services = await Service.find().lean();

    // Fetch links for given labTestId
    const labTest = await LabTest.findById(id)
      .populate("linkedServices")
      .lean();
    console.log(labTest, "labtest");
    if (!labTest) {
      return res.status(404).json({
        message: "Lab test Not Found",
        data: null,
        status: false,
      });
    }

    // Add isLinked flag
    let servicesWithFlag = services.map((service) => ({
      ...service,
      isLinked:
        labTest.linkedServices?.filter(
          (s) => s._id?.toString() === service._id.toString()
        ).length === 1,
    }));

    // Sort linked services first
    servicesWithFlag.sort((a, b) => {
      if (a.isLinked === b.isLinked) return 0;
      return a.isLinked ? -1 : 1;
    });

    console.log(servicesWithFlag);

    return res.json({
      message: "linked Services fetched successfully",
      data: servicesWithFlag,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

const updateLabTestLinkedServicesController = async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceIds } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Lab test ID is required",
        data: null,
        status: false,
      });
    }

    if (!Array.isArray(serviceIds)) {
      return res.status(400).json({
        message: "serviceIds must be an array",
        data: null,
        status: false,
      });
    }

    // Validate lab test exists
    const labTest = await LabTest.findById(id);
    if (!labTest) {
      return res.status(404).json({
        message: "Lab test not found",
        data: null,
        status: false,
      });
    }

    // Validate that services exist
    const validServices = await Service.find({
      _id: { $in: serviceIds },
    }).select("_id");

    if (validServices.length !== serviceIds.length) {
      return res.status(400).json({
        message: "Some serviceIds are invalid",
        data: null,
        status: false,
      });
    }

    // Update linked services
    labTest.linkedServices = serviceIds;
    await labTest.save();

    return res.json({
      message: "Linked services updated successfully",
      data: labTest,
      status: true,
    });
  } catch (error) {
    console.error("Error updating linked services:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

module.exports = {
  createLabTestController,
  updateLabTestController,
  deleteLabTestController,
  listLabTestController,
  listServicesWithLabTestLinkController,
  updateLabTestLinkedServicesController,
};
