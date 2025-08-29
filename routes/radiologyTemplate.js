const express = require("express");
const {
  createRadiologyTemplate,
  getRadiologyTemplates,
  getRadiologyTestTemplateById,
  updateRadiologyTemplate,
  deleteRadiologyTemplate,
  linkTemplateToService,
  unlinkTemplateFromService,
  getRadiologyServicesWithTemplates,
  listTemplatesWithServiceLinkController,
  updateServiceLinkedTemplateController,
} = require("../controllers/radiologyTestTemplate/radiologyTestTemplate");

const router = express.Router();

// GET /api/radiology-template - Get all radiology templates with pagination and filters
router.get("/", getRadiologyTemplates);

// GET /api/radiology-template/services-with-templates - Get radiology services with their linked templates
router.get("/services-with-templates", getRadiologyServicesWithTemplates);

// POST /api/radiology-template - Create a new radiology template
router.post("/", createRadiologyTemplate);

// GET /api/radiology-template/:templateId - Get a single radiology template by ID
router.get("/:templateId", getRadiologyTestTemplateById);

// PUT /api/radiology-template/:templateId - Update a radiology template
router.put("/:templateId", updateRadiologyTemplate);

// DELETE /api/radiology-template/:templateId - Delete (soft delete) a radiology template
router.delete("/:templateId", deleteRadiologyTemplate);

// POST /api/radiology-template/link-service - Link a template to a service
router.post("/link-service", linkTemplateToService);

// POST /api/radiology-template/unlink-service - Unlink a template from a service
router.post("/unlink-service", unlinkTemplateFromService);

// GET /api/radiology-template/service-linking/:id - Get all templates with service link status (similar to listParametersWithServiceLinkController)
router.get("/service-linking/:id", listTemplatesWithServiceLinkController);

// PUT /api/radiology-template/service-linking/:id - Update service linked template (similar to updateServiceLinkedParametersController)
router.put("/service-linking/:id", updateServiceLinkedTemplateController);

module.exports = router;