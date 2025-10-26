const { default: z } = require("zod");
const { updateWardSchema } = require("../../validations/ward");
const Ward = require("../../models/Ward");
const {
  createFloorSchema,
  updateFloorSchema,
} = require("../../validations/floor");
const Floor = require("../../models/Floor");

const createFloorController = async (req, res) => {
  try {
    const validatedData = createFloorSchema.parse(req.body);

    // Check for existing floor
    const existing = await Floor.findOne({
      name: validatedData.name,
    });
    if (existing) {
      return res.status(400).json({
        message: "Floor with this name already exists",
        data: null,
        status: false,
      });
    }

    const floor = new Floor({
      ...validatedData,
    });
    await floor.save();

    return res.json({
      message: "Floor created successfully",
      data: floor,
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

const listFloorController = async (req, res) => {
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

    const total = await Floor.countDocuments(query);
    const floors = await Floor.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "Floors fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        floors,
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

const updateFloorController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateFloorSchema.parse(req.body);

    // Check for existing floor
    const existing = await Floor.findOne({
      _id: id,
    });
    if (!existing) {
      return res.status(400).json({
        message: "Floor with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const floor = await Floor.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "Floor updated successfully",
      data: floor,
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

const deleteFloorController = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing floor
    const existing = await Floor.findByIdAndDelete(id);
    if (!existing) {
      return res.status(400).json({
        message: "Floor with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "Floor deleted successfully",
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

const getFloorDropdownController = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10, status } = req.query;

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

    const total = await Floor.countDocuments(query);
    const floors = await Floor.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Map to dropdown format
    const data = floors.map((d) => ({
      value: d._id,
      label: `${d.name} | ${d.status || "-"}`,
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
  listFloorController,
  createFloorController,
  updateFloorController,
  deleteFloorController,
  getFloorDropdownController,
};
