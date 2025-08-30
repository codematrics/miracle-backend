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
  getLabTestOrderTemplate,
  saveRadiologyTemplateResult,
  printRadiologyReport,
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

// GET /api/lab-test-orders/:labTestOrderId/template - Get linked template for a specific lab test order
router.get("/:labTestOrderId/template", getLabTestOrderTemplate);

// POST /api/lab-test-orders/save-radiology-result - Save radiology template result and authorize
router.post("/save-radiology-result", saveRadiologyTemplateResult);

// GET /api/lab-test-orders/print-radiology - Print radiology report
router.get("/print-radiology", printRadiologyReport);

// router.get("/linking/:id", listServicesWithLabTestLinkController);
// router.put("/linking/:id", updateLabTestLinkedServicesController);
module.exports = router;
