const express = require("express");
const {
  listLabTestController,
  createLabTestController,
  updateLabTestController,
  deleteLabTestController,
  listServicesWithLabTestLinkController,
  updateLabTestLinkedServicesController,
} = require("../controllers/labTest/labTest");

const router = express.Router();

router.get("/", listLabTestController);
router.post("/", createLabTestController);
router.put("/:id", updateLabTestController);
router.delete("/:id", deleteLabTestController);
router.get("/linking/:id", listServicesWithLabTestLinkController);
router.put("/linking/:id", updateLabTestLinkedServicesController);

module.exports = router;
