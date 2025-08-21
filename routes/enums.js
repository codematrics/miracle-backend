const express = require("express");
const { PATIENT_ENUMS, SERVICE_ENUMS, PATHOLOGY_ENUMS } = require("../constants/enums");

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

// Service enums endpoints
router.get("/service", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/enums/service - Request received`
  );

  try {
    res.json({
      success: true,
      data: SERVICE_ENUMS,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/enums/service - SUCCESS 200 - Service enums retrieved`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/enums/service - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve service enums",
    });
  }
});

router.get("/service/:enumType", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/enums/service/${
      req.params.enumType
    } - Request received`
  );

  try {
    const { enumType } = req.params;
    const enumData = SERVICE_ENUMS[enumType.toUpperCase()];

    if (!enumData) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/enums/service/${enumType} - ERROR 404 - Enum type not found`
      );
      return res.status(404).json({
        success: false,
        message: `Service enum type '${enumType}' not found`,
      });
    }

    res.json({
      success: true,
      data: enumData,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/enums/service/${enumType} - SUCCESS 200 - Service enum retrieved`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/enums/service/${
        req.params.enumType
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve service enum",
    });
  }
});

// Pathology enums endpoints
router.get("/pathology", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/enums/pathology - Request received`
  );

  try {
    res.json({
      success: true,
      data: PATHOLOGY_ENUMS,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/enums/pathology - SUCCESS 200 - Pathology enums retrieved`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/enums/pathology - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve pathology enums",
    });
  }
});

router.get("/pathology/:enumType", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /api/enums/pathology/${
      req.params.enumType
    } - Request received`
  );

  try {
    const { enumType } = req.params;
    const enumData = PATHOLOGY_ENUMS[enumType.toUpperCase()];

    if (!enumData) {
      console.warn(
        `[${new Date().toISOString()}] GET /api/enums/pathology/${enumType} - ERROR 404 - Enum type not found`
      );
      return res.status(404).json({
        success: false,
        message: `Pathology enum type '${enumType}' not found`,
      });
    }

    res.json({
      success: true,
      data: enumData,
    });

    console.log(
      `[${new Date().toISOString()}] GET /api/enums/pathology/${enumType} - SUCCESS 200 - Pathology enum retrieved`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] GET /api/enums/pathology/${
        req.params.enumType
      } - ERROR 500:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve pathology enum",
    });
  }
});

module.exports = router;
