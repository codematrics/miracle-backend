const express = require("express");
const {
  listAppointmentsController,
  createAppointmentController,
  updateAppointmentController,
} = require("../controllers/appointment/appointment");

const router = express.Router();

router.get("/", listAppointmentsController);
router.post("/", createAppointmentController);
router.put("/:id", updateAppointmentController);

module.exports = router;
