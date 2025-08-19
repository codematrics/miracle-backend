const { ZodError } = require("zod");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    try {
      console.log(`[${new Date().toISOString()}] VALIDATION DEBUG:`, {
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        property: property,
        hasBody: !!req.body,
        bodyType: typeof req.body,
      });

      const dataToValidate = property === "query" ? req.query : req[property];
      const validatedData = schema.parse(dataToValidate);

      if (property === "query") {
        req.query = validatedData;
      } else {
        req[property] = validatedData;
      }

      console.log(
        `[${new Date().toISOString()}] VALIDATION SUCCESS: ${req.method} ${
          req.path
        } - ${property} validated`
      );
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        console.log("Raw Zod Error:", error);
        console.log("Error.errors:", error.errors);
        console.log("Error.issues:", error.issues);

        const errorMessages = (error.issues || error.errors || []).map(
          (err) => ({
            field: (err.path || []).join("."),
            message: err.message || "Validation error",
            code: err.code || "unknown",
          })
        );

        console.warn(
          `[${new Date().toISOString()}] VALIDATION ERROR: ${req.method} ${
            req.path
          }`,
          {
            errors: errorMessages,
            receivedData: req[property],
            zodError: error.message,
            fullError: error,
          }
        );

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errorMessages,
          rawError: error.message,
        });
      }

      console.error(
        `[${new Date().toISOString()}] VALIDATION SYSTEM ERROR: ${req.method} ${
          req.path
        }`,
        {
          message: error.message,
          stack: error.stack,
        }
      );

      return res.status(500).json({
        success: false,
        message: "Internal validation error",
      });
    }
  };
};

module.exports = { validate };
