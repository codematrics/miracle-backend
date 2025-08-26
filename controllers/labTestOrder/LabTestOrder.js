const LabOrderTest = require("../../models/LabOrderTest");

const listLabTestController = async (req, res) => {
  try {
    const {
      search = "",
      serviceHead = "",
      status = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const searchRegex = new RegExp(search, "i");

    const query = {};
    if (status) {
      query.status = status;
    }

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: "$service" },
      {
        $lookup: {
          from: "laborders",
          localField: "labOrderId",
          foreignField: "_id",
          as: "labOrder",
        },
      },
      { $unwind: "$labOrder" },
      {
        $lookup: {
          from: "patients",
          localField: "labOrder.patient",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      {
        $lookup: {
          from: "visits",
          localField: "labOrder.visit",
          foreignField: "_id",
          as: "visit",
        },
      },
      { $unwind: "$visit" },
      {
        $lookup: {
          from: "doctors",
          localField: "visit.consultingDoctorId",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...(search && { "service.serviceName": searchRegex }),
          ...(serviceHead && { "service.serviceHead": serviceHead }),
        },
      },

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          data: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await LabOrderTest.aggregate(pipeline);
    await LabOrderTest.populate(result, { path: "labOrder.patient" });
    const labTests = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return res.json({
      message: "Lab Test Orders fetched successfully",
      data: { total, page: pageNum, limit: limitNum, labTests },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getLabOrderParametersGroupedBySampleType = async (req, res) => {
  try {
    const { labOrderId } = req.params;

    // 1. Get all lab tests for this order
    const labTests = await LabOrderTest.find({ labOrderId }).populate({
      path: "serviceId",
      populate: {
        path: "linkedParameters",
        model: "LabParameter",
      },
    });

    if (!labTests.length) {
      return res.status(404).json({
        message: "No lab tests found for this order",
        status: false,
      });
    }

    // 2. Collect all parameters
    const parameters = [];
    labTests.forEach((test) => {
      if (test.serviceId?.linkedParameters?.length) {
        parameters.push(...test.serviceId.linkedParameters);
      }
    });

    // 3. Group by sampleType
    const grouped = parameters.reduce((acc, param) => {
      const key = param.sampleType || "Unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        _id: param._id,
        parameterName: param.parameterName,
        reportType: param.reportType,
        formatType: param.formatType,
        unit: param.unit,
        interpretationType: param.interpretationType,
        methodology: param.methodology,
      });
      return acc;
    }, {});

    return res.json({
      message: "Lab parameters grouped by sample type",
      data: grouped,
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

module.exports = {
  listLabTestController,
  getLabOrderParametersGroupedBySampleType,
};
