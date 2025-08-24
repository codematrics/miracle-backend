const { default: z } = require("zod");
const Service = require("../../models/Service");
const {
  createServiceSchema,
  updateServiceSchema,
} = require("../../validations/serviceSchema");

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

module.exports = {
  createServiceController,
  updateServiceController,
  deleteServiceController,
  listServiceController,
};
