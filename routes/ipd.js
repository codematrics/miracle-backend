const express = require("express");
const {
  listIPDController,
  createIPDController,
  updateIPDController,
} = require("../controllers/ipd/ipd");

const router = express.Router();

router.get("/", listIPDController);
router.post("/", createIPDController);
router.put("/:id", updateIPDController);

module.exports = router;
