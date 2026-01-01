const PDFDocument = require("pdfkit");
const Prescription = require("../../models/Priscription");
const {
  createPrescriptionSchema,
} = require("../../validations/priscriptionSchema");
const Visit = require("../../models/Visit");
const { VISIT_STATUS } = require("../../constants/enums");
const PdfPrinter = require("pdfmake");
const path = require("path");

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

    // --- pdfmake setup ---
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

    // Case sheet like object from your UI
    const caseSheetData = {
      UHID: prescription.patientId.uhidNo || "N/A",
      visitNo: prescription.visitId._id || "N/A",
      visitDate: prescription.createdAt.toDateString(),
      patientName: prescription.patientId.name,
      relation: prescription.patientId.relation || "",
      fathername: prescription.patientId.relativeName || "",
      age: prescription.patientId.age,
      gender: prescription.patientId.gender,
      mobileno: prescription.patientId.mobileNumber,
      doctorName: prescription.doctorId.name,
      specialization: prescription.doctorId.specialization,
      licenseNumber: prescription.doctorId.licenseNumber,
      referredBy: prescription.visitId.referredBy || "-",
      patientAddress: prescription.patientId.address,
      medications: prescription.medicines,
      notes: prescription.notes,
    };

    console.log(prescription);

    // --- PDF Definition (mirrors your HTML UI) ---
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

        // Patient Details
        {
          table: {
            widths: ["15%", "35%", "15%", "35%"],
            body: [
              [
                { text: "UHID", bold: true },
                { text: caseSheetData.UHID },
                { text: "Visit No", bold: true },
                { text: caseSheetData.visitNo },
              ],
              [
                { text: "Patient Name", bold: true },
                { text: caseSheetData.patientName },
                { text: "Age/Gender", bold: true },
                { text: `${caseSheetData.age} / ${caseSheetData.gender}` },
              ],
              [
                { text: "Doctor Name", bold: true },
                {
                  text: `${caseSheetData.doctorName} (${caseSheetData.specialization})`,
                },
                { text: "Date", bold: true },
                {
                  text: format(new Date(caseSheetData.visitDate), "dd/MM/yyyy"),
                },
              ],
            ],
          },
          layout: "lightHorizontalLines",
        },

        { text: "\n" },

        // Medicines
        {
          text: "Prescription",
          fontSize: 14,
          bold: true,
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: ["35%", "20%", "20%", "25%"],
            body: [
              [
                { text: "Medicine", bold: true },
                { text: "Frequency", bold: true },
                { text: "Duration", bold: true },
                { text: "Instruction", bold: true },
              ],
              ...caseSheetData.medications.map((med) => [
                { text: `${med.medName} ${med.dosage}`, noWrap: true },
                med.frequency,
                med.duration,
                med.instructions || "",
              ]),
            ],
          },
          layout: {
            fillColor: (rowIndex) => (rowIndex === 0 ? "#f2f2f2" : null),
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        },

        // Footer Signature
        {
          text: "Signature / Seal",
          alignment: "right",
          italics: true,
          margin: [0, 40, 0, 0],
        },
      ],
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
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
