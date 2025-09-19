const express = require("express");
const Doctor = require("../models/Doctor");
const {
  listBedsController,
  createBedController,
  getBedDropdownController,
  updateBedController,
  deleteBedController,
} = require("../controllers/bed/bed");

const router = express.Router();

router.get("/", listBedsController);
router.post("/", createBedController);
router.get("/dropdown-list", getBedDropdownController);
router.put("/:id", updateBedController);
router.delete("/:id", deleteBedController);

module.exports = router;
