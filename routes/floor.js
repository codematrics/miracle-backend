const express = require("express");
const {
  listFloorController,
  createFloorController,
  getFloorDropdownController,
  updateFloorController,
  deleteFloorController,
} = require("../controllers/floor/floor");

const router = express.Router();

router.get("/", listFloorController);
router.post("/", createFloorController);
router.get("/dropdown-list", getFloorDropdownController);
router.put("/:id", updateFloorController);
router.delete("/:id", deleteFloorController);

module.exports = router;
