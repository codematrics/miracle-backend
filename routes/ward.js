const express = require("express");
const {
  listWardController,
  createWardController,
  getWardDropdownController,
  updateWardController,
  deleteWardController,
} = require("../controllers/ward/ward");

const router = express.Router();

router.get("/", listWardController);
router.post("/", createWardController);
router.get("/dropdown-list", getWardDropdownController);
router.put("/:id", updateWardController);
router.delete("/:id", deleteWardController);

module.exports = router;
