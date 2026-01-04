const Doctor = require("../../models/Doctor");
const IPD = require("../../models/IPD");
const OpdBilling = require("../../models/OpdBilling");
const Visit = require("../../models/Visit");

const getCollectionFromDoctor = async (req, res) => {
  try {
    const { id = "" } = req.query;

    if (id) {
      const doctor = await Doctor.find({
        _id: id,
        doctorType: "CONSULTING",
      });

      if (!doctor) {
        return res
          .status(404)
          .json({ message: "Doctor not found", data: null, status: false });
      }
    }
    const { fromDate, toDate } = req.query;

    const dateFilter = {};
    if (fromDate || toDate) {
      dateFilter.createdAt = {};
      if (fromDate) dateFilter.createdAt.$gte = new Date(fromDate);
      if (toDate) dateFilter.createdAt.$lte = new Date(toDate);
    }

    /* ---------------- OPD ---------------- */
    const opd = await OpdBilling.aggregate([
      { $match: { status: { $ne: "cancelled" }, ...dateFilter } },
      {
        $group: {
          _id: "$consultantDoctor",
          totalBills: { $sum: 1 },
          grossAmount: { $sum: "$billing.grossAmount" },
          discount: { $sum: "$billing.discount" },
          netAmount: { $sum: "$billing.netAmount" },
          paidAmount: { $sum: "$paidAmount" },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: "$doctor" },
    ]);

    /* ---------------- IPD ---------------- */
    const ipd = await IPD.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$referringDoctor",
          totalAdmissions: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          discount: { $sum: "$discount" },
          netAmount: { $sum: "$netAmount" },
          paidAmount: { $sum: "$paidAmount" },
          dueAmount: { $sum: "$dueAmount" },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: "$doctor" },
    ]);

    /* ---------------- VISIT ---------------- */
    const visit = await Visit.aggregate([
      { $match: dateFilter },
      { $unwind: "$services" },
      {
        $group: {
          _id: "$consultingDoctorId",
          totalVisits: { $addToSet: "$_id" },
          totalAmount: { $sum: "$services.amount" },
        },
      },
      {
        $project: {
          totalVisits: { $size: "$totalVisits" },
          totalAmount: 1,
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: "$doctor" },
    ]);

    /* ---------------- MERGE RESULT ---------------- */
    const result = {};

    const merge = (data, type) => {
      data.forEach((d) => {
        const doctorId = d.doctor._id.toString();

        if (!result[doctorId]) {
          result[doctorId] = {
            doctorId,
            doctorName: d.doctor.name,
            collections: {},
          };
        }

        result[doctorId].collections[type] = { ...d };
        delete result[doctorId].collections[type].doctor;
        delete result[doctorId].collections[type]._id;
      });
    };

    merge(opd, "opd");
    merge(ipd, "ipd");
    merge(visit, "visit");

    return res.status(200).json({
      success: true,
      count: Object.keys(result).length,
      data: Object.values(result),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const getAllTypesOfCollection = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const dateFilter = {};
    if (fromDate || toDate) {
      dateFilter.createdAt = {};
      if (fromDate) dateFilter.createdAt.$gte = new Date(fromDate);
      if (toDate) dateFilter.createdAt.$lte = new Date(toDate);
    }

    /* ---------------- OPD ---------------- */
    const opd = await OpdBilling.aggregate([
      { $match: { status: { $ne: "cancelled" }, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          grossAmount: { $sum: "$billing.grossAmount" },
          discount: { $sum: "$billing.discount" },
          netAmount: { $sum: "$billing.netAmount" },
          paidAmount: { $sum: "$paidAmount" },
        },
      },
    ]);

    /* ---------------- IPD ---------------- */
    const ipd = await IPD.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalAdmissions: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          discount: { $sum: "$discount" },
          netAmount: { $sum: "$netAmount" },
          paidAmount: { $sum: "$paidAmount" },
          dueAmount: { $sum: "$dueAmount" },
        },
      },
    ]);

    /* ---------------- VISIT ---------------- */
    const visit = await Visit.aggregate([
      { $match: dateFilter },
      { $unwind: "$services" },
      {
        $group: {
          _id: null,
          totalVisits: { $addToSet: "$_id" },
          totalAmount: { $sum: "$services.amount" },
        },
      },
      {
        $project: {
          totalVisits: { $size: "$totalVisits" },
          totalAmount: 1,
        },
      },
    ]);

    /* ---------------- FORMAT RESPONSE ---------------- */
    const response = {
      opd: opd[0] || {
        totalBills: 0,
        grossAmount: 0,
        discount: 0,
        netAmount: 0,
        paidAmount: 0,
      },
      ipd: ipd[0] || {
        totalAdmissions: 0,
        totalAmount: 0,
        discount: 0,
        netAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
      },
      visit: visit[0] || {
        totalVisits: 0,
        totalAmount: 0,
      },
    };

    /* ---------------- GRAND TOTALS ---------------- */
    response.grandTotal = {
      netAmount:
        response.opd.netAmount +
        response.ipd.netAmount +
        response.visit.totalAmount,

      paidAmount: response.opd.paidAmount + response.ipd.paidAmount,

      dueAmount: response.ipd.dueAmount || 0,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch collections summary",
      error: error.message,
    });
  }
};
module.exports = { getCollectionFromDoctor, getAllTypesOfCollection };
