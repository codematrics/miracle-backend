const express = require("express");
const {
  listLabTestController,
  getLabOrderParametersGroupedBySampleType,
} = require("../controllers/labTestOrder/LabTestOrder");

const router = express.Router();

router.get("/", listLabTestController);
router.get(
  "/:labOrderId/grouped-by-sample",
  getLabOrderParametersGroupedBySampleType
);

// router.get("/linking/:id", listServicesWithLabTestLinkController);
// router.put("/linking/:id", updateLabTestLinkedServicesController);
module.exports = router;
