const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();
const serverless = require("serverless-http");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const patientRoutes = require("./routes/patient");
const appointmentRoutes = require("./routes/appointment");
const bedRoutes = require("./routes/bed");
const floorRoutes = require("./routes/floor");
const wardRoutes = require("./routes/ward");
const parametersRoutes = require("./routes/parameters");
const labParametersRoutes = require("./routes/labParameter");
const serviceRoutes = require("./routes/service");
const serviceTypesRoutes = require("./routes/serviceType");
const visitRoutes = require("./routes/visit");
const LabTestOderRoutes = require("./routes/labTestOrder");
const enumRoutes = require("./routes/enums");
const opdBillingRoutes = require("./routes/opdBilling");
const ipdBillingRoutes = require("./routes/ipd");
const labRoutes = require("./routes/lab");
const collectionRoutes = require("./routes/collection");
const PrescriptionRoutes = require("./routes/prescription");
const ExaminationsRoutes = require("./routes/PrimaryExamination");
const labTestRoutes = require("./routes/labTest");
const pathologyRoutes = require("./routes/pathology");
const doctorRoutes = require("./routes/doctor");
const radiologyTemplateRoutes = require("./routes/radiologyTemplate");
const {
  securityMiddleware,
  authLimiter,
  apiLimiter,
} = require("./middleware/security");

const app = express();
app.set("trust proxy", 1);
app.use((req, res, next) => {
  console.log("🌐 Incoming request from origin:", req.headers.origin);
  next();
});

app.use(cors({ origin: "*" }));
// ✅ Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ Security middlewares (helmet, mongo sanitize, xss clean)
app.use(securityMiddleware);

// ✅ Logging
app.use(
  morgan("combined", {
    format:
      ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
  })
);

// ✅ Routes
app.use("/api/lab", apiLimiter, labRoutes);
app.use("/api/users", apiLimiter, userRoutes);
app.use("/api/bed", apiLimiter, bedRoutes);
app.use("/api/floors", apiLimiter, floorRoutes);
app.use("/api/wards", apiLimiter, wardRoutes);
app.use("/api/lab-tests", apiLimiter, labTestRoutes);
app.use("/api/appointment", apiLimiter, appointmentRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/patients", apiLimiter, patientRoutes);
app.use("/api/prescriptions", apiLimiter, PrescriptionRoutes);
app.use("/api/primary-examination", apiLimiter, ExaminationsRoutes);
app.use("/api/lab-test-orders", apiLimiter, LabTestOderRoutes);
app.use("/api/parameters", apiLimiter, parametersRoutes);
app.use("/api/lab-parameters", apiLimiter, labParametersRoutes);
app.use("/api/services", apiLimiter, serviceRoutes);
app.use("/api/collections", apiLimiter, collectionRoutes);
app.use("/api/service-types", serviceTypesRoutes);
app.use("/api/visits", apiLimiter, visitRoutes);
app.use("/api/opd-billing", apiLimiter, opdBillingRoutes);
app.use("/api/ipd-billing", apiLimiter, ipdBillingRoutes);
app.use("/api/pathology", apiLimiter, pathologyRoutes);
app.use("/api/doctors", apiLimiter, doctorRoutes);
app.use("/api/radiology-template", apiLimiter, radiologyTemplateRoutes);
app.use("/api/enums", enumRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Hospital Management System API" });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error(
    `[${new Date().toISOString()}] ERROR: ${req.method} ${req.path}`
  );
  console.error("Error details:", {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ✅ Start server only after DB connection
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/miracle", {
    dbName: "miracle",
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(
      "❌ MongoDB connection error:",
      process.env.MONGODB_URI,
      error.message
    );
    process.exit(1);
  });

module.exports = app;
module.exports.handler = serverless(app);
