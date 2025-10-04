const express = require("express");
const { ROLES } = require("../constants/enums");
const { requireAuth } = require("../middleware/auth");
const {
  listUsersController,
  createUserController,
  updateUserController,
  deleteUserController,
} = require("../controllers/users/users");

const router = express.Router();

router.get("/", requireAuth({ roles: [ROLES.ADMIN] }), listUsersController);
router.post("/", requireAuth({ roles: [ROLES.ADMIN] }), createUserController);
router.put("/:id", requireAuth({ roles: [ROLES.ADMIN] }), updateUserController);
router.delete(
  "/:id",
  requireAuth({ roles: [ROLES.ADMIN] }),
  deleteUserController
);

module.exports = router;
