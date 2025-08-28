const express = require("express");
const {
  listLabTestController,
  getLabOrderParametersGroupedBySampleType,
  collectTheTestOrder,
  listCollectedLabTestController,
  getLabParametersByTestOrder,
  getLabParametersGroupedByReportType,
  saveLabTestResults,
  listSavedLabTestController,
  getLabParametersWithResults,
  saveAndAuthorizeLabTestResults,
  getLabOrderTestReportTypes,
  printLabTestOrder,
} = require("../controllers/labTestOrder/LabTestOrder");
const {
  listParametersWithServiceLinkController,
} = require("../controllers/service/service");

const router = express.Router();

router.get("/", listLabTestController);
router.get("/collected", listCollectedLabTestController);
router.get("/saved", listSavedLabTestController);
router.get("/parameters", getLabParametersGroupedByReportType);
router.get("/printable", getLabOrderTestReportTypes);
router.get("/print", printLabTestOrder);
router.get("/parameters-result", getLabParametersWithResults);
router.post("/save-authorize", saveAndAuthorizeLabTestResults);
router.post("/save-results", saveLabTestResults);
router.post("/collect", collectTheTestOrder);
router.get(
  "/:labOrderId/grouped-by-sample",
  getLabOrderParametersGroupedBySampleType
);

// router.get("/linking/:id", listServicesWithLabTestLinkController);
// router.put("/linking/:id", updateLabTestLinkedServicesController);
module.exports = router;
