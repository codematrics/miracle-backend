const { default: z } = require("zod");
const Service = require("../../models/Service");
const {
  createServiceSchema,
  updateServiceSchema,
} = require("../../validations/serviceSchema");
const LabParameter = require("../../models/LabParameter");
const { REPORT_TYPE, SERVICE_APPLICABLE } = require("../../constants/enums");

// Function to generate unique service code
async function generateServiceCode(category, serviceName) {
  // Get category prefix (first 3 letters uppercase)
  const categoryPrefix = category.substring(0, 3).toUpperCase();

  // Get service name prefix (first few letters, removing spaces/special chars)
  const namePrefix = serviceName
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();

  // Find the highest existing sequence number for this pattern
  const pattern = new RegExp(`^${categoryPrefix}_${namePrefix}_\\d+$`);
  const existingServices = await Service.find({ code: pattern })
    .sort({ code: -1 })
    .limit(1);

  let sequenceNumber = 1;
  if (existingServices.length > 0) {
    const lastCode = existingServices[0].code;
    const lastSequence = parseInt(lastCode.split("_").pop());
    if (!isNaN(lastSequence)) {
      sequenceNumber = lastSequence + 1;
    }
  }

  // Format: CATEGORY_SERVICENAME_SEQUENCE (e.g., LAB_CBC_001)
  return `${categoryPrefix}_${namePrefix}_${String(sequenceNumber).padStart(
    3,
    "0"
  )}`;
}

const createServiceController = async (req, res) => {
  try {
    const validatedData = createServiceSchema.parse(req.body);

    const code = await generateServiceCode(
      validatedData.headType,
      validatedData.serviceName
    );
    const existing = await Service.findOne({
      $or: [
        {
          serviceName: validatedData.serviceName,
        },
        {
          code,
        },
      ],
    });

    if (existing) {
      return res.status(400).json({
        message: "Service with this name or code already exists",
        data: null,
        status: false,
      });
    }

    const service = new Service({ ...validatedData, code });
    await service.save();

    return res.json({
      message: "Service created successfully",
      data: service,
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

const updateServiceController = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(req.body, "req");
    const validatedData = updateServiceSchema.parse(req.body);

    const service = await Service.findById(id);
    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found", data: null, status: false });
    }

    console.log(validatedData, "validatedData");

    const updatedService = await Service.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Service updated successfully",
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

const deleteServiceController = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);
    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found", data: null, status: false });
    }

    await Service.findByIdAndDelete(id);
    return res.json({
      message: "Service deleted successfully",
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

const getServiceDropdownController = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      serviceApplicableOn = "",
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [
        { serviceName: searchRegex },
        { serviceHead: searchRegex },
        { headType: searchRegex },
      ],
      ...(serviceApplicableOn && {
        serviceApplicableOn: {
          $in: [serviceApplicableOn, SERVICE_APPLICABLE.BOTH],
        },
      }),
    };

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Map to dropdown format
    const data = services.map((s) => ({
      value: s._id,
      label: `${s.serviceName} | ${s.serviceHead || "-"} | ${
        s.headType || "-"
      } | ${s.serviceApplicableOn || "-"} |  Rs. ${s.price || "-"}`,
      price: s.price,
      name: s.serviceName,
      serviceHead: s.serviceHead,
      headType: s.headType,
      code: s.code,
      _id: s._id,
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

const listServiceController = async (req, res) => {
  try {
    const {
      search = "",
      serviceHead = "",
      status = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const searchRegex = new RegExp(search, "i");

    const query = {
      $or: [{ serviceName: searchRegex }],
      $and: [
        serviceHead && { serviceHead },
        status && {
          isActive: status,
        },
      ].filter(Boolean),
    };

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return res.json({
      message: "Services fetched successfully",
      data: { total, page: pageNum, limit: limitNum, services },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listParametersWithServiceLinkController = async (req, res) => {
  try {
    const { id } = req.params;
    const { reportType } = req.query;

    if (!Object.values(REPORT_TYPE).includes(reportType)) {
      return res.status(400).json({
        message: "report type is required",
        data: null,
        status: false,
      });
    }

    if (!id) {
      return res.status(400).json({
        message: "Service ID is required",
        data: null,
        status: false,
      });
    }

    const service = await Service.findById(id).populate("linkedParameters");

    if (!service) {
      return res.status(404).json({
        message: "Service Not Found",
        data: null,
        status: false,
      });
    }

    const parametersByReport = await LabParameter.find({ reportType });

    // Add isLinked flag
    let parameterWithFlag = parametersByReport.map((parameter) => ({
      ...parameter?.toObject(),
      isLinked:
        service.linkedParameters?.filter(
          (p) => p._id?.toString() === parameter._id.toString()
        ).length === 1,
    }));

    // Sort linked services first
    parameterWithFlag.sort((a, b) => {
      if (a.isLinked === b.isLinked) return 0;
      return a.isLinked ? -1 : 1;
    });

    return res.json({
      message: "linked parameter fetched successfully",
      data: parameterWithFlag,
      status: true,
    });
  } catch (error) {
    console.error("Error fetching parameter:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

const updateServiceLinkedParametersController = async (req, res) => {
  try {
    const { id } = req.params;
    const { parameterIds, reportType } = req.body;

    // Validation
    if (!id) {
      return res.status(400).json({
        message: "Service ID is required",
        data: null,
        status: false,
      });
    }

    if (!Object.values(REPORT_TYPE).includes(reportType)) {
      return res.status(400).json({
        message: "Invalid report type",
        data: null,
        status: false,
      });
    }

    if (!Array.isArray(parameterIds)) {
      return res.status(400).json({
        message: "parameterIds must be an array",
        data: null,
        status: false,
      });
    }

    // Find service
    const service = await Service.findById(id).populate("linkedParameters");
    if (!service) {
      return res.status(404).json({
        message: "Service not found",
        data: null,
        status: false,
      });
    }

    // Validate that all parameterIds exist and match the reportType
    const validParameters = await LabParameter.find({
      _id: { $in: parameterIds },
      reportType,
    }).select("_id");

    if (validParameters.length !== parameterIds.length) {
      return res.status(400).json({
        message:
          "Some parameterIds are invalid or do not match the report type",
        data: null,
        status: false,
      });
    }

    // Preserve parameters from other reportTypes
    const preservedParameterIds = service.linkedParameters
      .filter((param) => param.reportType !== reportType)
      .map((param) => param._id);

    // Final list: keep others + replace current reportType's parameters
    service.linkedParameters = [...preservedParameterIds, ...parameterIds];
    await service.save();

    return res.json({
      message: "Linked parameters updated successfully",
      data: service,
      status: true,
    });
  } catch (error) {
    console.error("Error updating linked parameters:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

module.exports = {
  createServiceController,
  updateServiceController,
  deleteServiceController,
  listServiceController,
  listParametersWithServiceLinkController,
  updateServiceLinkedParametersController,
  getServiceDropdownController,
};
