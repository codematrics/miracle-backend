const {
  createLabParameterSchema,
} = require("../../validations/labParameterSchema");
const LabParameter = require("../../models/LabParameter");
const BioReference = require("../../models/BioReference");

const createLabParameterController = async (req, res) => {
  try {
    const parsed = createLabParameterSchema.parse(req.body);

    // Save BioReferences separately if provided
    let bioRefs = [];
    if (parsed.bioReference && parsed.bioReference.length > 0) {
      bioRefs = await BioReference.insertMany(parsed.bioReference);
    }

    const newParam = new LabParameter({
      ...parsed,
      bioReference: bioRefs.map((b) => b._id),
    });

    await newParam.save();

    res.status(201).json({
      status: true,
      message: "Lab Parameter created successfully",
      data: newParam,
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
};

// 📌 Update Lab Parameter
const updateLabParameterController = async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = createLabParameterSchema.partial().parse(req.body);

    // If bioReference is updated, create new ones
    if (parsed.bioReference) {
      const bioRefs = await BioReference.insertMany(parsed.bioReference);
      parsed.bioReference = bioRefs.map((b) => b._id);
    }

    const updated = await LabParameter.findByIdAndUpdate(id, parsed, {
      new: true,
    }).populate("bioReference");

    if (!updated) {
      return res.status(404).json({
        status: false,
        message: "Lab Parameter not found",
      });
    }

    res.json({
      status: true,
      message: "Lab Parameter updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: error.message,
    });
  }
};

const deleteLabParameter = async (req, res) => {
  try {
    const { id } = req.params;

    const labParam = await LabParameter.findById(id);
    if (!labParam) {
      return res.status(404).json({
        status: false,
        message: "Lab Parameter not found",
      });
    }

    // Delete linked BioReferences if any
    if (labParam.bioReference && labParam.bioReference.length > 0) {
      await BioReference.deleteMany({ _id: { $in: labParam.bioReference } });
    }

    await LabParameter.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Lab Parameter and linked BioReferences deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// helpers
const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toBooleanish = (v) => {
  if (v === true || v === "true" || v === "1" || v === "active") return true;
  if (v === false || v === "false" || v === "0" || v === "inactive")
    return false;
  return undefined;
};

// 📌 Get Listing with Pagination & Search
const getLabParametersController = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      reportType = "",
      sampleType = "",
      formatType = "",
      status = "", // UI may send "active"/"inactive" or true/false
    } = req.query;

    page = Number.isFinite(+page) && +page > 0 ? +page : 1;
    limit = Number.isFinite(+limit) && +limit > 0 ? +limit : 10;

    const and = [];
    if (reportType) and.push({ reportType });
    if (sampleType) and.push({ sampleType });
    if (formatType) and.push({ formatType });

    // map "status" to the actual field in your docs: isActive
    const isActive = toBooleanish(status);
    if (typeof isActive === "boolean") and.push({ isActive });

    const or = [];
    const s = (search || "").trim();
    if (s) {
      const rx = new RegExp(escapeRegExp(s), "i");
      // search across desired fields (add/remove as needed)
      or.push(
        { parameterName: rx },
        { reportType: rx },
        { sampleType: rx },
        { formatType: rx },
        { methodology: rx }
      );
    }

    const query = {};
    if (and.length) query.$and = and;
    if (or.length) query.$or = or;

    const [total, parameters] = await Promise.all([
      LabParameter.countDocuments(query),
      LabParameter.find(query)
        .populate("bioReference")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      status: true,
      message: "Lab Parameters fetched successfully",
      data: { total, page, limit, parameters },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  createLabParameterController,
  updateLabParameterController,
  getLabParametersController,
  deleteLabParameter,
};
