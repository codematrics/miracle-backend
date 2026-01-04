const PDFDocument = require("pdfkit");
const Prescription = require("../../models/Priscription");
const {
  createPrescriptionSchema,
} = require("../../validations/priscriptionSchema");
const Visit = require("../../models/Visit");
const { VISIT_STATUS } = require("../../constants/enums");
const PdfPrinter = require("pdfmake");
const path = require("path");
const { format } = require("date-fns");
const Examinations = require("../../models/Examinations");

const toPdfText = (item) => {
  if (typeof item === "string") return { text: item };
  if (typeof item === "object" && item !== null) {
    if (item.text) return { text: String(item.text) };
    if (item.label) return { text: String(item.label) };
    return { text: JSON.stringify(item) };
  }
  return { text: String(item) };
};

const normalizePdfArray = (arr = []) => arr.map(toPdfText);

exports.createPrescription = async (req, res) => {
  try {
    const validatedData = createPrescriptionSchema.parse(req.body);
    const { visitId } = validatedData;
    const visit = await Visit.findById(visitId);

    if (!visit) {
      return res.status(404).json({
        status: false,
        message: "Visit Not Found",
        data: null,
      });
    }

    const { consultingDoctorId } = visit;

    const prescription = new Prescription({
      ...validatedData,
      doctorId: consultingDoctorId,
    });
    await prescription.save();
    await Visit.findByIdAndUpdate(visitId, {
      prescription: prescription._id,
      status: VISIT_STATUS.CLOSED,
    });

    return res.status(201).json({
      status: true,
      message: "Prescription created successfully",
      data: prescription,
    });
  } catch (err) {
    return res.status(400).json({
      status: false,
      message: err.message || "Validation failed",
    });
  }
};

exports.printPrescription = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await Prescription.findById(id)
      .populate("patientId")
      .populate("visitId")
      .populate("doctorId");

    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    const examination = await Examinations.findOne({
      visitId: prescription.visitId._id,
    });

    /* ---------------- FONTS ---------------- */
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
      },
    };
    const printer = new PdfPrinter(fonts);

    const vitalsTable = examination?.vitals
      ? {
          table: {
            widths: ["40%", "60%"],
            body: [
              [
                { text: "Height", bold: true },
                examination.vitals.height || "-",
              ],
              [
                { text: "Weight", bold: true },
                examination.vitals.weight || "-",
              ],
              [{ text: "BP", bold: true }, examination.vitals.bp || "-"],
              [{ text: "SpO₂", bold: true }, examination.vitals.spo2 || "-"],
              [{ text: "Pulse", bold: true }, examination.vitals.pulse || "-"],
              [{ text: "Resp", bold: true }, examination.vitals.resp || "-"],
              [{ text: "Temp", bold: true }, examination.vitals.temp || "-"],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        }
      : { text: "-" };

    /* ---------------- DOCUMENT ---------------- */
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [20, 20, 20, 20],

      content: [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  stack: [
                    /* ================= HEADER ================= */
                    {
                      table: {
                        widths: ["*"],
                        body: [
                          [
                            {
                              image: path.join(
                                __dirname,
                                "../../assets/header_prescription.jpg"
                              ),
                              width: 480,
                              alignment: "center",
                            },
                          ],
                        ],
                      },
                      layout: "noBorders",
                    },

                    /* ================= PATIENT DETAILS ================= */
                    {
                      table: {
                        widths: ["20%", "30%", "20%", "30%"],
                        body: [
                          [
                            { text: "Patient Name", bold: true },
                            prescription.patientId.name,
                            { text: "Date", bold: true },
                            format(
                              new Date(prescription.createdAt),
                              "dd/MM/yyyy"
                            ),
                          ],
                          [
                            { text: "Age / Gender", bold: true },
                            `${prescription.patientId.age} / ${prescription.patientId.gender}`,
                            { text: "Doctor", bold: true },
                            prescription.doctorId.name,
                          ],
                        ],
                      },
                      layout: "lightHorizontalLines",
                      margin: [0, 5, 0, 5],
                    },

                    /* ================= BODY ================= */
                    {
                      table: {
                        widths: ["50%", "50%"],
                        body: [
                          [
                            /* ---------- LEFT COLUMN ---------- */
                            {
                              stack: [
                                { text: "Complaints", bold: true },
                                {
                                  ul: normalizePdfArray(
                                    examination?.complaints
                                  ),
                                },

                                {
                                  text: "\nVitals",
                                  bold: true,
                                  fontSize: 11,
                                  decoration: "underline",
                                },
                                vitalsTable,

                                { text: "\nInvestigation", bold: true },
                                {
                                  ul: normalizePdfArray(
                                    examination?.investigations
                                  ),
                                },

                                { text: "\nInvestigation Advised", bold: true },
                                {
                                  text:
                                    examination?.investigationAdvised || "-",
                                },
                              ],
                            },

                            /* ---------- RIGHT COLUMN ---------- */
                            {
                              stack: [
                                {
                                  table: {
                                    widths: ["50%", "50%"],
                                    body: [
                                      [
                                        {
                                          text: "Provisional Diagnosis",
                                          bold: true,
                                        },
                                        prescription?.provisionalDiagnosis ||
                                          "-",
                                      ],
                                      [
                                        {
                                          text: "Final Diagnosis",
                                          bold: true,
                                        },
                                        prescription?.finalDiagnosis || "-",
                                      ],
                                    ],
                                  },
                                  layout: "lightHorizontalLines",
                                },

                                {
                                  table: {
                                    headerRows: 1,
                                    widths: ["40%", "20%", "20%", "20%"],
                                    body: [
                                      [
                                        { text: "Medicine", bold: true },
                                        { text: "Dose", bold: true },
                                        { text: "Freq", bold: true },
                                        { text: "Duration", bold: true },
                                      ],
                                      ...prescription.medicines.map((med) => [
                                        med.medicineName,
                                        med.dosage || "-",
                                        med.frequency || "-",
                                        med.duration || "-",
                                      ]),
                                    ],
                                  },
                                  layout: "lightHorizontalLines",
                                },
                              ],
                            },
                          ],
                        ],
                      },
                      layout: {
                        hLineWidth: () => 1,
                        vLineWidth: () => 1,
                      },
                    },

                    /* ================= FOOTER ================= */
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
                  ],
                },
              ],
            ],
          },
          layout: "noBorders",
        },
      ],

      defaultStyle: {
        fontSize: 10,
        lineHeight: 1.4,
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=prescription.pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Print Prescription Error:", error);
    res.status(500).json({ message: "Failed to print prescription" });
  }
};
