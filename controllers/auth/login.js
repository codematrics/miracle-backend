const { default: z } = require("zod");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const { loginSchema } = require("../../validations/authSchema");

const loginController = async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    console.log(await User.find());
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found", data: null, status: false });
    }

    // Plain password comparison
    if (user.password !== password) {
      return res
        .status(401)
        .json({ message: "Invalid credentials", data: null, status: false });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      },
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: error.errors[0].message, data: null, status: false });
    }
    return res.status(500).json({
      message: error.message || "Server error",
      data: null,
      status: false,
    });
  }
};

module.exports = { loginController };
