const express = require("express");
const {
  listAppointmentsController,
  createAppointmentController,
  updateAppointmentController,
} = require("../controllers/appointment/appointment");
const { ROLES } = require("../constants/enums");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  requireAuth({ roles: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR] }),
  listAppointmentsController
);
router.post(
  "/",
  requireAuth({ roles: [ROLES.ADMIN, ROLES.RECEPTIONIST] }),
  createAppointmentController
);
router.put(
  "/:id",
  requireAuth({ roles: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR] }),
  updateAppointmentController
);

module.exports = router;
