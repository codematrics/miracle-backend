const { default: z } = require("zod");
const {
  createWardSchema,
  updateWardSchema,
} = require("../../validations/ward");
const Ward = require("../../models/Ward");

const createWardController = async (req, res) => {
  try {
    const validatedData = createWardSchema.parse(req.body);

    // Check for existing ward
    const existing = await Ward.findOne({
      name: validatedData.name,
    });
    if (existing) {
      return res.status(400).json({
        message: "Ward with this name already exists",
        data: null,
        status: false,
      });
    }

    const ward = new Ward({
      ...validatedData,
    });
    await ward.save();

    return res.json({
      message: "Ward created successfully",
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

const listWardController = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ name: searchRegex }],
      $and: [
        status && {
          status: status,
        },
      ].filter(Boolean),
    };

    const total = await Ward.countDocuments(query);
    const wards = await Ward.find(query)
      .populate("floor")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });
    return res.json({
      message: "Wards fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        wards,
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

const updateWardController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateWardSchema.parse(req.body);

    // Check for existing ward
    const existing = await Ward.findOne({
      _id: id,
    });
    if (!existing) {
      return res.status(400).json({
        message: "Ward with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const ward = await Ward.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Ward updated successfully",
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

const deleteWardController = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing ward
    const existing = await Ward.findByIdAndDelete(id);
    if (!existing) {
      return res.status(400).json({
        message: "Ward with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "Ward deleted successfully",
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

const getWardDropdownController = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      floorId = "",
      status,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: [{ name: searchRegex }],
      $and: [
        status && {
          status: status,
        },
        floorId && {
          floor: floorId,
        },
      ].filter(Boolean),
    };

    const total = await Ward.countDocuments(query);
    const wards = await Ward.find(query)
      .populate("floor")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Map to dropdown format
    const data = wards.map((d) => ({
      value: d._id,
      label: `${d.name} | ${d.type || "-"} | ${d.floor?.name || "-"} | ${
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
  listWardController,
  createWardController,
  updateWardController,
  deleteWardController,
  getWardDropdownController,
};
