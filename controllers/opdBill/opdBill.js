const { default: z } = require("zod");
const {
  VISIT_TYPE,
  SERVICE_APPLICABLE,
  SERVICE_CATEGORY,
} = require("../../constants/enums");
const Doctor = require("../../models/Doctor");
const LabOrder = require("../../models/LabOrder");
const OpdBilling = require("../../models/OpdBilling");
const Patient = require("../../models/Patient");
const Service = require("../../models/Service");
const Visit = require("../../models/Visit");
const {
  createOpdBillingSchema,
} = require("../../validations/opdBillingSchema");
const LabOrderTest = require("../../models/LabOrderTest");
const { generateVisitID } = require("../visit/visit");
const PdfPrinter = require("pdfmake");
const path = require("path");

const listOPDController = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const query = {};

    const total = await OpdBilling.countDocuments(query);
    const opd = await OpdBilling.find(query)
      .populate("patient visit consultantDoctor services")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      message: "OPD fetched successfully",
      data: {
        total,
        page: pageNum,
        limit: limitNum,
        opd,
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
const createOPDBill = async (req, res) => {
  try {
    const validatedData = createOpdBillingSchema.parse(req.body);

    const patient = await Patient.findById(validatedData.patient);

    if (!patient) {
      return res.status(404).json({
        message: "Patient Not Found",
        data: null,
        status: false,
      });
    }
    const doctor = await Doctor.findById(validatedData.consultantDoctor);

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor Not Found",
        data: null,
        status: false,
      });
    }

    const referringDoctor = await Doctor.findById(validatedData.referredBy);

    if (!referringDoctor) {
      return res.status(404).json({
        message: "Referring Doctor Not Found",
        data: null,
        status: false,
      });
    }

    const visitData = {
      patientId: patient._id,
      consultingDoctorId: doctor._id,
      referringDoctorId: referringDoctor._id,
      visitType: VISIT_TYPE.OPD,
    };

    const visit = await Visit.create({ ...visitData, code: generateVisitID() });
    const services = await Service.find({
      _id: { $in: validatedData.services?.map((service) => service.serviceId) },
      serviceApplicableOn: {
        $in: [SERVICE_APPLICABLE.OPD, SERVICE_APPLICABLE.BOTH],
      },
    });

    if (services.length !== validatedData.services.length) {
      return res.status(404).json({
        message: "Some Services Not Found",
        data: null,
        status: false,
      });
    }

    const opdBill = new OpdBilling({
      ...validatedData,
      patient: patient._id,
      consultantDoctor: doctor._id,
      referringDoctor: referringDoctor._id,
      visit: visit._id,
    });

    await opdBill.save();

    // Filter services that require lab order tests (Pathology and Radiology)
    const labServices = services.filter(
      (s) =>
        s.headType === SERVICE_CATEGORY.PATHOLOGY ||
        s.headType === SERVICE_CATEGORY.RADIOLOGY
    );

    if (labServices.length) {
      const labOrder = await LabOrder.create({
        patient: patient._id,
        visit: visit._id,
        billingType: "OpdBilling",
        billingId: opdBill._id,
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
      message: "OPD bill is created Found",
      data: opdBill,
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

const updateOPDController = async (req, res) => {
  try {
    const id = req.params.id;
    const validatedData = createOpdBillingSchema.parse(req.body);

    // Check for existing bed
    const existing = await OpdBilling.findOne({
      _id: id,
    });

    if (!existing) {
      return res.status(400).json({
        message: "OPD with this Id Not Found",
        data: null,
        status: false,
      });
    }

    const existingPatient = await Patient.findOne({
      uhidNo: validatedData?.patient,
    });

    if (!existingPatient) {
      return res.status(400).json({
        message: "Patient with this Id Not Found",
        data: null,
        status: false,
      });
    }

    if (validatedData.consultantDoctor) {
      const consultantDoctor = await Doctor.findOne({
        _id: validatedData.consultantDoctor,
      });

      if (!consultantDoctor) {
        return res.status(400).json({
          message: "Consultant Doctor with this Id Not Found",
          data: null,
          status: false,
        });
      }
    }

    if (validatedData.services && validatedData.services.length) {
      const opdServices = await Service.find({
        $and: [
          {
            _id: {
              $in: validatedData.services?.map((service) => service.serviceId),
            },
          },
          {
            serviceApplicableOn: {
              $in: [SERVICE_APPLICABLE.OPD, SERVICE_APPLICABLE.BOTH],
            },
          },
        ],
      });

      if (opdServices.length !== (validatedData.services || []).length) {
        return res.status(404).json({
          message: "Some Services Not Found",
          data: null,
          status: false,
        });
      }
    }

    const opd = await OpdBilling.findByIdAndUpdate(id, {
      ...validatedData,
      patient: existingPatient._id,
    });

    return res.json({
      message: "OPD updated successfully",
      data: opd,
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

const getOneOPDController = async (req, res) => {
  try {
    const id = req.params.id;

    // Check for existing bed
    const existing = await OpdBilling.findOne({
      _id: id,
    })
      .populate("consultantDoctor referringDoctor patient")
      .populate({
        path: "services",
        populate: {
          path: "serviceId",
        },
      });

    if (!existing) {
      return res.status(400).json({
        message: "OPD with this Id Not Found",
        data: null,
        status: false,
      });
    }

    return res.json({
      message: "OPD fetched successfully",
      data: existing,
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

const printOpdBill = async (req, res) => {
  try {
    const billId = req.params.id;

    if (!billId) {
      return res.status(400).json({
        message: "Bill ID is required",
        status: false,
      });
    }

    // --- Fetch and populate OPD Billing data ---
    const opdBill = await OpdBilling.findById(billId)
      .populate({
        path: "patient",
        model: "Patient",
      })
      .populate({
        path: "consultantDoctor",
        model: "Doctor",
      })
      .populate({
        path: "visit",
        model: "Visit",
      })
      .populate({
        path: "services.serviceId",
        model: "Service",
      });

    if (!opdBill) {
      return res.status(404).json({
        message: "OPD bill not found",
        status: false,
      });
    }

    // --- Prepare PDF data ---
    const patient = opdBill.patient;
    const doctor = opdBill.consultantDoctor;
    const services = opdBill.services || [];

    // --- Font Configuration (with italics fix) ---
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

    // --- Calculate totals ---
    const { grossAmount, discount, netAmount } = opdBill.billing;
    const balanceAmount = netAmount - (opdBill.paidAmount || 0);

    // --- PDF Definition ---
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 40],
      content: [
        // Header Logo
        {
          image: path.join(__dirname, "../../assets/header_prescription.jpg"),
          width: 480,
          alignment: "center",
        },
        { text: "\n" },

        {
          text: "OUTPATIENT BILL RECEIPT",
          style: "reportTitle",
          alignment: "center",
          margin: [0, 0, 0, 15],
        },

        // 👇 Improved Patient & Bill Details Section
        {
          table: {
            widths: ["50%", "50%"],
            body: [
              [
                {
                  stack: [
                    { text: "PATIENT INFORMATION", style: "sectionHeader" },
                    {
                      canvas: [
                        {
                          type: "line",
                          x1: 0,
                          y1: 0,
                          x2: 240,
                          y2: 0,
                          lineWidth: 1,
                          lineColor: "#341f62",
                        },
                      ],
                    },
                    { text: "\n" },
                    {
                      table: {
                        widths: ["35%", "65%"],
                        body: [
                          ["UHID", patient?.uhidNo || "N/A"],
                          ["Name", patient?.name || "N/A"],
                          [
                            "Age / Gender",
                            `${patient?.age || "-"} / ${
                              patient?.gender || "-"
                            }`,
                          ],
                          ["Mobile", patient?.mobileNumber || "-"],
                          [
                            "Address",
                            patient?.address
                              ? `${patient.address.street || ""}, ${
                                  patient.address.post || ""
                                }, ${patient.address.tehsil || ""}, ${
                                  patient.address.district || ""
                                }, ${patient.address.state || ""} - ${
                                  patient.address.pincode || ""
                                }`
                              : "—",
                          ],
                        ],
                      },
                      layout: {
                        hLineWidth: () => 0,
                        vLineWidth: () => 0,
                        paddingLeft: () => 0,
                        paddingRight: () => 0,
                        paddingTop: () => 2,
                        paddingBottom: () => 2,
                      },
                      style: "infoTable",
                    },
                  ],
                },
                {
                  stack: [
                    { text: "BILL DETAILS", style: "sectionHeader" },
                    {
                      canvas: [
                        {
                          type: "line",
                          x1: 0,
                          y1: 0,
                          x2: 240,
                          y2: 0,
                          lineWidth: 1,
                          lineColor: "#341f62",
                        },
                      ],
                    },
                    { text: "\n" },
                    {
                      table: {
                        widths: ["45%", "55%"],
                        body: [
                          ["Bill No", opdBill.billId],
                          [
                            "Bill Date",
                            new Date(opdBill.billDate).toLocaleDateString(),
                          ],
                          ["Doctor", doctor?.name || "N/A"],
                          ["Payment Mode", opdBill.paymentMode || "Cash"],
                        ],
                      },
                      layout: {
                        hLineWidth: () => 0,
                        vLineWidth: () => 0,
                        paddingLeft: () => 0,
                        paddingRight: () => 0,
                        paddingTop: () => 2,
                        paddingBottom: () => 2,
                      },
                      style: "infoTable",
                    },
                  ],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 0, 0, 20],
        },

        // Service Table (kept same as before)
        {
          text: "SERVICES DETAILS",
          style: "sectionHeader",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: ["10%", "45%", "15%", "15%", "15%"],
            body: [
              [
                { text: "S.No", style: "tableHeader" },
                { text: "Service Name", style: "tableHeader" },
                { text: "Qty", style: "tableHeader" },
                { text: "Price", style: "tableHeader" },
                { text: "Amount", style: "tableHeader" },
              ],
              ...services.map((item, index) => [
                { text: index + 1, style: "tableCell" },
                {
                  text: item.serviceId?.serviceName || "-",
                  style: "tableCell",
                },
                { text: item.quantity || 1, style: "tableCell" },
                { text: item.price?.toFixed(2) || "0.00", style: "tableCell" },
                { text: item.amount?.toFixed(2) || "0.00", style: "tableCell" },
              ]),
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 20],
        },

        // Totals Section
        {
          columns: [
            { width: "*", text: "" },
            {
              width: "40%",
              table: {
                widths: ["50%", "50%"],
                body: [
                  ["Gross Amount", grossAmount.toFixed(2)],
                  ["Discount", discount.toFixed(2)],
                  ["Net Amount", netAmount.toFixed(2)],
                  ["Paid Amount", opdBill.paidAmount.toFixed(2)],
                  [
                    { text: "Balance Amount", bold: true },
                    { text: balanceAmount.toFixed(2), bold: true },
                  ],
                ],
              },
              layout: "noBorders",
              style: "infoTable",
            },
          ],
          margin: [0, 10, 0, 30],
        },
        {
          columns: [
            { width: "*", text: "" },
            {
              width: "40%",
              stack: [
                {
                  text: "Authorized Signature",
                  alignment: "center",
                  margin: [0, 30, 0, 40],
                  fontSize: 10,
                },
                {
                  canvas: [
                    {
                      type: "line",
                      x1: 0,
                      y1: 0,
                      x2: 150,
                      y2: 0,
                      lineWidth: 1,
                    },
                  ],
                  alignment: "center",
                },
              ],
            },
          ],
        },

        // Footer

        {
          text: `Generated on ${new Date().toLocaleString()}`,
          style: "footer",
          alignment: "center",
          margin: [0, 30, 0, 30],
        },
      ],

      styles: {
        reportTitle: {
          fontSize: 16,
          bold: true,
          color: "#341f62",
        },
        sectionHeader: {
          fontSize: 13,
          bold: true,
          color: "#341f62",
          margin: [0, 5, 0, 5],
        },
        infoTable: {
          fontSize: 10,
          color: "#333333",
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          fillColor: "#f2f2f2",
        },
        tableCell: {
          fontSize: 9,
        },
        footer: {
          fontSize: 9,
          color: "#555",
          italics: true,
        },
      },
    };

    // Generate and send PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=opd-bill-${billId}.pdf`,
    });

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while printing OPD bill",
      status: false,
    });
  }
};

module.exports = {
  createOPDBill,
  listOPDController,
  getOneOPDController,
  updateOPDController,
  printOpdBill,
};
