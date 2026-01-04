const Examinations = require("../../models/Examinations");
const {
  primaryExaminationZodSchema,
} = require("../../validations/examinationSchema");

const createPrimaryExamination = async (req, res) => {
  try {
    const parsed = primaryExaminationZodSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const examination = await Examinations.create({
      ...parsed.data,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      status: true,
      message: "Primary examination saved successfully",
      data: examination,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Failed to save primary examination",
    });
  }
};

module.exports = { createPrimaryExamination };
