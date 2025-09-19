const { default: z } = require("zod");
const { createBedSchema, updateBedSchema } = require("../../validations/bed");
const Beds = require("../../models/Beds");

const createBedController = async (req, res) => {
  try {
    const validatedData = createBedSchema.parse(req.body);

    // Check for existing bedNumber
    const existing = await Beds.findOne({
      bedNumber: validatedData.bedNumber,
    });
    if (existing) {
      return res.status(400).json({
        message: "Bed with this number already exists",
        data: null,
        status: false,
      });
    }

    const bed = new Beds({
      ...validatedData,
      bedNumber: `BED-${Date.now()}`,
    });
    await bed.save();

    return res.json({
      message: "Bed created successfully",
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

const listBedsController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      ward = "",
      search = "",
      status = "",
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ ward: searchRegex }],
      $and: [
        status && {
          status: status,
        },
      ].filter(Boolean),
    };

    const total = await Beds.countDocuments(query);
    const beds = await Beds.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "Beds fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        beds,
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

const updateBedController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateBedSchema.parse(req.body);

    // Check for existing bed
    const existing = await Beds.findOne({
      _id: id,
    });
    if (!existing) {
      return res.status(400).json({
        message: "Bed with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const bed = await Beds.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Bed updated successfully",
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

const deleteBedController = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing bed
    const existing = await Beds.findByIdAndDelete(id);
    if (!existing) {
      return res.status(400).json({
        message: "Bed with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "Bed deleted successfully",
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

const getBedDropdownController = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ ward: searchRegex }],
    };

    const total = await Beds.countDocuments(query);
    const beds = await Beds.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Map to dropdown format
    const data = beds.map((d) => ({
      value: d._id,
      label: `${d.ward} | ${d.bedNumber || "-"} | ${d.type || "-"} | ${
        d.status || "-"
      }`,
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
  listBedsController,
  createBedController,
  updateBedController,
  deleteBedController,
  getBedDropdownController,
};
