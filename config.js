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

function wrapTextWithDoubleBreaks(text, font, size, maxWidth, adjustment = 0) {
  const effectiveMaxWidth = maxWidth - adjustment;
  const words = text.split(/(\s+|\n)/).filter((part) => part);
  if (words.length === 0) return "";

  let lines = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (word === "\n") {
      lines.push(currentLine.trimEnd());
      lines.push("");
      currentLine = "";
      continue;
    }

    if (/\s+/.test(word)) {
      if (currentLine !== "") {
        currentLine += " ";
      }
      continue;
    }

    const wordToAdd = word;
    const testLine = currentLine === "" ? wordToAdd : currentLine + wordToAdd;
    const testLineWidth = font.widthOfTextAtSize(testLine.trimEnd(), size);

    if (testLineWidth <= effectiveMaxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine.trimEnd());
      if (currentLine.length > 0) {
        lines.push("");
      }
      currentLine = wordToAdd;
    }
  }

  lines.push(currentLine.trimEnd());
  return lines.join("\n");
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
        if (pdfFieldName.includes("AptSteFlrNumber")) continue;

        const field = form.getField(pdfFieldName);
        if (!field) {
          console.warn(`Campo PDF no encontrado: ${pdfFieldName}`);
          continue;
        }

        const htmlElement = document.getElementById(htmlId);
        if (!htmlElement) {
          console.warn(`Elemento HTML no encontrado: ${htmlId}`);
          continue;
        }

        let value = htmlElement.value || htmlElement.textContent || "";

        if (field.constructor.name === "PDFCheckBox") {
          if (htmlElement.checked) {
            field.check();
          } else {
            field.uncheck();
          }
          field.updateAppearances(helveticaFont);
        } else if (field.constructor.name === "PDFTextField") {
          if (pdfFieldName.includes("AdditionalInfo")) {
            const fontSize = 8.1;
            const adjustment = 4;

            const widgets = field.acroField.getWidgets();
            if (widgets && widgets.length > 0) {
              const rect = widgets[0].getRectangle();
              const fieldWidth = rect.width;

              field.enableMultiline();

              const processedValue = wrapTextWithDoubleBreaks(
                value,
                helveticaFont,
                fontSize,
                fieldWidth,
                adjustment
              );

              field.setText(processedValue);
              field.setFontSize(fontSize);
              field.setFont(helveticaFont);
            } else {
              field.setText(value);
              field.setFontSize(fontSize);
              field.setFont(helveticaFont);
              field.enableMultiline();
            }
          } else {
            field.setText(value);
          }
        } else if (
          (field.constructor.name === "PDFDropdown" ||
            field.constructor.name === "PDFRadioGroup") &&
          typeof field.select === "function"
        ) {
          if (value) {
            try {
              field.select(value);
            } catch (selectError) {
              console.warn(
                `Error al seleccionar opción "${value}" para ${pdfFieldName}: ${selectError.message}`
              );
            }
          }
        }
      } catch (err) {
        console.warn(
          `Error procesando el campo ${htmlId} (${pdfFieldName}):`,
          err
        );
      }
    }

    for (const [htmlId, pdfFieldName] of Object.entries(fieldMappings)) {
      if (!pdfFieldName.includes("AptSteFlrNumber")) continue;

      try {
        const field = form.getField(pdfFieldName);
        if (!field) {
          console.warn(`Campo AptSteFlrNumber no encontrado: ${pdfFieldName}`);
          continue;
        }

        const htmlElement = document.getElementById(htmlId);
        if (!htmlElement) {
          console.warn(`Input AptSteFlrNumber no encontrado: ${htmlId}`);
          continue;
        }

        field.setText(htmlElement.value || "");
      } catch (err) {
        console.warn(`Error en campo AptSteFlrNumber ${htmlId}:`, err);
      }
    }

    form.flatten();
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error generando PDF:", error);
    hideLoading();
    throw error;
  }
}

async function updatePreview() {
  try {
    const pdfBytes = await getPdfBytes();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    if (pdfPreviewFrame.src) {
      URL.revokeObjectURL(pdfPreviewFrame.src);
    }
    const url = URL.createObjectURL(blob);
    pdfPreviewFrame.src = url;
    hideLoading();
  } catch (error) {
    alert(
      "Error al generar la vista previa. Revisa la consola para más detalles."
    );
    hideLoading();
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
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
    hideLoading();
  } catch (error) {
    alert("Error al descargar el PDF. Revisa la consola para más detalles.");
    hideLoading();
  }
}

updatePreviewBtn.addEventListener("click", updatePreview);
downloadBtn.addEventListener("click", downloadPdf);

updatePreview();
