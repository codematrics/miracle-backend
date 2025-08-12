const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validate } = require('../middleware/validation');
const { signupSchema, loginSchema } = require('../validations/authSchema');

const router = express.Router();

router.post('/signup', validate(signupSchema), async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /api/auth/signup - Request received`);
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(`[${new Date().toISOString()}] POST /api/auth/signup - ERROR 400 - User already exists: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = new User({ email, password });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[${new Date().toISOString()}] POST /api/auth/signup - SUCCESS 201 - User created: ${email}`);
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] POST /api/auth/signup - ERROR 500:`, {
      message: error.message,
      stack: error.stack,
      requestBody: { email: req.body.email }
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /api/auth/login - Request received`);
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.warn(`[${new Date().toISOString()}] POST /api/auth/login - ERROR 401 - User not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.warn(`[${new Date().toISOString()}] POST /api/auth/login - ERROR 401 - Invalid password for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[${new Date().toISOString()}] POST /api/auth/login - SUCCESS 200 - User logged in: ${email}`);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] POST /api/auth/login - ERROR 500:`, {
      message: error.message,
      stack: error.stack,
      requestBody: { email: req.body.email }
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;