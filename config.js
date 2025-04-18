import { fieldMappings } from "./fieldMappings.js";

const pdfPath = "g28-qpdf.pdf";
const { PDFDocument, StandardFonts } = PDFLib;

const downloadBtn = document.getElementById("downloadBtn");
const updatePreviewBtn = document.getElementById("updatePreviewBtn");
const pdfPreviewFrame = document.getElementById("pdf-preview");
const loadingIndicator = document.getElementById("loading-indicator");

function showLoading() {
  loadingIndicator.style.display = "block";
  pdfPreviewFrame.style.display = "none";
}

function hideLoading() {
  loadingIndicator.style.display = "none";
  pdfPreviewFrame.style.display = "block";
}

async function getPdfBytes() {
  try {
    showLoading();

    const existingPdfBytes = await fetch(pdfPath).then((res) =>
      res.arrayBuffer()
    );
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const [htmlId, pdfFieldName] of Object.entries(fieldMappings)) {
      try {
        const field = form.getField(pdfFieldName);
        if (!field) continue;

        const htmlElement = document.getElementById(htmlId);
        if (!htmlElement) continue;

        let value = htmlElement.value || htmlElement.textContent || "";

        if (field.constructor.name === "PDFTextField") {
          if (pdfFieldName.includes("AdditionalInfo")) {
            field.setText(value);
            field.setFontSize(15.6);
            field.setFont(helveticaFont);
          } else {
            field.setText(value);
          }
        } else if (
          field.constructor.name === "PDFCheckBox" &&
          typeof field.setChecked === "function"
        ) {
          field.setChecked(htmlElement.checked);
        } else if (
          (field.constructor.name === "PDFDropdown" ||
            field.constructor.name === "PDFRadioGroup") &&
          typeof field.select === "function"
        ) {
          if (value) field.select(value);
        }
      } catch (err) {
        console.warn(`Error processing field ${htmlId}:`, err);
      }
    }

    form.flatten();
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  } finally {
    hideLoading();
  }
}

async function updatePreview() {
  try {
    const pdfBytes = await getPdfBytes();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    pdfPreviewFrame.src = url;
  } catch (error) {
    alert("Error al generar la vista previa: " + error.message);
  }
}

async function downloadPdf() {
  try {
    const pdfBytes = await getPdfBytes();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "formulario-g28-completado.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Error al descargar el PDF: " + error.message);
  }
}

updatePreviewBtn.addEventListener("click", updatePreview);
downloadBtn.addEventListener("click", downloadPdf);

updatePreview();
