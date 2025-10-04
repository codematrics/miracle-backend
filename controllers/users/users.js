const { default: z } = require("zod");
const { updateBedSchema } = require("../../validations/bed");
const {
  createAppointmentSchema,
  updateAppointmentSchema,
} = require("../../validations/appointment");
const Doctor = require("../../models/Doctor");
const Patient = require("../../models/Patient");
const Appointment = require("../../models/Appointment");
const { ROLES } = require("../../constants/enums");
const User = require("../../models/User");
const {
  updateUserSchema,
  createUserSchema,
} = require("../../validations/user");

const createUserController = async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);

    const user = await User.findOne({
      email: validatedData.email,
    });

    if (user) {
      return res.status(400).json({
        message: "User Already Exists",
        data: null,
        status: false,
      });
    }

    const newUser = User.create(validatedData);
    const { password, ...rest } = newUser;

    return res.json({
      message: "User created successfully",
      data: rest,
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

const listUsersController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      role = "",
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const query = {
      $and: [
        status && {
          status: status,
        },
        role && {
          role,
        },
        search && {
          email: search,
        },
      ].filter(Boolean),
    };

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "Users fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        users,
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

const updateUserController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateUserSchema.parse(req.body);

    // Check for existing bed
    const existing = await User.findOne({
      _id: id,
    });

    if (!existing) {
      return res.status(400).json({
        message: "User with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const user = await User.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "User updated successfully",
      data: user,
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

const deleteUserController = async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.deleteOne({ _id: id });

    if (user.deletedCount) {
      return res.json({
        message: "User updated successfully",
        data: null,
        status: true,
      });
    } else {
      return res.json({
        message: "User deleted successfully",
        data: null,
        status: true,
      });
    }
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
  listUsersController,
  createUserController,
  updateUserController,
  deleteUserController,
};
