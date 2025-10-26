const express = require("express");
const {
  listIPDController,
  createIPDController,
  updateIPDController,
  printIpdBill,
} = require("../controllers/ipd/ipd");

const router = express.Router();

router.get("/", listIPDController);
router.post("/", createIPDController);
router.put("/:id", updateIPDController);
router.get("/export/:id", printIpdBill);

module.exports = router;
