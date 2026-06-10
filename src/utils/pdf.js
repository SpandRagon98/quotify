/**
 * Capture a DOM element into an A4 PDF (image-based) using html2canvas + jsPDF.
 * Used to attach the native document to an email. The on-screen download still
 * uses the browser's print-to-PDF for crisp vector text.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// html2canvas (1.4.1) cannot parse modern CSS color functions — color-mix(),
// oklch(), oklab(), lab(), lch(), hwb(), color(srgb …). Our theme uses
// color-mix() heavily, so capture threw a "parse color" error (the Native PDF
// "View" failure). We rewrite any such color in the off-screen capture subtree
// to an rgb/hex equivalent first, then restore the DOM afterward.
const UNSUPPORTED_COLOR = /color-mix|oklch|oklab|lab\(|lch\(|hwb\(|color\(/i;

const SINGLE_COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "caret-color",
  "column-rule-color",
  "fill",
  "stroke",
];

let _probeCtx;
/**
 * Normalize any browser-parseable color to plain `rgba(r, g, b, a)` by actually
 * rasterizing it to a pixel. (Using canvas `fillStyle` alone is not enough —
 * Chrome returns wide-gamut values like `color(srgb …)` unchanged, which
 * html2canvas still can't parse. Reading the painted pixel always yields 8-bit
 * sRGB, exactly what gets rendered anyway.)
 */
function toRgb(value) {
  try {
    if (!value) return null;
    if (!_probeCtx) {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      _probeCtx = c.getContext("2d", { willReadFrequently: true });
    }
    _probeCtx.clearRect(0, 0, 1, 1);
    _probeCtx.fillStyle = "#000000";
    _probeCtx.fillStyle = value; // the browser parses color-mix/oklch/color()/…
    _probeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = _probeCtx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return null;
  }
}

/**
 * Inline-rewrite unsupported colors on `root` and its descendants so html2canvas
 * can parse them. Returns a function that restores the original inline styles.
 */
function neutralizeModernColors(root) {
  const saved = [];
  const nodes = [root, ...root.querySelectorAll("*")];
  for (const node of nodes) {
    if (!node.style) continue;
    const cs = getComputedStyle(node);
    let original = null;
    const remember = () => {
      if (original === null) original = node.getAttribute("style") || "";
    };
    for (const prop of SINGLE_COLOR_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (val && UNSUPPORTED_COLOR.test(val)) {
        const rgb = toRgb(val);
        if (rgb) {
          remember();
          node.style.setProperty(prop, rgb);
        }
      }
    }
    // Composite properties can't be canvas-normalized — drop them for capture.
    for (const prop of ["box-shadow", "background-image"]) {
      const val = cs.getPropertyValue(prop);
      if (val && UNSUPPORTED_COLOR.test(val)) {
        remember();
        node.style.setProperty(prop, "none");
      }
    }
    if (original !== null) saved.push([node, original]);
  }
  return () => {
    for (const [node, style] of saved) {
      if (style) node.setAttribute("style", style);
      else node.removeAttribute("style");
    }
  };
}

function surfaceColor() {
  const c = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  return toRgb(c) || c || "#ffffff";
}

async function renderCanvas(el) {
  if (!el) throw new Error("Document is not ready to render. Please try again.");
  const restore = neutralizeModernColors(el);
  try {
    return await html2canvas(el, {
      scale: 2,
      backgroundColor: surfaceColor(),
      useCORS: true,
      logging: false,
      windowWidth: el.offsetWidth || 794,
    });
  } finally {
    restore();
  }
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

/** Generate a PDF from `el` and trigger a browser download. */
export async function downloadElementPdf(el, filename = "quotation.pdf") {
  const pdf = canvasToPdf(await renderCanvas(el));
  pdf.save(filename);
}
