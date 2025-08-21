const express = require("express");
const router = express.Router();

// Simple test route
router.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Pathology API is working",
    data: []
  });
});

router.get("/test", (req, res) => {
  res.json({ message: "Test route working" });
});

module.exports = router;