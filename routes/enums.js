const express = require("express");
const { PATIENT_ENUMS } = require("../constants/enums");

const router = express.Router();

router.get("/patient", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/enums/patient - Request received`
  );

  try {
    res.json({
      success: true,
      data: PATIENT_ENUMS,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/enums/patient - SUCCESS 200 - Enums retrieved`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/enums/patient - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve enums",
    });
  }
});

router.get("/patient/:enumType", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/enums/patient/${
      req.params.enumType
    } - Request received`
  );

  try {
    const { enumType } = req.params;
    const enumData = PATIENT_ENUMS[enumType.toUpperCase()];

    if (!enumData) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/enums/patient/${enumType} - ERROR 404 - Enum type not found`
      );
      return res.status(404).json({
        success: false,
        message: `Enum type '${enumType}' not found`,
      });
    }

    res.json({
      success: true,
      data: enumData,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/enums/patient/${enumType} - SUCCESS 200 - Enum retrieved`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/enums/patient/${
        req.params.enumType
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve enum",
    });
  }
});

module.exports = router;
