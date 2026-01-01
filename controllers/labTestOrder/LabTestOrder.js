const LabOrderTest = require("../../models/LabOrderTest");
const LabResult = require("../../models/LabResult");
const RadiologyReport = require("../../models/RadioLogyReport");
const PdfPrinter = require("pdfmake");
const path = require("path");
const { ROLES } = require("../../constants/enums");
const { htmlToText } = require("html-to-text");

const listLabTestController = async (req, res) => {
  try {
    const { doctor, user } = req;
    const {
      search = "",
      headType = "",
      status = "",
      from = "",
      to = "",
      mobileNo = "",
      uhid = "",
      patientName = "",
      reportType = "",
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

    // if (user.role === ROLES.DOCTOR) {
    //   query["labOrderId.doctor"] = doctor._id;
    // }

    // Date range filter
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        query.createdAt.$lte = new Date(to + "T23:59:59.999Z");
      }
    }

    const pipeline = [
      {
        $match: query,
      },
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
        $lookup: {
          from: "labparameters",
          localField: "service.linkedParameters",
          foreignField: "_id",
          as: "parameters",
        },
      },
      {
        $match: {
          ...(search && { "service.serviceName": searchRegex }),
          ...(headType && { "service.headType": headType }),
          ...(mobileNo && {
            "patient.contactNumber": { $regex: mobileNo, $options: "i" },
          }),
          ...(uhid && {
            $or: [
              { "patient.uhidNo": { $regex: uhid, $options: "i" } },
              { "patient.patientId": { $regex: uhid, $options: "i" } },
            ],
          }),
          ...(patientName && {
            "patient.name": { $regex: patientName, $options: "i" },
          }),
          ...(reportType && { "parameters.reportType": reportType }),
          ...(user.role === ROLES.DOCTOR && {
            "doctor._id": doctor._id,
          }),
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

const collectTheTestOrder = async (req, res) => {
  try {
    const { labTestOrderId, sampleTypes } = req.body;

    if (
      !labTestOrderId ||
      !sampleTypes ||
      !Array.isArray(sampleTypes) ||
      sampleTypes.length === 0
    ) {
      return res.status(400).json({
        message: "Lab test order ID and sample types array are required",
        status: false,
      });
    }

    const labTestOrder = await LabOrderTest.findById(labTestOrderId).populate({
      path: "serviceId",
      populate: {
        path: "linkedParameters",
        model: "LabParameter",
      },
    });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    // Get required sample types from linked parameters
    const requiredSampleTypes = [
      ...new Set(
        labTestOrder.serviceId.linkedParameters
          .filter((param) => param.sampleType)
          .map((param) => param.sampleType)
      ),
    ];

    // Check if all sample types are valid for this test
    const invalidSampleTypes = sampleTypes.filter(
      (sampleType) => !requiredSampleTypes.includes(sampleType)
    );

    if (invalidSampleTypes.length > 0) {
      return res.status(400).json({
        message: `Sample types [${invalidSampleTypes.join(
          ", "
        )}] are not required for this test`,
        status: false,
      });
    }

    // Add samples to collected samples if not already collected
    sampleTypes.forEach((sampleType) => {
      if (!labTestOrder.collectedSamples.includes(sampleType)) {
        labTestOrder.collectedSamples.push(sampleType);
      }
    });

    // Check if all required samples are collected
    const allSamplesCollected = requiredSampleTypes.every((sampleType) =>
      labTestOrder.collectedSamples.includes(sampleType)
    );

    // Update status if all samples collected
    if (allSamplesCollected && labTestOrder.status === "pending") {
      labTestOrder.status = "collected";
      // labTestOrder.collectedBy = userId;
    }

    await labTestOrder.save();

    return res.json({
      message: "Sample collected successfully",
      data: {
        labTestOrder,
        requiredSampleTypes,
        collectedSamples: labTestOrder.collectedSamples,
        allSamplesCollected,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listCollectedLabTestController = async (req, res) => {
  try {
    const { search = "", headType = "", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const searchRegex = new RegExp(search, "i");

    const query = { status: "collected" };

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
          ...(headType && { "service.headType": headType }),
        },
      },

      { $sort: { collectedAt: -1 } },

      {
        $facet: {
          data: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await LabOrderTest.aggregate(pipeline);
    const collectedLabTests = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return res.json({
      message: "Collected Lab Test Orders fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        labTests: collectedLabTests,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getLabParametersByTestOrder = async (req, res) => {
  try {
    const { labTestOrderId } = req.query;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        status: false,
      });
    }

    const labTestOrder = await LabOrderTest.findById(labTestOrderId)
      .populate({
        path: "serviceId",
        populate: {
          path: "linkedParameters",
          model: "LabParameter",
          populate: {
            path: "bioReference",
            model: "BioReference",
          },
        },
      })
      .populate({
        path: "labOrderId",
        populate: {
          path: "patient",
          model: "Patient",
        },
      });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    const patient = labTestOrder.labOrderId?.patient;
    const parameters = labTestOrder.serviceId?.linkedParameters || [];

    // Filter bio references based on patient demographics
    const parametersWithFilteredRefs = parameters.map((parameter) => {
      if (!parameter.bioReference || !patient) {
        return parameter;
      }

      const filteredBioReferences = parameter.bioReference.filter((bioRef) => {
        // Check gender match
        const genderMatch =
          bioRef.gender === "All" || bioRef.gender === patient.gender;

        if (!genderMatch) return false;

        // Check age match
        if (patient.age !== null && patient.age !== undefined) {
          const patientAgeInYears = patient.age;

          // Convert bioRef age range to years for comparison
          let ageFromInYears, ageToInYears;

          switch (bioRef.ageType) {
            case "Year":
              ageFromInYears = bioRef.ageFrom;
              ageToInYears = bioRef.ageTo;
              break;
            case "Month":
              ageFromInYears = bioRef.ageFrom / 12;
              ageToInYears = bioRef.ageTo / 12;
              break;
            case "Day":
              ageFromInYears = bioRef.ageFrom / 365.25;
              ageToInYears = bioRef.ageTo / 365.25;
              break;
            default:
              ageFromInYears = bioRef.ageFrom;
              ageToInYears = bioRef.ageTo;
          }

          const ageMatch =
            patientAgeInYears >= ageFromInYears &&
            patientAgeInYears <= ageToInYears;
          return ageMatch;
        }

        return true; // If no age, include all age ranges
      });

      return {
        ...parameter.toObject(),
        bioReference: filteredBioReferences,
        applicableBioRefCount: filteredBioReferences.length,
      };
    });

    return res.json({
      message: "Lab parameters fetched successfully",
      data: {
        labTestOrderId,
        serviceName: labTestOrder.serviceId?.serviceName,
        serviceHead: labTestOrder.serviceId?.serviceHead,
        headType: labTestOrder.serviceId?.headType,
        patient: {
          _id: patient?._id,
          name: patient?.name,
          gender: patient?.gender,
          dateOfBirth: patient?.dateOfBirth,
          age: patient?.age,
        },
        parameters: parametersWithFilteredRefs,
        totalParameters: parameters.length,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getLabParametersGroupedByReportType = async (req, res) => {
  try {
    const { labTestOrderId } = req.query;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        status: false,
      });
    }

    const labTestOrder = await LabOrderTest.findById(labTestOrderId)
      .populate({
        path: "serviceId",
        populate: {
          path: "linkedParameters",
          model: "LabParameter",
          populate: {
            path: "bioReference",
            model: "BioReference",
          },
        },
      })
      .populate({
        path: "labOrderId",
        populate: {
          path: "patient",
          model: "Patient",
        },
      });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    const patient = labTestOrder.labOrderId?.patient;
    const parameters = labTestOrder.serviceId?.linkedParameters || [];

    // Helper function to convert bioRef age range to years
    const convertAgeToYears = (age, ageType) => {
      switch (ageType) {
        case "Year":
          return age;
        case "Month":
          return age / 12;
        case "Day":
          return age / 365.25;
        default:
          return age;
      }
    };

    // Filter bio references and group parameters by reportType
    const parametersGroupedByReportType = parameters.reduce(
      (acc, parameter) => {
        const reportType = parameter.reportType || "Unknown";

        // Filter bio references based on patient demographics
        let filteredBioReferences = parameter.bioReference || [];

        if (patient && parameter.bioReference) {
          filteredBioReferences = parameter.bioReference.filter((bioRef) => {
            // Check gender match
            const genderMatch =
              bioRef.gender === "All" || bioRef.gender === patient.gender;
            if (!genderMatch) return false;

            // Check age match
            if (patient.age !== null && patient.age !== undefined) {
              const ageFromInYears = convertAgeToYears(
                bioRef.ageFrom,
                bioRef.ageType
              );
              const ageToInYears = convertAgeToYears(
                bioRef.ageTo,
                bioRef.ageType
              );
              const ageMatch =
                patient.age >= ageFromInYears && patient.age <= ageToInYears;
              return ageMatch;
            }

            return true;
          });
        }

        // Create parameter object with filtered bio references
        const parameterWithFilteredRefs = {
          ...parameter.toObject(),
          bioReference: filteredBioReferences,
          applicableBioRefCount: filteredBioReferences.length,
        };

        // Group by reportType
        if (!acc[reportType]) {
          acc[reportType] = {
            reportType,
            parameters: [],
            parameterCount: 0,
          };
        }

        acc[reportType].parameters.push(parameterWithFilteredRefs);
        acc[reportType].parameterCount++;

        return acc;
      },
      {}
    );

    return res.json({
      message: "Lab parameters grouped by report type fetched successfully",
      data: {
        labTestOrderId,
        serviceName: labTestOrder.serviceId?.serviceName,
        serviceHead: labTestOrder.serviceId?.serviceHead,
        headType: labTestOrder.serviceId?.headType,
        patient: {
          _id: patient?._id,
          name: patient?.name,
          gender: patient?.gender,
          dateOfBirth: patient?.dateOfBirth,
          age: patient?.age,
        },
        reportTypeGroups: parametersGroupedByReportType,
        totalReportTypes: Object.keys(parametersGroupedByReportType).length,
        totalParameters: parameters.length,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listSavedLabTestController = async (req, res) => {
  try {
    const {
      search = "",
      headType = "",
      from = "",
      to = "",
      mobileNo = "",
      uhid = "",
      patientName = "",
      reportType = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const searchRegex = new RegExp(search, "i");

    const query = { status: "saved" };

    // Date range filter
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        query.createdAt.$lte = new Date(to + "T23:59:59.999Z");
      }
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
        $lookup: {
          from: "labparameters",
          localField: "service.linkedParameters",
          foreignField: "_id",
          as: "parameters",
        },
      },
      {
        $match: {
          ...(search && { "service.serviceName": searchRegex }),
          ...(headType && { "service.headType": headType }),
          ...(mobileNo && {
            "patient.contactNumber": { $regex: mobileNo, $options: "i" },
          }),
          ...(uhid && {
            $or: [
              { "patient.uhidNo": { $regex: uhid, $options: "i" } },
              { "patient.patientId": { $regex: uhid, $options: "i" } },
            ],
          }),
          ...(patientName && {
            "patient.name": { $regex: patientName, $options: "i" },
          }),
          ...(reportType && { "parameters.reportType": reportType }),
        },
      },

      { $sort: { savedAt: -1 } },

      {
        $facet: {
          data: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await LabOrderTest.aggregate(pipeline);
    const savedLabTests = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return res.json({
      message: "Saved Lab Test Orders fetched successfully",
      data: { total, page: pageNum, limit: limitNum, labTests: savedLabTests },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listAuthorizedLabTestController = async (req, res) => {
  try {
    const {
      search = "",
      headType = "",
      from = "",
      to = "",
      mobileNo = "",
      uhid = "",
      patientName = "",
      reportType = "",
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const searchRegex = new RegExp(search, "i");

    const query = { status: "authorized" };

    // Date range filter
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        query.createdAt.$lte = new Date(to + "T23:59:59.999Z");
      }
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
        $lookup: {
          from: "labparameters",
          localField: "service.linkedParameters",
          foreignField: "_id",
          as: "parameters",
        },
      },
      {
        $match: {
          ...(search && { "service.serviceName": searchRegex }),
          ...(headType && { "service.headType": headType }),
          ...(mobileNo && {
            "patient.contactNumber": { $regex: mobileNo, $options: "i" },
          }),
          ...(uhid && {
            $or: [
              { "patient.uhidNo": { $regex: uhid, $options: "i" } },
              { "patient.patientId": { $regex: uhid, $options: "i" } },
            ],
          }),
          ...(patientName && {
            "patient.name": { $regex: patientName, $options: "i" },
          }),
          ...(reportType && { "parameters.reportType": reportType }),
        },
      },

      { $sort: { authorizedAt: -1 } },

      {
        $facet: {
          data: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await LabOrderTest.aggregate(pipeline);
    const authorizedLabTests = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return res.json({
      message: "Authorized Lab Test Orders fetched successfully",
      data: { total, page: pageNum, limit: limitNum, authorizedLabTests },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getLabParametersWithResults = async (req, res) => {
  try {
    const { labTestOrderId } = req.query;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        status: false,
      });
    }

    const labTestOrder = await LabOrderTest.findById(labTestOrderId)
      .populate({
        path: "serviceId",
        populate: {
          path: "linkedParameters",
          model: "LabParameter",
          populate: {
            path: "bioReference",
            model: "BioReference",
          },
        },
      })
      .populate({
        path: "labOrderId",
        populate: {
          path: "patient",
          model: "Patient",
        },
      });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    const patient = labTestOrder.labOrderId?.patient;
    const parameters = labTestOrder.serviceId?.linkedParameters || [];

    // Get saved results for this lab test order
    const savedResults = await LabResult.find({
      labOrderTestId: labTestOrderId,
    });

    // Create a map of parameterId -> result value for quick lookup
    const resultsMap = savedResults.reduce((acc, result) => {
      acc[result.parameterId.toString()] = result.value;
      return acc;
    }, {});

    // Helper function to convert bioRef age range to years
    const convertAgeToYears = (age, ageType) => {
      switch (ageType) {
        case "Year":
          return age;
        case "Month":
          return age / 12;
        case "Day":
          return age / 365.25;
        default:
          return age;
      }
    };

    // Filter bio references, add results, and group parameters by reportType
    const parametersGroupedByReportType = parameters.reduce(
      (acc, parameter) => {
        const reportType = parameter.reportType || "Unknown";

        // Filter bio references based on patient demographics
        let filteredBioReferences = parameter.bioReference || [];

        if (patient && parameter.bioReference) {
          filteredBioReferences = parameter.bioReference.filter((bioRef) => {
            // Check gender match
            const genderMatch =
              bioRef.gender === "All" || bioRef.gender === patient.gender;
            if (!genderMatch) return false;

            // Check age match
            if (patient.age !== null && patient.age !== undefined) {
              const ageFromInYears = convertAgeToYears(
                bioRef.ageFrom,
                bioRef.ageType
              );
              const ageToInYears = convertAgeToYears(
                bioRef.ageTo,
                bioRef.ageType
              );
              const ageMatch =
                patient.age >= ageFromInYears && patient.age <= ageToInYears;
              return ageMatch;
            }

            return true;
          });
        }

        // Create parameter object with filtered bio references and result value
        const parameterWithResultsAndRefs = {
          ...parameter.toObject(),
          bioReference: filteredBioReferences,
          applicableBioRefCount: filteredBioReferences.length,
          resultValue: resultsMap[parameter._id.toString()] || null,
          hasResult: !!resultsMap[parameter._id.toString()],
        };

        // Group by reportType
        if (!acc[reportType]) {
          acc[reportType] = {
            reportType,
            parameters: [],
            parameterCount: 0,
          };
        }

        acc[reportType].parameters.push(parameterWithResultsAndRefs);
        acc[reportType].parameterCount++;

        return acc;
      },
      {}
    );

    return res.json({
      message:
        "Lab parameters with results grouped by report type fetched successfully",
      data: {
        labTestOrderId,
        serviceName: labTestOrder.serviceId?.serviceName,
        serviceHead: labTestOrder.serviceId?.serviceHead,
        headType: labTestOrder.serviceId?.headType,
        status: labTestOrder.status,
        patient: {
          _id: patient?._id,
          name: patient?.name,
          gender: patient?.gender,
          dateOfBirth: patient?.dateOfBirth,
          age: patient?.age,
        },
        reportTypeGroups: parametersGroupedByReportType,
        totalReportTypes: Object.keys(parametersGroupedByReportType).length,
        totalParameters: parameters.length,
        totalResults: savedResults.length,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const saveLabTestResults = async (req, res) => {
  try {
    const { labTestOrderId, resultsByReportType, userId } = req.body;

    if (!labTestOrderId || !resultsByReportType) {
      return res.status(400).json({
        message: "Lab test order ID and results are required",
        status: false,
      });
    }

    // Verify lab test order exists
    const labTestOrder = await LabOrderTest.findById(labTestOrderId);
    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    // Check if lab test order is in collected status
    if (labTestOrder.status !== "collected") {
      return res.status(400).json({
        message: "Lab test order must be in 'collected' status to save results",
        status: false,
      });
    }

    const savedResults = [];
    const errors = [];

    // Process results by report type
    for (const [reportType, parameters] of Object.entries(
      resultsByReportType
    )) {
      for (const paramData of parameters) {
        try {
          const { parameterId, parameterValue } = paramData;

          if (
            !parameterId ||
            parameterValue === undefined ||
            parameterValue === null
          ) {
            errors.push(
              `Invalid data for parameter in ${reportType}: missing parameterId or parameterValue`
            );
            continue;
          }

          // Check if result already exists, update if it does, create if it doesn't
          const existingResult = await LabResult.findOne({
            labOrderTestId: labTestOrderId,
            parameterId: parameterId,
          });

          if (existingResult) {
            // Update existing result
            existingResult.value = parameterValue;
            await existingResult.save();
            savedResults.push(existingResult);
          } else {
            // Create new result
            const newResult = new LabResult({
              labOrderTestId: labTestOrderId,
              parameterId: parameterId,
              value: parameterValue,
            });
            await newResult.save();
            savedResults.push(newResult);
          }
        } catch (error) {
          errors.push(
            `Error saving parameter ${paramData.parameterId}: ${error.message}`
          );
        }
      }
    }

    // Update lab test order status to 'saved' if all results were saved successfully
    if (errors.length === 0) {
      labTestOrder.status = "saved";
      // labTestOrder.savedBy = userId;
      await labTestOrder.save();
    }

    return res.json({
      message:
        errors.length === 0
          ? "Lab test results saved successfully"
          : "Lab test results saved with some errors",
      data: {
        labTestOrderId,
        savedResults: savedResults.length,
        totalResults: savedResults.length + errors.length,
        status: errors.length === 0 ? "saved" : labTestOrder.status,
        errors: errors.length > 0 ? errors : undefined,
      },
      status: errors.length === 0,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getLabOrderTestReportTypes = async (req, res) => {
  try {
    const { labTestOrderId } = req.query;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        status: false,
      });
    }

    const labTestOrder = await LabOrderTest.findById(labTestOrderId).populate({
      path: "serviceId",
      populate: {
        path: "linkedParameters",
        model: "LabParameter",
      },
    });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    const parameters = labTestOrder.serviceId?.linkedParameters || [];

    // Get unique report types
    const reportTypes = [
      ...new Set(
        parameters
          .map((parameter) => parameter.reportType)
          .filter((reportType) => reportType) // Remove null/undefined values
      ),
    ];

    // Create report type summary with counts
    const reportTypeSummary = reportTypes.map((reportType) => {
      const parametersInType = parameters.filter(
        (param) => param.reportType === reportType
      );
      return {
        reportType,
        parameterCount: parametersInType.length,
      };
    });

    return res.json({
      message: "Lab order test report types fetched successfully",
      data: {
        labTestOrderId,
        serviceName: labTestOrder.serviceId?.serviceName,
        serviceHead: labTestOrder.serviceId?.serviceHead,
        headType: labTestOrder.serviceId?.headType,
        reportTypes,
        reportTypeSummary,
        totalReportTypes: reportTypes.length,
        totalParameters: parameters.length,
      },
      status: true,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const saveAndAuthorizeLabTestResults = async (req, res) => {
  try {
    const { labTestOrderId, resultsByReportType, userId } = req.body;

    if (!labTestOrderId || !resultsByReportType) {
      return res.status(400).json({
        message: "Lab test order ID and results are required",
        status: false,
      });
    }

    // Verify lab test order exists
    const labTestOrder = await LabOrderTest.findById(labTestOrderId);
    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    // Check if lab test order is in saved status for authorization
    if (labTestOrder.status !== "saved") {
      return res.status(400).json({
        message:
          "Lab test order must be in 'saved' status to authorize results",
        status: false,
      });
    }

    const savedResults = [];
    const errors = [];

    // Process results by report type
    for (const [reportType, parameters] of Object.entries(
      resultsByReportType
    )) {
      for (const paramData of parameters) {
        try {
          const { parameterId, parameterValue } = paramData;

          if (
            !parameterId ||
            parameterValue === undefined ||
            parameterValue === null
          ) {
            errors.push(
              `Invalid data for parameter in ${reportType}: missing parameterId or parameterValue`
            );
            continue;
          }

          // Check if result already exists, update if it does, create if it doesn't
          const existingResult = await LabResult.findOne({
            labOrderTestId: labTestOrderId,
            parameterId: parameterId,
          });

          if (existingResult) {
            // Update existing result
            existingResult.value = parameterValue;
            await existingResult.save();
            savedResults.push(existingResult);
          } else {
            // Create new result
            const newResult = new LabResult({
              labOrderTestId: labTestOrderId,
              parameterId: parameterId,
              value: parameterValue,
            });
            await newResult.save();
            savedResults.push(newResult);
          }
        } catch (error) {
          errors.push(
            `Error saving parameter ${paramData.parameterId}: ${error.message}`
          );
        }
      }
    }

    // Update lab test order status to 'authorized' if all results were saved successfully
    if (errors.length === 0) {
      labTestOrder.status = "authorized";
      labTestOrder.authorizedBy = userId;
      await labTestOrder.save();
    }

    return res.json({
      message:
        errors.length === 0
          ? "Lab test results saved and authorized successfully"
          : "Lab test results saved with some errors",
      data: {
        labTestOrderId,
        savedResults: savedResults.length,
        totalResults: savedResults.length + errors.length,
        status: errors.length === 0 ? "authorized" : labTestOrder.status,
        errors: errors.length > 0 ? errors : undefined,
      },
      status: errors.length === 0,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const printLabTestOrder = async (req, res) => {
  try {
    const { labTestOrderId, reportType, printType = "combined" } = req.query;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        status: false,
      });
    }

    // Validate printType
    if (!["combined", "separate"].includes(printType)) {
      return res.status(400).json({
        message: "Print type must be 'combined' or 'separate'",
        status: false,
      });
    }

    const labTestOrder = await LabOrderTest.findById(labTestOrderId)
      .populate({
        path: "serviceId",
        populate: {
          path: "linkedParameters",
          model: "LabParameter",
          populate: {
            path: "bioReference",
            model: "BioReference",
          },
        },
      })
      .populate({
        path: "labOrderId",
        populate: [
          {
            path: "patient",
            model: "Patient",
          },
          {
            path: "visit",
            model: "Visit",
            populate: {
              path: "consultingDoctorId",
              model: "Doctor",
            },
          },
        ],
      });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    // Check if lab test order has results (should be authorized for printing)
    if (labTestOrder.status !== "authorized") {
      return res.status(400).json({
        message: "Lab test order must be authorized to print results",
        status: false,
      });
    }

    const patient = labTestOrder.labOrderId?.patient;
    const visit = labTestOrder.labOrderId?.visit;
    const doctor = visit?.consultingDoctorId;
    const parameters = labTestOrder.serviceId?.linkedParameters || [];

    // Get saved results for this lab test order
    const savedResults = await LabResult.find({
      labOrderTestId: labTestOrderId,
    });

    // Create a map of parameterId -> result value for quick lookup
    const resultsMap = savedResults.reduce((acc, result) => {
      acc[result.parameterId.toString()] = result.value;
      return acc;
    }, {});

    // Helper function to convert bioRef age range to years
    const convertAgeToYears = (age, ageType) => {
      switch (ageType) {
        case "Year":
          return age;
        case "Month":
          return age / 12;
        case "Day":
          return age / 365.25;
        default:
          return age;
      }
    };

    // Filter parameters by report type if specified
    let filteredParameters = parameters;
    if (reportType && reportType !== "all") {
      filteredParameters = parameters.filter(
        (param) => param.reportType === reportType
      );
    }

    // Process parameters with results and bio references
    const processedParameters = filteredParameters.map((parameter) => {
      // Filter bio references based on patient demographics
      let filteredBioReferences = parameter.bioReference || [];

      if (patient && parameter.bioReference) {
        filteredBioReferences = parameter.bioReference.filter((bioRef) => {
          const genderMatch =
            bioRef.gender === "All" || bioRef.gender === patient.gender;
          if (!genderMatch) return false;

          if (patient.age !== null && patient.age !== undefined) {
            const ageFromInYears = convertAgeToYears(
              bioRef.ageFrom,
              bioRef.ageType
            );
            const ageToInYears = convertAgeToYears(
              bioRef.ageTo,
              bioRef.ageType
            );
            const ageMatch =
              patient.age >= ageFromInYears && patient.age <= ageToInYears;
            return ageMatch;
          }

          return true;
        });
      }

      return {
        ...parameter.toObject(),
        bioReference: filteredBioReferences,
        resultValue: resultsMap[parameter._id.toString()] || null,
        hasResult: !!resultsMap[parameter._id.toString()],
      };
    });

    // Group by report type for organized printing
    const parametersGroupedByReportType = processedParameters.reduce(
      (acc, parameter) => {
        const type = parameter.reportType || "Unknown";
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(parameter);
        return acc;
      },
      {}
    );

    // --- PDF Setup ---
    const fonts = {
      Roboto: {
        normal: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-Regular.ttf"
        ),
        bold: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-Medium.ttf"
        ),
        italics: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-Italic.ttf"
        ),
        bolditalics: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-MediumItalic.ttf"
        ),
      },
    };
    const printer = new PdfPrinter(fonts);

    // Prepare lab test report data
    const labReportData = {
      UHID: patient?.uhidNo || patient?.patientId || "N/A",
      visitNo: visit?.code || visit?._id || "N/A",
      testDate: labTestOrder.createdAt.toDateString(),
      collectedDate: labTestOrder.collectedAt
        ? new Date(labTestOrder.collectedAt).toDateString()
        : "N/A",
      authorizedDate: labTestOrder.authorizedAt
        ? new Date(labTestOrder.authorizedAt).toDateString()
        : "N/A",
      patientName: patient?.name || "N/A",
      age: patient?.age || "N/A",
      gender: patient?.gender || "N/A",
      mobile: patient?.contactNumber || "N/A",
      address: patient?.address || "N/A",
      doctorName: doctor?.name || "N/A",
      qualification: doctor?.qualification || "N/A",
      serviceName: labTestOrder.serviceId?.serviceName,
      serviceCode: labTestOrder.serviceId?.code,
      parametersGroupedByReportType,
    };

    // --- PDF Definition ---
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 40],
      content: [
        // Header Image
        {
          image: path.join(__dirname, "../../assets/header_prescription.jpg"),
          width: 480,
          alignment: "center",
        },
        { text: "\n" },

        // Lab Report Title
        {
          text: "LABORATORY REPORT",
          style: "reportTitle",
          alignment: "center",
          margin: [0, 0, 0, 20],
        },

        // Patient Info Section
        {
          columns: [
            {
              width: "50%",
              stack: [
                {
                  text: "PATIENT INFORMATION",
                  style: "sectionHeader",
                  margin: [0, 0, 0, 8],
                },
                {
                  text: [
                    { text: "UHID: ", style: "labelBold" },
                    { text: labReportData.UHID, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Patient Name: ", style: "labelBold" },
                    { text: labReportData.patientName, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Age/Gender: ", style: "labelBold" },
                    {
                      text: `${labReportData.age} / ${labReportData.gender}`,
                      style: "normalText",
                    },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Mobile: ", style: "labelBold" },
                    { text: labReportData.mobile, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
              ],
            },
            {
              width: "50%",
              stack: [
                {
                  text: "TEST INFORMATION",
                  style: "sectionHeader",
                  margin: [0, 0, 0, 8],
                },
                {
                  text: [
                    { text: "Visit No: ", style: "labelBold" },
                    { text: labReportData.visitNo, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Service: ", style: "labelBold" },
                    { text: labReportData.serviceName, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Test Date: ", style: "labelBold" },
                    { text: labReportData.testDate, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Doctor: ", style: "labelBold" },
                    { text: labReportData.doctorName, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 25],
        },

        // Create pages for each report type
        ...Object.entries(parametersGroupedByReportType)
          .map(([reportType, parameters], reportIndex) => [
            // Page break for subsequent report types
            ...(reportIndex > 0
              ? [
                  { text: "", pageBreak: "before" },

                  // Header Image for new page
                  {
                    image: path.join(
                      __dirname,
                      "../../assets/header_prescription.jpg"
                    ),
                    width: 480,
                    alignment: "center",
                  },
                  { text: "\n" },

                  // Lab Report Title for new page
                  {
                    text: "LABORATORY REPORT",
                    style: "reportTitle",
                    alignment: "center",
                    margin: [0, 0, 0, 20],
                  },

                  // Patient Info Section for new page
                  {
                    columns: [
                      {
                        width: "50%",
                        stack: [
                          {
                            text: "PATIENT INFORMATION",
                            style: "sectionHeader",
                            margin: [0, 0, 0, 8],
                          },
                          {
                            text: [
                              { text: "UHID: ", style: "labelBold" },
                              { text: labReportData.UHID, style: "normalText" },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          {
                            text: [
                              { text: "Patient Name: ", style: "labelBold" },
                              {
                                text: labReportData.patientName,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          {
                            text: [
                              { text: "Age/Gender: ", style: "labelBold" },
                              {
                                text: `${labReportData.age} / ${labReportData.gender}`,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          {
                            text: [
                              { text: "Mobile: ", style: "labelBold" },
                              {
                                text: labReportData.mobile,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                        ],
                      },
                      {
                        width: "50%",
                        stack: [
                          {
                            text: "TEST INFORMATION",
                            style: "sectionHeader",
                            margin: [0, 0, 0, 8],
                          },
                          {
                            text: [
                              { text: "Visit No: ", style: "labelBold" },
                              {
                                text: labReportData.visitNo,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          {
                            text: [
                              { text: "Service: ", style: "labelBold" },
                              {
                                text: labReportData.serviceName,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          {
                            text: [
                              { text: "Test Date: ", style: "labelBold" },
                              {
                                text: labReportData.testDate,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                          {
                            text: [
                              { text: "Doctor: ", style: "labelBold" },
                              {
                                text: labReportData.doctorName,
                                style: "normalText",
                              },
                            ],
                            margin: [0, 0, 0, 4],
                          },
                        ],
                      },
                    ],
                    margin: [0, 0, 0, 25],
                  },
                ]
              : []),

            // Report Type Header
            {
              text: reportType.toUpperCase() + " REPORT",
              style: "reportTypeTitle",
              alignment: "center",
              margin: [0, 15, 0, 15],
            },

            // Column Headers
            {
              columns: [
                {
                  width: "35%",
                  text: "PARAMETER",
                  style: "columnHeader",
                },
                {
                  width: "20%",
                  text: "RESULT",
                  style: "columnHeader",
                },
                {
                  width: "15%",
                  text: "UNIT",
                  style: "columnHeader",
                },
                {
                  width: "30%",
                  text: "REFERENCE RANGE",
                  style: "columnHeader",
                },
              ],
              margin: [0, 0, 0, 5],
            },

            // Underline for headers
            {
              canvas: [
                {
                  type: "line",
                  x1: 0,
                  y1: 0,
                  x2: 515,
                  y2: 0,
                  lineWidth: 2,
                  lineColor: "#341f62",
                },
              ],
              margin: [0, 0, 0, 15],
            },

            // Parameters for this report type
            ...parameters.map((parameter, index) => {
              const bioRef = parameter.bioReference?.[0];
              const referenceRange = bioRef
                ? `${bioRef.min}-${bioRef.max}`
                : "N/A";

              return {
                columns: [
                  {
                    width: "35%",
                    stack: [
                      {
                        text: parameter.parameterName || "N/A",
                        style: "parameterName",
                      },
                    ],
                  },
                  {
                    width: "20%",
                    stack: [
                      {
                        text: parameter.resultValue || "-",
                        style: "resultValue",
                      },
                    ],
                  },
                  {
                    width: "15%",
                    stack: [
                      {
                        text: parameter.unit || "-",
                        style: "unitText",
                      },
                    ],
                  },
                  {
                    width: "30%",
                    stack: [
                      {
                        text: referenceRange,
                        style: "refRange",
                      },
                    ],
                  },
                ],
                margin: [0, 0, 0, 8],
              };
            }),
          ])
          .flat(),

        // Footer
        {
          text: `Report generated on: ${new Date().toLocaleString()}`,
          style: "footer",
          alignment: "center",
          margin: [0, 30, 0, 0],
        },

        {
          text: `Authorized by: ${
            doctor?.name || "Lab Technician"
          } | Status: ${labTestOrder.status.toUpperCase()}`,
          style: "footer",
          alignment: "center",
          margin: [0, 10, 0, 0],
        },
      ],

      styles: {
        reportTitle: {
          fontSize: 16,
          bold: true,
          color: "#341f62",
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          color: "#341f62",
          decoration: "underline",
        },
        labelBold: {
          fontSize: 10,
          bold: true,
          color: "#333333",
        },
        normalText: {
          fontSize: 10,
          color: "#555555",
        },
        reportTypeTitle: {
          fontSize: 14,
          bold: true,
          color: "#341f62",
        },
        columnHeader: {
          fontSize: 11,
          bold: true,
          color: "#333333",
          decoration: "underline",
        },
        parameterName: {
          fontSize: 11,
          bold: true,
          color: "#333333",
        },
        resultValue: {
          fontSize: 12,
          bold: true,
          color: "#341f62",
        },
        unitText: {
          fontSize: 10,
          color: "#666666",
          italics: true,
        },
        refLabel: {
          fontSize: 9,
          color: "#888888",
        },
        refRange: {
          fontSize: 9,
          color: "#666666",
        },
        footer: {
          fontSize: 9,
          color: "#777777",
          italics: true,
        },
      },

      defaultStyle: {
        fontSize: 10,
        font: "Roboto",
      },
    };

    // Generate PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers for PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=lab-report-${labTestOrderId}.pdf`,
    });

    // Stream PDF to response
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

// Get linked template for a specific lab test order
const getLabTestOrderTemplate = async (req, res) => {
  try {
    const { labTestOrderId } = req.params;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        data: null,
        status: false,
      });
    }

    // Find the lab test order and populate service with linkedTemplate
    const labTestOrder = await LabOrderTest.findById(labTestOrderId).populate({
      path: "serviceId",
      populate: {
        path: "linkedTemplate",
        model: "RadiologyTemplate",
        select:
          "templateName templateContent description isActive createdBy updatedBy",
        populate: [
          { path: "createdBy", select: "name" },
          { path: "updatedBy", select: "name" },
        ],
      },
    });

    const radiologyReport = await RadiologyReport.findOne({
      orderTestId: labTestOrder._id,
    });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        data: null,
        status: false,
      });
    }

    // Check if service has a linked template
    const template = labTestOrder.serviceId.linkedTemplate;

    if (!template) {
      return res.json({
        message: "No template linked to this lab test order",
        data: {
          labTestOrderId: labTestOrder._id,
          service: {
            _id: labTestOrder.serviceId?._id,
            serviceName: labTestOrder.serviceId?.serviceName,
            headType: labTestOrder.serviceId?.headType,
          },
          template: null,
        },
        status: true,
      });
    }

    return res.json({
      message: "Template for lab test order fetched successfully",
      data: {
        labTestOrderId: labTestOrder._id,
        service: {
          _id: labTestOrder.serviceId._id,
          serviceName: labTestOrder.serviceId.serviceName,
          code: labTestOrder.serviceId.code,
          headType: labTestOrder.serviceId.headType,
        },
        template: radiologyReport
          ? {
              _id: template._id,
              templateName: template.templateName,
              templateContent: radiologyReport.templateContent,
              description: template.description,
              isActive: template.isActive,
              createdBy: template.createdBy,
              updatedBy: template.updatedBy,
              findings: radiologyReport.findings,
              impression: radiologyReport.impression,
              methodology: radiologyReport.methodology,
            }
          : {
              _id: template._id,
              templateName: template.templateName,
              templateContent: template.templateContent,
              description: template.description,
              isActive: template.isActive,
              createdBy: template.createdBy,
              updatedBy: template.updatedBy,
              findings: template.findings,
              impression: template.impression,
              methodology: template.methodology,
            },
      },
      status: true,
    });
  } catch (error) {
    console.error("Error fetching template for lab test order:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Save radiology template result and authorize
const saveRadiologyTemplateResult = async (req, res) => {
  try {
    const {
      labTestOrderId,
      templateContent,
      findings,
      impression,
      methodology,
      userId,
    } = req.body;

    if (!labTestOrderId || !templateContent) {
      return res.status(400).json({
        message: "Lab test order ID and template content are required",
        data: null,
        status: false,
      });
    }

    // Find the lab test order and validate
    const labTestOrder = await LabOrderTest.findById(labTestOrderId).populate({
      path: "serviceId",
      populate: {
        path: "linkedTemplate",
        model: "RadiologyTemplate",
      },
    });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        data: null,
        status: false,
      });
    }

    // Validate it's a radiology service with linked template
    if (labTestOrder.serviceId?.headType !== "Radiology") {
      return res.status(400).json({
        message: "Lab test order must be for a Radiology service",
        data: null,
        status: false,
      });
    }

    if (!labTestOrder.serviceId?.linkedTemplate) {
      return res.status(400).json({
        message: "No template linked to this radiology service",
        data: null,
        status: false,
      });
    }

    // Check if report already exists, update if it does, create if it doesn't
    let radiologyReport = await RadiologyReport.findOne({
      orderTestId: labTestOrderId,
    });

    if (radiologyReport) {
      // Update existing report
      radiologyReport.templateUsedId =
        labTestOrder.serviceId.linkedTemplate._id;
      radiologyReport.findings = findings || "";
      radiologyReport.templateContent = templateContent || "";
      radiologyReport.impression = impression || "";
      radiologyReport.methodology = methodology || "";
      radiologyReport.authorizedBy = userId;
      radiologyReport.authorizedAt = new Date();
      await radiologyReport.save();
    } else {
      // Create new report
      radiologyReport = new RadiologyReport({
        orderTestId: labTestOrderId,
        templateUsedId: labTestOrder.serviceId.linkedTemplate._id,
        templateContent: templateContent || "",
        findings: findings || "",
        impression: impression || "",
        methodology: methodology || "",
        authorizedBy: userId,
        authorizedAt: new Date(),
      });
      await radiologyReport.save();
    }

    // Update lab test order status to authorized
    labTestOrder.status = "authorized";
    labTestOrder.authorizedBy = userId;
    labTestOrder.authorizedAt = new Date();
    await labTestOrder.save();

    return res.json({
      message: "Radiology report saved and authorized successfully",
      data: {
        labTestOrderId,
        reportId: radiologyReport._id,
        status: "authorized",
        templateUsed: {
          _id: labTestOrder.serviceId.linkedTemplate._id,
          templateName: labTestOrder.serviceId.linkedTemplate.templateName,
        },
        templateContent: radiologyReport.templateContent,
        findings: radiologyReport.findings,
        impression: radiologyReport.impression,
        methodology: radiologyReport.methodology,
        authorizedAt: radiologyReport.authorizedAt,
      },
      status: true,
    });
  } catch (error) {
    console.error("Error saving radiology template result:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

// Print radiology report
const printRadiologyReport = async (req, res) => {
  try {
    const { labTestOrderId } = req.query;

    if (!labTestOrderId) {
      return res.status(400).json({
        message: "Lab test order ID is required",
        status: false,
      });
    }

    // Find lab test order with all necessary data
    const labTestOrder = await LabOrderTest.findById(labTestOrderId)
      .populate({
        path: "serviceId",
        populate: {
          path: "linkedTemplate",
          model: "RadiologyTemplate",
        },
      })
      .populate({
        path: "labOrderId",
        populate: [
          {
            path: "patient",
            model: "Patient",
          },
          {
            path: "visit",
            model: "Visit",
            populate: {
              path: "consultingDoctorId",
              model: "Doctor",
            },
          },
        ],
      });

    if (!labTestOrder) {
      return res.status(404).json({
        message: "Lab test order not found",
        status: false,
      });
    }

    // Check if it's authorized
    if (labTestOrder.status !== "authorized") {
      return res.status(400).json({
        message: "Lab test order must be authorized to print report",
        status: false,
      });
    }

    // Get radiology report
    const radiologyReport = await RadiologyReport.findOne({
      orderTestId: labTestOrderId,
    }).populate("authorizedBy", "name");

    if (!radiologyReport) {
      return res.status(404).json({
        message: "Radiology report not found",
        status: false,
      });
    }

    const patient = labTestOrder.labOrderId?.patient;
    const visit = labTestOrder.labOrderId?.visit;
    const doctor = visit?.consultingDoctorId;
    const template = labTestOrder.serviceId?.linkedTemplate;

    // --- PDF Setup ---
    const fonts = {
      Roboto: {
        normal: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-Regular.ttf"
        ),
        bold: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-Medium.ttf"
        ),
        italics: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-Italic.ttf"
        ),
        bolditalics: path.join(
          __dirname,
          "../../assets/Roboto/static/Roboto-MediumItalic.ttf"
        ),
      },
    };
    const printer = new PdfPrinter(fonts);
    const templateContentText = htmlToText(radiologyReport.templateContent, {
      wordwrap: 130,
    });
    // Prepare radiology report data
    const reportData = {
      UHID: patient?.uhidNo || patient?.patientId || "N/A",
      visitNo: visit?.code || visit?._id || "N/A",
      testDate: format(new Date(labTestOrder.createdAt), "dd/MM/yyyy hh:mm"),
      reportDate: radiologyReport.authorizedAt?.toDateString() || "N/A",
      patientName: patient?.name || "N/A",
      age: patient?.age || "N/A",
      gender: patient?.gender || "N/A",
      mobile: patient?.contactNumber || "N/A",
      address: patient?.address || "N/A",
      doctorName: doctor?.name || "N/A",
      qualification: doctor?.qualification || "N/A",
      serviceName: labTestOrder.serviceId?.serviceName,
      serviceCode: labTestOrder.serviceId?.code,
      templateName: template?.templateName,
      findings: radiologyReport.findings || "Not specified",
      impression: radiologyReport.impression || "Not specified",
      methodology: radiologyReport.methodology || "Not specified",
      authorizedBy: radiologyReport.authorizedBy?.name || "Lab Technician",
      templateContent: templateContentText || "",
    };

    // --- PDF Definition ---
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 40],
      content: [
        // Header Image
        {
          image: path.join(__dirname, "../../assets/header_prescription.jpg"),
          width: 480,
          alignment: "center",
        },
        { text: "\n" },

        // Report Title
        {
          text: "RADIOLOGY REPORT",
          style: "reportTitle",
          alignment: "center",
          margin: [0, 0, 0, 20],
        },

        // Patient Info Section
        {
          columns: [
            {
              width: "50%",
              stack: [
                {
                  text: "PATIENT INFORMATION",
                  style: "sectionHeader",
                  margin: [0, 0, 0, 8],
                },
                {
                  text: [
                    { text: "UHID: ", style: "labelBold" },
                    { text: reportData.UHID, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Patient Name: ", style: "labelBold" },
                    { text: reportData.patientName, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Age/Gender: ", style: "labelBold" },
                    {
                      text: `${reportData.age} / ${reportData.gender}`,
                      style: "normalText",
                    },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Mobile: ", style: "labelBold" },
                    { text: reportData.mobile, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
              ],
            },
            {
              width: "50%",
              stack: [
                {
                  text: "EXAMINATION DETAILS",
                  style: "sectionHeader",
                  margin: [0, 0, 0, 8],
                },
                {
                  text: [
                    { text: "Visit No: ", style: "labelBold" },
                    { text: reportData.visitNo, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Examination: ", style: "labelBold" },
                    { text: reportData.serviceName, style: "normalText" },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Test Date: ", style: "labelBold" },
                    {
                      text: format(
                        new Date(reportData.testDate),
                        "dd/MM/yyyy hh:mm"
                      ),
                      style: "normalText",
                    },
                  ],
                  margin: [0, 0, 0, 4],
                },
                {
                  text: [
                    { text: "Report Date: ", style: "labelBold" },
                    {
                      text: format(
                        new Date(reportData.reportDate),
                        "dd/MM/yyyy hh:mm"
                      ),
                      style: "normalText",
                    },
                  ],
                  margin: [0, 0, 0, 4],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 25],
        },

        // Methodology Section
        {
          text: "Report:",
          style: "sectionHeader",
          margin: [0, 0, 0, 10],
        },
        {
          text: reportData.templateContent,
          style: "contentText",
          margin: [0, 0, 0, 20],
        },
        {
          text: "METHODOLOGY:",
          style: "sectionHeader",
          margin: [0, 0, 0, 10],
        },
        {
          text: reportData.methodology,
          style: "contentText",
          margin: [0, 0, 0, 20],
        },

        // Findings Section
        {
          text: "FINDINGS:",
          style: "sectionHeader",
          margin: [0, 0, 0, 10],
        },
        {
          text: reportData.findings,
          style: "contentText",
          margin: [0, 0, 0, 20],
        },

        // Impression Section
        {
          text: "IMPRESSION:",
          style: "sectionHeader",
          margin: [0, 0, 0, 10],
        },
        {
          text: reportData.impression,
          style: "contentText",
          margin: [0, 0, 0, 30],
        },

        // Doctor Section
        {
          columns: [
            { width: "50%", text: "" }, // Empty left column
            {
              width: "50%",
              stack: [
                {
                  text: "Dr. " + reportData.authorizedBy,
                  style: "doctorName",
                  alignment: "center",
                },
                {
                  text: reportData.qualification || "Consultant Radiologist",
                  style: "doctorQualification",
                  alignment: "center",
                  margin: [0, 5, 0, 0],
                },
                {
                  text: "Authorized Signatory",
                  style: "doctorTitle",
                  alignment: "center",
                  margin: [0, 20, 0, 0],
                },
              ],
            },
          ],
          margin: [0, 30, 0, 0],
        },

        // Footer
        {
          text: `Report generated on: ${format(
            new Date(),
            "dd/MM/yyyy hh:mm"
          )}`,
          style: "footer",
          alignment: "center",
          margin: [0, 40, 0, 0],
        },
      ],

      styles: {
        reportTitle: {
          fontSize: 18,
          bold: true,
          color: "#341f62",
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          color: "#341f62",
          decoration: "underline",
        },
        labelBold: {
          fontSize: 10,
          bold: true,
          color: "#333333",
        },
        normalText: {
          fontSize: 10,
          color: "#555555",
        },
        contentText: {
          fontSize: 11,
          color: "#333333",
          lineHeight: 1.3,
        },
        doctorName: {
          fontSize: 12,
          bold: true,
          color: "#341f62",
        },
        doctorQualification: {
          fontSize: 10,
          color: "#666666",
        },
        doctorTitle: {
          fontSize: 9,
          color: "#888888",
          italics: true,
        },
        footer: {
          fontSize: 9,
          color: "#777777",
          italics: true,
        },
      },

      defaultStyle: {
        fontSize: 10,
        font: "Roboto",
      },
    };

    // Generate PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers for PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=radiology-report-${labTestOrderId}.pdf`,
    });

    // Stream PDF to response
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error printing radiology report:", error);
    return res.status(500).json({
      message: "Server error",
      data: null,
      status: false,
    });
  }
};

module.exports = {
  listLabTestController,
  getLabOrderParametersGroupedBySampleType,
  collectTheTestOrder,
  listCollectedLabTestController,
  listSavedLabTestController,
  listAuthorizedLabTestController,
  getLabParametersByTestOrder,
  getLabParametersGroupedByReportType,
  getLabParametersWithResults,
  getLabOrderTestReportTypes,
  printLabTestOrder,
  saveLabTestResults,
  saveAndAuthorizeLabTestResults,
  getLabTestOrderTemplate,
  saveRadiologyTemplateResult,
  printRadiologyReport,
};
