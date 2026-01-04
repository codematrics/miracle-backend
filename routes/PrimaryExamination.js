const express = require("express");
const {
  createPrimaryExamination,
} = require("../controllers/primary-examination/primaryExamination");

const router = express.Router();

router.post("/", createPrimaryExamination);

module.exports = router;
