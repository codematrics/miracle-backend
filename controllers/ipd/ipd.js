const { default: z } = require("zod");
const Beds = require("../../models/Beds");
const IPD = require("../../models/IPD");
const { createIPDSchema, updateIPDSchema } = require("../../validations/ipd");
const Patient = require("../../models/Patient");
const Doctor = require("../../models/Doctor");
const Service = require("../../models/Service");
const {
  SERVICE_APPLICABLE,
  SERVICE_CATEGORY,
  VISIT_TYPE,
} = require("../../constants/enums");
const LabOrder = require("../../models/LabOrder");
const LabOrderTest = require("../../models/LabOrderTest");
const Visit = require("../../models/Visit");
const { generateVisitID } = require("../visit/visit");
const path = require("path");
const PdfPrinter = require("pdfmake");

const createIPDController = async (req, res) => {
  try {
    const validatedData = createIPDSchema.parse(req.body);

    const patient = await Patient.findById(validatedData.patient);

    if (!patient) {
      return res.status(404).json({
        message: "Patient Not Found",
        data: null,
        status: false,
      });
    }
    const doctor = await Doctor.findById(validatedData.referringDoctor);

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor Not Found",
        data: null,
        status: false,
      });
    }

    const bed = await Beds.findById(validatedData.bed);

    if (!bed) {
      return res.status(404).json({
        message: "Bed Not Found",
        data: null,
        status: false,
      });
    }

    if (bed.status === "occupied" || bed.status === "maintenance") {
      return res.status(400).json({
        message: "Bed is not available",
        data: null,
        status: false,
      });
    }

    const ipdExists = await IPD.findOne({
      patient: validatedData.patient,
      patientStatus: "In Treatment",
    });

    if (ipdExists) {
      return res.status(400).json({
        message: "Patient is already admitted",
        data: null,
        status: false,
      });
    }

    const ipdServices = await Service.find({
      $and: [
        {
          _id: {
            $in: validatedData.services?.map((service) => service.serviceId),
          },
        },
        {
          serviceApplicableOn: {
            $in: [SERVICE_APPLICABLE.IPD, SERVICE_APPLICABLE.BOTH],
          },
        },
      ],
    });

    if (ipdServices.length !== (validatedData.services || []).length) {
      return res.status(404).json({
        message: "Some Services Not Found",
        data: null,
        status: false,
      });
    }

    const ipd = new IPD({
      ...validatedData,
      billNumber: `IPD-${Date.now()}`,
      patient: patient._id,
      referringDoctor: doctor._id,
      bed: bed._id,
      services: ipdServices.map((service) => ({
        serviceId: service._id,
        quantity: 1,
        price: service.price,
      })),
    });

    await ipd.save();

    await Beds.findByIdAndUpdate(bed._id, {
      status: "occupied",
      patientId: patient._id,
    });

    const labServices = ipdServices.filter(
      (s) =>
        s.headType === SERVICE_CATEGORY.PATHOLOGY ||
        s.headType === SERVICE_CATEGORY.RADIOLOGY
    );

    const visitData = {
      patientId: patient._id,
      consultingDoctorId: validatedData.referringDoctor,
      visitType: VISIT_TYPE.IPD,
    };

    const visit = await Visit.create({ ...visitData, code: generateVisitID() });

    if (labServices.length) {
      const labOrder = await LabOrder.create({
        patient: patient._id,
        visit: visit._id,
        billingType: "IPD",
        billingId: ipd._id,
        doctor: doctor._id,
      });

      for (let index = 0; index < labServices.length; index++) {
        const service = labServices[index];

        await LabOrderTest.create({
          labOrderId: labOrder._id,
          serviceId: service._id,
        });
      }
    }

    return res.status(200).json({
      message: "IPD bill is created",
      data: ipd,
      status: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: error.issues[0]?.message, data: null, status: false });
    }
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", data: null, status: false });
  }
};

const listIPDController = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Build search query
    // const searchRegex = new RegExp(search, "i");
    // const query = {
    //   ...(searchRegex && {
    //     $or: [
    //       { patient: searchRegex },
    //       { bed: searchRegex },
    //       { referringDoctor: searchRegex },
    //       { billNumber: searchRegex },
    //     ],
    //   }),
    //   $and: [
    //     status && {
    //       status: status,
    //     },
    //   ].filter(Boolean),
    // };
    const query = {};

    const total = await IPD.countDocuments(query);
    const ipd = await IPD.find(query)
      .populate("patient referringDoctor services.serviceId")
      .populate({
        path: "bed",
        populate: {
          path: "ward",
        },
      })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "IPD fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        ipd,
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

const updateIPDController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = updateIPDSchema.parse(req.body);

    // Check for existing bed
    const existing = await IPD.findOne({
      _id: id,
    });

    if (!existing) {
      return res.status(400).json({
        message: "IPD with this Id Not Found",
        data: null,
        status: false,
      });
    }
    if (validatedData.referringDoctor) {
      const referringDoctor = await Doctor.findOne({
        _id: validatedData.referringDoctor,
      });

      if (!referringDoctor) {
        return res.status(400).json({
          message: "Referring Doctor with this Id Not Found",
          data: null,
          status: false,
        });
      }
    }

    if (
      validatedData.bed &&
      validatedData.bed?.toString() !== existing.bed?.toString()
    ) {
      const bed = await Beds.findById(validatedData.bed);

      if (!bed) {
        return res.json({
          message: "Bed not found",
          data: null,
          status: false,
        });
      }

      if (bed.status === "occupied" || bed.status === "maintenance") {
        return res.status(400).json({
          message: "Bed is not available",
          data: null,
          status: false,
        });
      }
    }
    if (validatedData.services && validatedData.services.length) {
      const ipdServices = await Service.find({
        $and: [
          {
            _id: {
              $in: validatedData.services?.map((service) => service.serviceId),
            },
          },
          {
            serviceApplicableOn: {
              $in: [SERVICE_APPLICABLE.IPD, SERVICE_APPLICABLE.BOTH],
            },
          },
        ],
      });

      if (ipdServices.length !== (validatedData.services || []).length) {
        return res.status(404).json({
          message: "Some Services Not Found",
          data: null,
          status: false,
        });
      }
    }

    if (
      validatedData.patientStatus &&
      validatedData.patientStatus === "Discharged"
    ) {
      await Beds.findByIdAndUpdate(existing.bed, {
        status: "available",
        patientId: null,
      });
    } else if (validatedData.bed) {
      await Beds.findByIdAndUpdate(validatedData.bed, { status: "occupied" });
      if (validatedData.bed.toString() !== existing.bed.toString()) {
        await Beds.findByIdAndUpdate(existing.bed, { status: "available" });
      }
    }

    const ipd = await IPD.findByIdAndUpdate(id, validatedData);

    return res.json({
      message: "IPD updated successfully",
      data: ipd,
      status: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(error);
      return res
        .status(400)
        .json({ message: error.issues[0]?.message, data: null, status: false });
    }

    console.error(error);
    return res.status(500).json({
      message: error.message || "Server error",
      data: null,
      status: false,
    });
  }
};

const printIpdBill = async (req, res) => {
  try {
    const billId = req.params.id;
    if (!billId) {
      return res
        .status(400)
        .json({ message: "Bill ID is required", status: false });
    }

    // Fetch IPD bill with necessary populates
    const ipdBill = await IPD.findById(billId)
      .populate({ path: "patient", model: "Patient" })
      .populate({ path: "referringDoctor", model: "Doctor" })
      .populate({
        path: "bed",
        model: "Bed",
        populate: {
          path: "ward",
          model: "Ward",
          populate: { path: "floor", model: "Floor" },
        },
      })
      .populate({ path: "services.serviceId", model: "Service" });

    if (!ipdBill) {
      return res
        .status(404)
        .json({ message: "IPD bill not found", status: false });
    }

    const patient = ipdBill.patient;
    const doctor = ipdBill.referringDoctor;
    const bed = ipdBill.bed;
    const ward = bed?.ward;
    const floor = ward?.floor;
    const services = ipdBill.services || [];

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

    // --- PDF Content ---
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 40],
      content: [
        {
          image: path.join(__dirname, "../../assets/header_prescription.jpg"),
          width: 480,
          alignment: "center",
        },
        { text: "\n" },
        {
          text: "INPATIENT BILL RECEIPT",
          style: "reportTitle",
          alignment: "center",
          margin: [0, 0, 0, 15],
        },

        // Patient & Bill Details
        {
          columns: [
            {
              width: "50%",
              stack: [
                { text: "PATIENT INFORMATION", style: "sectionHeader" },
                {
                  text: [
                    { text: "UHID: ", style: "labelBold" },
                    { text: patient?.uhidNo || "-", style: "normalText" },
                  ],
                },
                {
                  text: [
                    { text: "Name: ", style: "labelBold" },
                    { text: patient?.name || "-", style: "normalText" },
                  ],
                },
                {
                  text: [
                    { text: "Age/Gender: ", style: "labelBold" },
                    {
                      text: `${patient?.age || "-"} / ${
                        patient?.gender || "-"
                      }`,
                      style: "normalText",
                    },
                  ],
                },
                {
                  text: [
                    { text: "Mobile: ", style: "labelBold" },
                    { text: patient?.mobileNumber || "-", style: "normalText" },
                  ],
                },
                {
                  text: [
                    { text: "Address: ", style: "labelBold" },
                    {
                      text: patient?.address
                        ? `${patient.address.street || ""}, ${
                            patient.address.post || ""
                          }, ${patient.address.tehsil || ""}, ${
                            patient.address.district || ""
                          }, ${patient.address.state || ""} - ${
                            patient.address.pincode || ""
                          }`
                        : "-",
                      style: "normalText",
                    },
                  ],
                },
              ],
            },
            {
              width: "50%",
              stack: [
                { text: "BILL DETAILS", style: "sectionHeader" },
                {
                  text: [
                    { text: "Bill No: ", style: "labelBold" },
                    { text: ipdBill.billNumber, style: "normalText" },
                  ],
                },
                {
                  text: [
                    { text: "Bed: ", style: "labelBold" },
                    { text: bed?.bedNumber || "-", style: "normalText" },
                  ],
                },
                {
                  text: [
                    { text: "Ward/Floor: ", style: "labelBold" },
                    {
                      text: `${ward?.name || "-"} / ${floor?.name || "-"}`,
                      style: "normalText",
                    },
                  ],
                },
                {
                  text: [
                    { text: "Doctor: ", style: "labelBold" },
                    { text: doctor?.name || "-", style: "normalText" },
                  ],
                },
                {
                  text: [
                    { text: "Status: ", style: "labelBold" },
                    { text: ipdBill.patientStatus, style: "normalText" },
                  ],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 20],
        },

        // Services Table
        {
          text: "SERVICES DETAILS",
          style: "sectionHeader",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: ["5%", "45%", "15%", "15%", "20%"],
            body: [
              [
                { text: "S.No", style: "tableHeader" },
                { text: "Service Name", style: "tableHeader" },
                { text: "Qty", style: "tableHeader" },
                { text: "Price", style: "tableHeader" },
                { text: "Amount", style: "tableHeader" },
              ],
              ...services.map((item, idx) => [
                { text: idx + 1, style: "tableCell" },
                {
                  text: item.serviceId?.serviceName || "-",
                  style: "tableCell",
                },
                { text: item.quantity || 1, style: "tableCell" },
                { text: item.price?.toFixed(2) || "0.00", style: "tableCell" },
                {
                  text: ((item.price || 0) * (item.quantity || 1)).toFixed(2),
                  style: "tableCell",
                },
              ]),
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 20],
        },

        // Totals
        {
          columns: [
            { width: "*", text: "" },
            {
              width: "40%",
              table: {
                widths: ["50%", "50%"],
                body: [
                  ["Total Amount", ipdBill.totalAmount.toFixed(2)],
                  ["Discount", ipdBill.discount.toFixed(2)],
                  ["Net Amount", ipdBill.netAmount.toFixed(2)],
                  ["Paid Amount", ipdBill.paidAmount.toFixed(2)],
                  ["Due Amount", ipdBill.dueAmount.toFixed(2)],
                ],
              },
              layout: "noBorders",
            },
          ],
          margin: [0, 10, 0, 20],
        },

        // Footer
        {
          text: `Generated on ${new Date().toLocaleString()}`,
          style: "footer",
          alignment: "center",
        },
      ],

      styles: {
        reportTitle: { fontSize: 16, bold: true, color: "#341f62" },
        sectionHeader: {
          fontSize: 13,
          bold: true,
          color: "#341f62",
          margin: [0, 10, 0, 5],
        },
        labelBold: { fontSize: 10, bold: true },
        normalText: { fontSize: 10 },
        tableHeader: { bold: true, fontSize: 10, fillColor: "#f2f2f2" },
        tableCell: { fontSize: 9 },
        footer: { fontSize: 9, color: "#555", italics: true },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=ipd-bill-${billId}.pdf`,
    });

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error generating IPD bill:", error);
    return res
      .status(500)
      .json({ message: "Server error while printing IPD bill", status: false });
  }
};

module.exports = {
  listIPDController,
  createIPDController,
  updateIPDController,
  printIpdBill,
};
