const RadiologyTemplate = require("../../models/RadiologyTestTemplate");
const Service = require("../../models/Service");

// Create a new radiology template
const createRadiologyTemplate = async (req, res) => {
  try {
    const {
      templateName,
      templateContent,
      description,
      userId,
    } = req.body;

    // Validate required fields
    if (!templateName || !templateContent) {
      return res.status(400).json({
        message: "Template name and template content are required",
        status: false,
      });
    }

    // Check if template name already exists
    const existingTemplate = await RadiologyTemplate.findOne({
      templateName,
      isActive: true,
    });

    if (existingTemplate) {
      return res.status(409).json({
        message: "Template with this name already exists",
        status: false,
      });
    }

    const templateData = {
      templateName,
      templateContent,
      description,
    };
    
    if (userId) {
      templateData.createdBy = userId;
    }
    
    const newTemplate = new RadiologyTemplate(templateData);

    await newTemplate.save();

    return res.status(201).json({
      message: "Radiology template created successfully",
      data: newTemplate,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Get all radiology templates
const getRadiologyTemplates = async (req, res) => {
  try {
    const {
      search = "",
      isActive = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const query = {};

    // Search filter
    if (search) {
      query.templateName = { $regex: search, $options: "i" };
    }

    // Active status filter
    if (isActive !== "") {
      query.isActive = isActive === "true";
    }

    const templates = await RadiologyTemplate.find(query)
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await RadiologyTemplate.countDocuments(query);

    return res.json({
      message: "Radiology templates fetched successfully",
      data: {
        templates,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Get a single radiology test template by ID
const getRadiologyTestTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await RadiologyTestTemplate.findById(templateId)
      .populate("serviceId", "serviceName code headType")
      .populate("createdBy", "name")
      .populate("updatedBy", "name");

    if (!template) {
      return res.status(404).json({
        message: "Radiology test template not found",
        status: false,
      });
    }

    return res.json({
      message: "Radiology test template fetched successfully",
      data: template,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Update radiology test template
const updateRadiologyTestTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const {
      templateName,
      templateFields,
      defaultFindings,
      defaultImpression,
      isActive,
      userId,
    } = req.body;

    const template = await RadiologyTestTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        message: "Radiology test template not found",
        status: false,
      });
    }

    // Validate template fields if provided
    if (templateFields && Array.isArray(templateFields)) {
      const validFieldTypes = ["text", "textarea", "number", "select", "checkbox", "radio"];
      for (const field of templateFields) {
        if (!field.fieldName || !field.fieldType || !field.fieldLabel) {
          return res.status(400).json({
            message: "Each template field must have fieldName, fieldType, and fieldLabel",
            status: false,
          });
        }

        if (!validFieldTypes.includes(field.fieldType)) {
          return res.status(400).json({
            message: `Invalid field type: ${field.fieldType}`,
            status: false,
          });
        }

        // Validate options for select, radio, checkbox
        if (["select", "radio", "checkbox"].includes(field.fieldType)) {
          if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
            return res.status(400).json({
              message: `Field '${field.fieldName}' of type '${field.fieldType}' must have options`,
              status: false,
            });
          }
        }
      }

      // Sort template fields by order
      templateFields.sort((a, b) => (a.order || 0) - (b.order || 0));
      template.templateFields = templateFields;
    }

    // Check for duplicate template name if templateName is being updated
    if (templateName && templateName !== template.templateName) {
      const existingTemplate = await RadiologyTestTemplate.findOne({
        templateName,
        serviceId: template.serviceId,
        isActive: true,
        _id: { $ne: templateId },
      });

      if (existingTemplate) {
        return res.status(409).json({
          message: "Template with this name already exists for this service",
          status: false,
        });
      }
      template.templateName = templateName;
    }

    // Update other fields
    if (defaultFindings !== undefined) template.defaultFindings = defaultFindings;
    if (defaultImpression !== undefined) template.defaultImpression = defaultImpression;
    if (isActive !== undefined) template.isActive = isActive;
    if (userId) template.updatedBy = userId;

    await template.save();

    // Populate service details
    await template.populate("serviceId", "serviceName code headType");
    await template.populate("updatedBy", "name");

    return res.json({
      message: "Radiology test template updated successfully",
      data: template,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Delete radiology test template (soft delete)
const deleteRadiologyTestTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { userId } = req.body;

    const template = await RadiologyTestTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        message: "Radiology test template not found",
        status: false,
      });
    }

    // Soft delete by setting isActive to false
    template.isActive = false;
    template.updatedBy = userId;
    await template.save();

    return res.json({
      message: "Radiology test template deleted successfully",
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Get templates by service ID
const getTemplatesByServiceId = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const templates = await RadiologyTestTemplate.find({
      serviceId,
      isActive: true,
    })
      .populate("serviceId", "serviceName code headType")
      .select("templateName templateFields defaultFindings defaultImpression")
      .sort({ templateName: 1 });

    return res.json({
      message: "Templates for service fetched successfully",
      data: templates,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Get active radiology services (for dropdown)
const getRadiologyServices = async (req, res) => {
  try {
    const services = await Service.find({
      headType: "Radiology",
      isActive: true,
    })
      .select("serviceName code headType")
      .sort({ serviceName: 1 });

    return res.json({
      message: "Radiology services fetched successfully",
      data: services,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Link template to service
const linkTemplateToService = async (req, res) => {
  try {
    const { serviceId, templateId, userId } = req.body;

    if (!serviceId || !templateId) {
      return res.status(400).json({
        message: "Service ID and template ID are required",
        status: false,
      });
    }

    // Validate service exists and is radiology type
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        message: "Service not found",
        status: false,
      });
    }

    if (service.headType !== "Radiology") {
      return res.status(400).json({
        message: "Service must be of Radiology type",
        status: false,
      });
    }

    // Validate template exists
    const template = await RadiologyTemplate.findById(templateId);
    if (!template || !template.isActive) {
      return res.status(404).json({
        message: "Template not found or inactive",
        status: false,
      });
    }

    // Update service with linked template
    service.linkedTemplate = templateId;
    await service.save();

    // Populate template details
    await service.populate("linkedTemplate", "templateName description");

    return res.json({
      message: "Template linked to service successfully",
      data: {
        serviceId,
        serviceName: service.serviceName,
        linkedTemplate: service.linkedTemplate,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Remove template from service
const unlinkTemplateFromService = async (req, res) => {
  try {
    const { serviceId, userId } = req.body;

    if (!serviceId) {
      return res.status(400).json({
        message: "Service ID is required",
        status: false,
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        message: "Service not found",
        status: false,
      });
    }

    service.linkedTemplate = null;
    await service.save();

    return res.json({
      message: "Template unlinked from service successfully",
      data: {
        serviceId,
        serviceName: service.serviceName,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Get radiology services with their linked templates
const getRadiologyServicesWithTemplates = async (req, res) => {
  try {
    const services = await Service.find({
      headType: "Radiology",
      isActive: true,
    })
      .populate("linkedTemplate", "templateName description")
      .select("serviceName code headType linkedTemplate")
      .sort({ serviceName: 1 });

    return res.json({
      message: "Radiology services with templates fetched successfully",
      data: services,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// List templates with service link status (similar to listParametersWithServiceLinkController)
const listTemplatesWithServiceLinkController = async (req, res) => {
  try {
    const { id } = req.params; // service ID

    if (!id) {
      return res.status(400).json({
        message: "Service ID is required",
        data: null,
        status: false,
      });
    }

    const service = await Service.findById(id).populate("linkedTemplate");

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
        data: null,
        status: false,
      });
    }

    if (service.headType !== "Radiology") {
      return res.status(400).json({
        message: "Service must be of Radiology type",
        data: null,
        status: false,
      });
    }

    // Get all active radiology templates
    const allTemplates = await RadiologyTemplate.find({ isActive: true })
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ templateName: 1 });

    // Add isLinked flag to each template
    const templatesWithFlag = allTemplates.map((template) => ({
      ...template.toObject(),
      isLinked: service.linkedTemplate?._id?.toString() === template._id.toString(),
    }));

    // Sort linked template first
    templatesWithFlag.sort((a, b) => {
      if (a.isLinked === b.isLinked) return 0;
      return a.isLinked ? -1 : 1;
    });

    return res.json({
      message: "Templates with service link status fetched successfully",
      data: {
        service: {
          _id: service._id,
          serviceName: service.serviceName,
          code: service.code,
          headType: service.headType,
        },
        templates: templatesWithFlag,
      },
      status: true,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Update service linked template (similar to updateServiceLinkedParametersController)
const updateServiceLinkedTemplateController = async (req, res) => {
  try {
    const { id } = req.params; // service ID
    const { templateId, userId } = req.body;

    // Validation
    if (!id) {
      return res.status(400).json({
        message: "Service ID is required",
        data: null,
        status: false,
      });
    }

    // Find service
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        message: "Service not found",
        data: null,
        status: false,
      });
    }

    if (service.headType !== "Radiology") {
      return res.status(400).json({
        message: "Service must be of Radiology type",
        data: null,
        status: false,
      });
    }

    // If templateId is provided, validate it exists and is active
    if (templateId) {
      const template = await RadiologyTemplate.findById(templateId);
      if (!template || !template.isActive) {
        return res.status(404).json({
          message: "Template not found or inactive",
          data: null,
          status: false,
        });
      }
      service.linkedTemplate = templateId;
    } else {
      // If templateId is null/undefined, unlink the template
      service.linkedTemplate = null;
    }

    await service.save();

    // Populate template details for response
    await service.populate("linkedTemplate", "templateName description");

    return res.json({
      message: templateId 
        ? "Template linked to service successfully" 
        : "Template unlinked from service successfully",
      data: {
        serviceId: service._id,
        serviceName: service.serviceName,
        code: service.code,
        linkedTemplate: service.linkedTemplate,
      },
      status: true,
    });
  } catch (error) {
    console.error("Error updating linked template:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

module.exports = {
  createRadiologyTemplate,
  getRadiologyTemplates,
  getRadiologyTestTemplateById: async (req, res) => {
    try {
      const { templateId } = req.params;

      const template = await RadiologyTemplate.findById(templateId)
        .populate("createdBy", "name")
        .populate("updatedBy", "name");

      if (!template) {
        return res.status(404).json({
          message: "Template not found",
          status: false,
        });
      }

      return res.json({
        message: "Template fetched successfully",
        data: template,
        status: true,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Server error",
        data: null,
        status: false,
      });
    }
  },
  updateRadiologyTemplate: async (req, res) => {
    try {
      const { templateId } = req.params;
      const { templateName, templateContent, description, isActive, userId } = req.body;

      const template = await RadiologyTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({
          message: "Template not found",
          status: false,
        });
      }

      // Check for duplicate name if changing
      if (templateName && templateName !== template.templateName) {
        const existingTemplate = await RadiologyTemplate.findOne({
          templateName,
          isActive: true,
          _id: { $ne: templateId },
        });

        if (existingTemplate) {
          return res.status(409).json({
            message: "Template with this name already exists",
            status: false,
          });
        }
        template.templateName = templateName;
      }

      if (templateContent) template.templateContent = templateContent;
      if (description !== undefined) template.description = description;
      if (isActive !== undefined) template.isActive = isActive;
      if (userId) template.updatedBy = userId;

      await template.save();

      return res.json({
        message: "Template updated successfully",
        data: template,
        status: true,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Server error",
        data: null,
        status: false,
      });
    }
  },
  deleteRadiologyTemplate: async (req, res) => {
    try {
      const { templateId } = req.params;
      const { userId } = req.body;

      const template = await RadiologyTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({
          message: "Template not found",
          status: false,
        });
      }

      template.isActive = false;
      template.updatedBy = userId;
      await template.save();

      return res.json({
        message: "Template deleted successfully",
        status: true,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Server error",
        data: null,
        status: false,
      });
    }
  },
  linkTemplateToService,
  unlinkTemplateFromService,
  getRadiologyServicesWithTemplates,
  listTemplatesWithServiceLinkController,
  updateServiceLinkedTemplateController,
};