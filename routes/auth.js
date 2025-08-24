const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validate } = require("../middleware/validation");
const { signupSchema, loginSchema } = require("../validations/authSchema");
const { loginController } = require("../controllers/auth/login");

const router = express.Router();

router.post("/signup", validate(signupSchema), async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /api/auth/signup - Request received`
  );
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      const field = existingUser.email === email ? "email" : "username";
      console.warn(
        `[${new Date().toISOString()}] POST /api/auth/signup - ERROR 400 - User already exists: ${field}`
      );
      return res.status(400).json({
        success: false,
        message: `User with this ${field} already exists`,
      });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(
      `[${new Date().toISOString()}] POST /api/auth/signup - SUCCESS 201 - User created: ${username} (${email})`
    );
    res.status(201).json({
      success: true,
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST /api/auth/signup - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        requestBody: { username: req.body.username, email: req.body.email },
      }
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// router.post("/login", validate(loginSchema), async (req, res) => {
//   console.log(
//     `[${new Date().toISOString()}] POST /api/auth/login - Request received`
//   );
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       console.warn(
//         `[${new Date().toISOString()}] POST /api/auth/login - ERROR 401 - User not found: ${email}`
//       );
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const isPasswordValid = await user.comparePassword(password);
//     if (!isPasswordValid) {
//       console.warn(
//         `[${new Date().toISOString()}] POST /api/auth/login - ERROR 401 - Invalid password for user: ${email}`
//       );
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     const token = jwt.sign(
//       { userId: user._id, username: user.username, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     console.log(
//       `[${new Date().toISOString()}] POST /api/auth/login - SUCCESS 200 - User logged in: ${
//         user.username
//       } (${email})`
//     );
//     res.json({
//       success: true,
//       message: "Login successful",
//       token,
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//       },
//     });
//   } catch (error) {
//     console.error(
//       `[${new Date().toISOString()}] POST /api/auth/login - ERROR 500:`,
//       {
//         message: error.message,
//         stack: error.stack,
//         requestBody: { email: req.body.email },
//       }
//     );
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });

router.post("/login", loginController);

module.exports = router;
