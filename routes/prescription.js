const express = require("express");
const {
  createPrescription,
  printPrescription,
} = require("../controllers/prescription/priscription");

const router = express.Router();

router.post("/", createPrescription);
router.get("/:id/print", printPrescription);

// router.get("/linking/:id", listServicesWithLabTestLinkController);
// router.put("/linking/:id", updateLabTestLinkedServicesController);

module.exports = router;
