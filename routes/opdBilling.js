const express = require("express");
const OpdBilling = require("../models/OpdBilling");
const Patient = require("../models/Patient");
const Service = require("../models/Service");
const Doctor = require("../models/Doctor");
const { validate } = require("../middleware/validation");
const {
  createOpdBillingSchema,
  updateOpdBillingSchema,
  opdBillingQuerySchema,
} = require("../validations/opdBillingSchema");
const {
  paginate,
  buildSearchQuery,
  buildDateRangeQuery,
  combineQueries,
} = require("../lib/pagination");
const LabOrder = require("../models/LabOrder");
const { ORDER_STATUS } = require("../constants/enums");
const {
  createOPDBill,
  listOPDController,
  getOneOPDController,
  updateOPDController,
} = require("../controllers/opdBill/opdBill");

const router = express.Router();

router.get("/", listOPDController);
router.get("/:id", getOneOPDController);
router.post("/", createOPDBill);
router.put("/:id", updateOPDController);

// DELETE /api/opd-billing/:id - Delete OPD Bill
router.delete("/:id", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE /api/opd-billing/${
      req.params.id
    } - Request received`
  );
  try {
    const opdBill = await OpdBilling.findByIdAndDelete(req.params.id);

    if (!opdBill) {
      console.warn(
        `[${new Date().toISOString()}] DELETE /api/opd-billing/${
          req.params.id
        } - ERROR 404 - OPD Bill not found`
      );
      return res.status(404).json({
        success: false,
        message: "OPD Bill not found",
      });
    }

    console.log(
      `[${new Date().toISOString()}] DELETE /api/opd-billing/${
        req.params.id
      } - SUCCESS 200 - OPD Bill deleted: ${opdBill.billId}`
    );
    res.json({
      success: true,
      message: "OPD Bill deleted successfully",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] DELETE /api/opd-billing/${
        req.params.id
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
        billId: req.params.id,
      }
    );
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
