const express = require("express");
const {
  createServiceType,
  updateServiceType,
  deleteServiceType,
  listServiceType,
  getServiceTypeDropdownController,
} = require("../controllers/service-type/serviceType");

const router = express.Router();

router.post("/", createServiceType);
router.get("/", listServiceType);
router.get("/dropdown-list", getServiceTypeDropdownController);
router.put("/:id", updateServiceType);
router.delete("/:id", deleteServiceType);

module.exports = router;
