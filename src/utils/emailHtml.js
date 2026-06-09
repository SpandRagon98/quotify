/**
 * Branded transactional email HTML (Phase 2).
 *
 * Produces a clean, inbox-friendly, table-based HTML email with the company's
 * branding, the quotation message, and a SINGLE secure "View Quotation" button
 * linking to the recipient's tracked-quote page. All approval / signature
 * actions happen on that page (your backend) — the email itself carries no
 * approve/decline boxes, keeping it simple and professional.
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text → safe HTML with line breaks preserved. */
function textToHtml(s) {
  return escapeHtml(s).replace(/\r?\n/g, "<br>");
}

/**
 * @param {object} p
 * @param {string} p.brandName        e.g. "Qyrova"
 * @param {string} [p.companyLogo]    data-URI or https logo (may be blocked by some clients)
 * @param {string} p.bodyText         the user's message (plain, \n preserved)
 * @param {string} [p.quotationId]
 * @param {string} [p.presetName]
 * @param {string} p.quoteUrl         the /q/<token> tracked-quote URL
 * @param {string} [p.accent]         CTA/header accent colour
 * @returns {string} full HTML document
 */
export function buildQuoteEmailHtml({
  brandName = "Qyrova",
  companyLogo = "",
  bodyText = "",
  quotationId = "",
  presetName = "",
  quoteUrl,
  accent = "#635bff",
}) {
  const safeBrand = escapeHtml(brandName);
  const logoImg = companyLogo
    ? `<img src="${escapeHtml(companyLogo)}" alt="" height="34" style="max-height:34px;border:0;display:block;" />`
    : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;
                    border:1px solid #e6e8ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <!-- Header -->
        <tr>
          <td style="padding:20px 28px;border-bottom:1px solid #eef0f3;">
            <table role="presentation" width="100%"><tr>
              <td style="font:700 18px/1.2 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1d21;">
                ${safeBrand}
              </td>
              <td align="right">${logoImg}</td>
            </tr></table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:26px 28px 8px;color:#33373d;font-size:15px;line-height:1.6;">
            ${textToHtml(bodyText)}
          </td>
        </tr>
        ${
          quotationId
            ? `<tr><td style="padding:6px 28px 0;">
                 <table role="presentation" width="100%" style="background:#f7f8fa;border:1px solid #eef0f3;border-radius:10px;">
                   <tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;">
                     ${presetName ? escapeHtml(presetName) + " &middot; " : ""}Quotation
                     <strong style="color:#1a1d21;">${escapeHtml(quotationId)}</strong>
                   </td></tr>
                 </table>
               </td></tr>`
            : ""
        }
        <!-- Single secure document link -->
        <tr>
          <td style="padding:24px 28px 26px;" align="center">
            <a href="${escapeHtml(quoteUrl)}" target="_blank"
               style="display:inline-block;padding:13px 34px;border-radius:10px;
                      font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                      color:#ffffff;background:${accent};text-decoration:none;">
              View Quotation
            </a>
            <div style="margin-top:14px;font-size:12px;color:#9aa1ab;">
              Open the secure link to view, download, and respond to your quotation.
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #eef0f3;background:#fbfbfc;
                     font-size:12px;color:#9aa1ab;">
            Sent securely via ${safeBrand}. Only you can respond using this link.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
