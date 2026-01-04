const Examinations = require("../../models/Examinations");
const ServiceType = require("../../models/ServiceType");
const {
  primaryExaminationZodSchema,
} = require("../../validations/examinationSchema");
const {
  createServiceTypeSchema,
  updateServiceTypeSchema,
} = require("../../validations/serviceType");

const listServiceType = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ name: searchRegex }],
    };

    const total = await ServiceType.countDocuments(query);
    const serviceTypes = await ServiceType.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });
    return res.json({
      message: "Service Type fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        serviceTypes,
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

const createServiceType = async (req, res) => {
  try {
    const parsed = createServiceTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const examination = await ServiceType.create({
      ...parsed.data,
    });

    res.status(201).json({
      status: true,
      message: "Service Type saved successfully",
      data: examination,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Failed to save service type",
    });
  }
};

const updateServiceType = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateServiceTypeSchema.parse(req.body);

    // Check for existing ward
    const existing = await ServiceType.findOne({
      _id: id,
    });
    if (!existing) {
      return res.status(400).json({
        message: "Service Type with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const ward = await ServiceType.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Service Type updated successfully",
      data: ward,
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

const deleteServiceType = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing ward
    const existing = await ServiceType.findByIdAndDelete(id);
    if (!existing) {
      return res.status(400).json({
        message: "ServiceType with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "ServiceType deleted successfully",
      data: null,
      status: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server error",
      data: null,
      status: false,
    });
  }
};

const getServiceTypeDropdownController = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10, serviceHead = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ name: searchRegex }],
      $and: [
        serviceHead && {
          serviceHead: serviceHead,
        },
      ].filter(Boolean),
    };

    const total = await ServiceType.countDocuments(query);
    const wards = await ServiceType.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Map to dropdown format
    const data = wards.map((d) => ({
      value: d._id,
      label: `${d.name} | ${d.serviceHead || "-"}`,
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

module.exports = {
  createServiceType,
  listServiceType,
  updateServiceType,
  deleteServiceType,
  getServiceTypeDropdownController,
};
