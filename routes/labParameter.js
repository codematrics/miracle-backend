const express = require("express");
const {
  getLabParametersController,
  createLabParameterController,
  updateLabParameterController,
  deleteLabParameter,
} = require("../controllers/labParameter/labParameter");

const router = express.Router();

router.get("/", getLabParametersController);
router.post("/", createLabParameterController);
router.put("/:id", updateLabParameterController);
router.delete("/:id", deleteLabParameter);
// router.get("/linking/:id", listServicesWithLabTestLinkController);
// router.put("/linking/:id", updateLabTestLinkedServicesController);

module.exports = router;
