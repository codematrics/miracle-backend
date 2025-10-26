const { default: z } = require("zod");
const { createBedSchema, updateBedSchema } = require("../../validations/bed");
const Beds = require("../../models/Beds");
const Ward = require("../../models/Ward");
const Floor = require("../../models/Floor");

const createBedController = async (req, res) => {
  try {
    const validatedData = createBedSchema.parse(req.body);

    // Validate ward
    const existingWard = await Ward.findById(validatedData.ward);
    if (!existingWard) {
      return res.status(400).json({
        message: "Ward does not exist",
        data: null,
        status: false,
      });
    }

    // Validate floor
    const existingFloor = await Floor.findById(validatedData.floor);
    if (!existingFloor) {
      return res.status(400).json({
        message: "Floor does not exist",
        data: null,
        status: false,
      });
    }

    // Create multiple beds in the given range
    const bedsToCreate = [];
    for (
      let num = validatedData.bedNumberFrom;
      num <= validatedData.bedNumberTo;
      num++
    ) {
      // Check if this bed number already exists
      const existingBed = await Beds.findOne({ bedNumber: num });
      if (existingBed) {
        continue; // skip existing beds
      }

      bedsToCreate.push({
        bedNumber: num,
        status: validatedData.status || "available",
        type: validatedData.type,
        ward: validatedData.ward,
        floor: validatedData.floor,
      });
    }

    if (bedsToCreate.length === 0) {
      return res.status(400).json({
        message: "All bed numbers in this range already exist",
        data: null,
        status: false,
      });
    }

    const createdBeds = await Beds.insertMany(bedsToCreate);

    return res.json({
      message: "Beds created successfully",
      data: createdBeds,
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.issues[0]?.message,
        data: null,
        status: false,
      });
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
      $or: search ? [{ ward: searchRegex }] : [],
      $and: [
        status && {
          status: status,
        },
      ].filter(Boolean),
    };

    const total = await Beds.countDocuments(query);
    const beds = await Beds.find(query)
      .populate("patientId")
      .populate({
        path: "ward",
        populate: {
          path: "floor",
        },
      })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 });

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

    const existingWard = await Ward.findOne({
      _id: validatedData.ward,
    });

    if (!existingWard) {
      return res.status(400).json({
        message: "Ward does not exists",
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
    const { search = "", page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    const searchRegex = new RegExp(search, "i");
    const query = {
      $or: search ? [{ ward: searchRegex }] : [],
      $and: [
        status && {
          status: status,
        },
      ].filter(Boolean),
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
