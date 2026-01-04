const express = require("express");
const {
  getCollectionFromDoctor,
  getAllTypesOfCollection,
} = require("../controllers/collection/collection");

const router = express.Router();

router.get("/doctors-collection", getCollectionFromDoctor);
router.get("/all-types", getAllTypesOfCollection);

module.exports = router;
