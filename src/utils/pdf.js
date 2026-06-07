/**
 * Capture a DOM element into an A4 PDF (image-based) using html2canvas + jsPDF.
 * Used to attach the native document to an email. The on-screen download still
 * uses the browser's print-to-PDF for crisp vector text.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function surfaceColor() {
  const c = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  return c || "#ffffff";
}

async function renderCanvas(el) {
  return html2canvas(el, {
    scale: 2,
    backgroundColor: surfaceColor(),
    useCORS: true,
    logging: false,
    windowWidth: el.offsetWidth || 794,
  });
}

function canvasToPdf(canvas) {
  const pdf = new jsPDF({ unit: "px", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.92);

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  return pdf;
}

/** Generate a PDF from `el` and return its base64 (no data-URI prefix). */
export async function elementToPdfBase64(el) {
  const pdf = canvasToPdf(await renderCanvas(el));
  const uri = pdf.output("datauristring");
  return uri.substring(uri.indexOf("base64,") + 7);
}

/** Generate a PDF from `el` and return an object URL (for opening in a new tab). */
export async function elementToPdfBlobUrl(el) {
  const pdf = canvasToPdf(await renderCanvas(el));
  return URL.createObjectURL(pdf.output("blob"));
}
