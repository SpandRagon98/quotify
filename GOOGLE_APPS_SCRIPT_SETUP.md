# Google Apps Script setup for Qyrova

Qyrova talks to a single **Google Apps Script Web App** that handles both
Google Sheets (dynamic row append) and Google Docs (template → generated doc).
The frontend sends JSON payloads with an `action` field; the script branches on it.

This replaces the old fixed-column logic with **dynamic tabs + dynamic headers**.

> ## ⚠️ If saving "succeeds" but nothing happens, or the Database tab says "Invalid action"
> Your deployed Web App is an **older script** that doesn't implement the
> `appendRow`, `updateRow`, `deleteRow`, `generateDoc`, `getSheetData`, and
> `sendEmail` actions below. **Replace the entire script with the code in section 3
> and re-deploy a new version**
> (Deploy → Manage deployments → Edit → Version: *New version* → Deploy).
> Each response now echoes its `action`; the Qyrova frontend verifies this and
> will no longer show a fake success against an outdated deployment.

---

## 1. Create the script

1. Open your target Google Sheet → **Extensions → Apps Script**.
2. Delete any boilerplate and paste the code below.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the **Web App URL** and paste it into
   `src/config/appConfig.js` → `GOOGLE.APPS_SCRIPT_URL`.

---

## 2. Payloads the frontend sends

### Append a quotation row (`action: "appendRow"`)
```json
{
  "action": "appendRow",
  "presetName": "Standard Quotation",
  "sheetTabName": "Standard Quotation",
  "quotationId": "QTF-LXY12-AB3C",
  "createdAt": "2026-06-03T10:00:00.000Z",
  "updatedAt": "2026-06-03T10:00:00.000Z",
  "headers": ["Quotation ID","Preset Name","Created At","Last Updated At","Customer Name","Quantity"],
  "row": ["QTF-LXY12-AB3C","Standard Quotation","2026-06-03...","2026-06-03...","Acme","10"]
}
```

### Update an existing quotation row (`action: "updateRow"`)
Same shape as `appendRow`, but the row is **located by `quotationId`** and
overwritten in place (no new row). `Quotation ID` and `Created At` are preserved;
`Last Updated At` is stamped server-side.
```json
{
  "action": "updateRow",
  "spreadsheetId": "<sheet id>",
  "sheetTabName": "Standard Quotation",
  "quotationId": "QTF-LXY12-AB3C",
  "headers": ["Quotation ID","Preset Name","Created At","Last Updated At","Customer Name","Quantity"],
  "row": ["QTF-LXY12-AB3C","Standard Quotation","...","...","Acme Updated","12"]
}
```
Errors clearly when `quotationId` is missing or the row isn't found.

### Delete a quotation row (`action: "deleteRow"`)
Removes the row located by `quotationId` (the app restricts this to Owner/Admin).
```json
{
  "action": "deleteRow",
  "spreadsheetId": "<sheet id>",
  "sheetTabName": "Standard Quotation",
  "quotationId": "QTF-LXY12-AB3C"
}
```
Errors clearly when `quotationId` is missing or the row isn't found.

### Generate a document (`action: "generateDoc"`)
```json
{
  "action": "generateDoc",
  "templateId": "1AbCdEf...the Google Doc template ID...",
  "presetName": "Standard Quotation",
  "quotationId": "QTF-LXY12-AB3C",
  "placeholders": { "Customer Name": "Acme", "Quantity": "10", "GST Applicable": "Yes" }
}
```

The doc template should contain placeholders like `{{Customer Name}}`, `{{Quantity}}`.
Values come straight from the entered form — **the Doc never reads the Sheet**.

### Send a quotation email (`action: "sendEmail"`)
The frontend sends the recipient + the placeholder-substituted subject/body.
The script wraps the body in branded Qyrova HTML and appends the
**Approve / Decline / Negotiate** buttons before sending via Gmail.
```json
{
  "action": "sendEmail",
  "to": "customer@example.com",
  "subject": "Your quotation from Qyrova — QTF-LXY12-AB3C",
  "body": "Hello,\n\nPlease find your quotation...",
  "quotationId": "QTF-LXY12-AB3C",
  "presetName": "Standard Quotation",
  "spreadsheetId": "<sheet id>",
  "sheetTabName": "Standard Quotation"
}
```
`spreadsheetId` + `sheetTabName` let the email's Approve/Decline/Negotiate buttons
link back to this Web App and update the row's status.

### Record an email response (`GET ?action=respond`)
Opened when a customer clicks a CTA in the email — returns a branded HTML page and
writes the decision into the **Approval / Decline / Negotiate** column of the row.
```
GET <web-app-url>?action=respond&spreadsheetId=<id>&sheetTabName=Standard%20Quotation&quotationId=QTF-LXY12-AB3C&decision=Approved
```

### Read sheet data for the Database tab (`GET ?action=getSheetData`)
```
GET <web-app-url>?action=getSheetData&spreadsheetId=<id>&sheetTabName=Standard%20Quotation
```
Returns: `{ "success": true, "action": "getSheetData", "headers": [...], "rows": [[...], [...]] }`

> Every response includes its `action`. The frontend asserts this matches the
> request, so an outdated deployment is reported as an error rather than a fake success.

---

## 3. Apps Script code

```javascript
// POST handles writes (append rows, generate docs).
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "appendRow":   return json(appendRow(body));
      case "updateRow":   return json(updateRow(body));
      case "deleteRow":   return json(deleteRow(body));
      case "generateDoc": return json(generateDoc(body));
      case "sendEmail":   return json(sendEmail(body));
      default:            return json({ success: false, error: "Unknown action: " + body.action });
    }
  } catch (err) {
    return json({ success: false, error: String(err) });
  }
}

// GET handles reads (Database tab fetches the linked sheet).
function doGet(e) {
  try {
    var p = e.parameter || {};
    if (p.action === "getSheetData") return json(getSheetData(p));
    if (p.action === "respond") return respondPage(p); // email CTA click → HTML page
    return json({ success: false, error: "Unknown action: " + p.action });
  } catch (err) {
    return json({ success: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Dynamic Sheets append.
 * - Creates the tab if missing.
 * - Ensures every header in `headers` exists (adds new columns without
 *   breaking old records), then appends the row aligned to the live header order.
 */
function appendRow(body) {
  var ss = body.spreadsheetId
    ? SpreadsheetApp.openById(body.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(body.sheetTabName) || ss.insertSheet(body.sheetTabName);

  // Read existing header row (if any).
  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(String)
    : [];

  // Merge incoming headers into existing (preserve old order, append new ones).
  var merged = existing.slice();
  body.headers.forEach(function (h) {
    if (merged.indexOf(h) === -1) merged.push(h);
  });

  // Write the (possibly extended) header row.
  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);

  // Build a value map from incoming headers→row, then align to merged order.
  var valueMap = {};
  body.headers.forEach(function (h, i) { valueMap[h] = body.row[i]; });
  var rowOut = merged.map(function (h) { return valueMap[h] !== undefined ? valueMap[h] : ""; });

  sheet.appendRow(rowOut);
  return {
    success: true,
    action: "appendRow",
    sheetTabName: body.sheetTabName,
    rowNumber: sheet.getLastRow(),
    columns: merged.length
  };
}

/**
 * Update an EXISTING row in place (no new row).
 * Finds the row by "Quotation ID", preserves Created At, stamps Last Updated At.
 */
function updateRow(body) {
  if (!body.quotationId) return { success: false, error: "Missing quotationId — cannot update." };

  var ss = body.spreadsheetId
    ? SpreadsheetApp.openById(body.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(body.sheetTabName);
  if (!sheet) return { success: false, error: "Sheet tab not found: " + body.sheetTabName };

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: false, error: "No data rows to update." };

  // Merge in any new headers (fields added since the row was created).
  var headerRow = values[0].map(String);
  var merged = headerRow.slice();
  body.headers.forEach(function (h) { if (merged.indexOf(h) === -1) merged.push(h); });
  if (merged.length !== headerRow.length) {
    sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  }

  var idCol = merged.indexOf("Quotation ID");
  if (idCol === -1) return { success: false, error: "No 'Quotation ID' column found." };

  // Locate the row (data starts at array index 1 → sheet row index + 1).
  var target = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(body.quotationId)) { target = r; break; }
  }
  if (target === -1) return { success: false, error: "Quotation not found: " + body.quotationId };

  // Build the new row, preserving identity + creation time.
  var valueMap = {};
  body.headers.forEach(function (h, i) { valueMap[h] = body.row[i]; });

  var createdIdx = merged.indexOf("Created At");
  if (createdIdx !== -1 && createdIdx < values[target].length) {
    valueMap["Created At"] = values[target][createdIdx];
  }
  valueMap["Quotation ID"] = body.quotationId;
  valueMap["Last Updated At"] = new Date().toISOString();

  // Preserve any existing column not present in the payload (e.g. status columns).
  var existingRow = values[target];
  var rowOut = merged.map(function (h, idx) {
    if (valueMap[h] !== undefined) return valueMap[h];
    return idx < existingRow.length ? existingRow[idx] : "";
  });
  sheet.getRange(target + 1, 1, 1, merged.length).setValues([rowOut]);

  return {
    success: true,
    action: "updateRow",
    quotationId: body.quotationId,
    rowNumber: target + 1,
    updatedAt: valueMap["Last Updated At"]
  };
}

/**
 * Delete a row, located by Quotation ID (Owner/Admin only — enforced by the app).
 */
function deleteRow(body) {
  if (!body.quotationId) return { success: false, error: "Missing quotationId — cannot delete." };

  var ss = body.spreadsheetId
    ? SpreadsheetApp.openById(body.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(body.sheetTabName);
  if (!sheet) return { success: false, error: "Sheet tab not found: " + body.sheetTabName };

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: false, error: "No data rows to delete." };

  var idCol = values[0].map(String).indexOf("Quotation ID");
  if (idCol === -1) return { success: false, error: "No 'Quotation ID' column found." };

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(body.quotationId)) {
      sheet.deleteRow(r + 1); // sheet rows are 1-based
      return { success: true, action: "deleteRow", quotationId: body.quotationId };
    }
  }
  return { success: false, error: "Quotation not found: " + body.quotationId };
}

/**
 * Read a preset's linked sheet/tab for the Database tab.
 * Returns the header row + all data rows (as a 2D array).
 */
function getSheetData(p) {
  var ss = p.spreadsheetId
    ? SpreadsheetApp.openById(p.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(p.sheetTabName);
  if (!sheet) return { success: true, action: "getSheetData", headers: [], rows: [] };

  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return { success: true, action: "getSheetData", headers: [], rows: [] };

  var headers = values[0].map(String);
  var rows = values.slice(1);
  return { success: true, action: "getSheetData", headers: headers, rows: rows };
}

/**
 * Copy a Doc template, replace {{placeholders}}, return the new doc URL.
 */
function generateDoc(body) {
  if (!body.templateId) return { success: false, error: "Missing templateId" };

  var template = DriveApp.getFileById(body.templateId);
  var copyName = body.presetName + " - " + body.quotationId;
  var copy = template.makeCopy(copyName);
  var doc = DocumentApp.openById(copy.getId());
  var docBody = doc.getBody();

  Object.keys(body.placeholders || {}).forEach(function (key) {
    docBody.replaceText("\\{\\{" + escapeRegex(key) + "\\}\\}", String(body.placeholders[key]));
  });

  doc.saveAndClose();
  return { success: true, action: "generateDoc", docUrl: copy.getUrl(), docId: copy.getId() };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Send a branded Qyrova email via Gmail.
 * `body` arrives with placeholders already replaced. We wrap it in branded HTML
 * and append Approve / Decline / Negotiate buttons that reply to the SENDING
 * account (Session user) — so no Gmail address is hardcoded.
 */
function sendEmail(body) {
  if (!body.to) return { success: false, error: "Missing recipient email." };

  var quoteId = body.quotationId || "";
  var subject = body.subject || ("Quotation " + quoteId);
  var webAppUrl = ScriptApp.getService().getUrl(); // this deployment's URL

  var safe = String(body.body || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  var bodyHtml = safe.replace(/\n/g, "<br>");

  // CTAs are HTTP links back to this Web App; clicking records the decision.
  function cta(label, decision, color) {
    var url = webAppUrl + "?action=respond" +
      "&spreadsheetId=" + encodeURIComponent(body.spreadsheetId || "") +
      "&sheetTabName=" + encodeURIComponent(body.sheetTabName || "") +
      "&quotationId=" + encodeURIComponent(quoteId) +
      "&decision=" + encodeURIComponent(decision);
    return '<a href="' + url + '" style="display:inline-block;padding:10px 18px;margin:4px;' +
      'border-radius:8px;background:' + color + ';color:#fff;text-decoration:none;font-weight:600;">' +
      label + '</a>';
  }

  var html =
    '<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#14161f;">' +
      '<div style="background:#635bff;padding:18px 24px;border-radius:12px 12px 0 0;">' +
        '<span style="color:#fff;font-size:20px;font-weight:800;">Qyrova</span></div>' +
      '<div style="border:1px solid #e7e8ee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">' +
        '<div style="font-size:14px;line-height:1.6;">' + bodyHtml + '</div>' +
        '<div style="margin-top:24px;text-align:center;">' +
          cta("Approve", "Approved", "#2b9a66") +
          cta("Decline", "Declined", "#e5484d") +
          cta("Negotiate", "Negotiate", "#b7791f") +
        '</div>' +
        '<p style="margin-top:24px;font-size:12px;color:#8c91a3;">Sent via Qyrova</p>' +
      '</div></div>';

  GmailApp.sendEmail(body.to, subject, body.body || "", { htmlBody: html, name: "Qyrova" });
  return { success: true, action: "sendEmail", to: body.to };
}

/**
 * Record an Approve / Decline / Negotiate response against a quotation row.
 * Ensures the Approval / Decline / Negotiate columns exist, sets the chosen one
 * and clears the others. Located by Quotation ID.
 */
function setStatus(p) {
  if (!p.quotationId) throw new Error("Missing quotationId");

  var ss = p.spreadsheetId
    ? SpreadsheetApp.openById(p.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(p.sheetTabName);
  if (!sheet) throw new Error("Sheet tab not found: " + p.sheetTabName);

  var values = sheet.getDataRange().getValues();
  var headerRow = values[0].map(String);
  var merged = headerRow.slice();
  ["Approval", "Decline", "Negotiate"].forEach(function (c) {
    if (merged.indexOf(c) === -1) merged.push(c);
  });
  if (merged.length !== headerRow.length) {
    sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  }

  var idCol = merged.indexOf("Quotation ID");
  if (idCol === -1) throw new Error("No 'Quotation ID' column found.");

  var target = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(p.quotationId)) { target = r; break; }
  }
  if (target === -1) throw new Error("Quotation not found: " + p.quotationId);

  function setCell(name, val) {
    var c = merged.indexOf(name);
    if (c !== -1) sheet.getRange(target + 1, c + 1).setValue(val);
  }
  // One decision is active at a time.
  setCell("Approval", "");
  setCell("Decline", "");
  setCell("Negotiate", "");
  if (p.decision === "Approved") setCell("Approval", "Approved");
  else if (p.decision === "Declined") setCell("Decline", "Declined");
  else if (p.decision === "Negotiate") setCell("Negotiate", "Negotiate");

  return p.decision;
}

/** HTML thank-you page shown after a customer clicks an email CTA. */
function respondPage(p) {
  var decision;
  try {
    decision = setStatus(p);
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Arial;max-width:480px;margin:40px auto;text-align:center;">' +
      '<h2 style="color:#635bff;">Qyrova</h2><p>Could not record your response: ' +
      err.message + '</p></div>');
  }
  var color = decision === "Approved" ? "#2b9a66" : decision === "Declined" ? "#e5484d" : "#b7791f";
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial;max-width:480px;margin:40px auto;text-align:center;">' +
      '<div style="background:#635bff;color:#fff;font-weight:800;font-size:22px;padding:16px;border-radius:12px 12px 0 0;">Qyrova</div>' +
      '<div style="border:1px solid #e7e8ee;border-top:none;border-radius:0 0 12px 12px;padding:28px;">' +
        '<div style="display:inline-block;background:' + color + ';color:#fff;padding:8px 18px;border-radius:999px;font-weight:700;">' + decision + '</div>' +
        '<p style="margin-top:18px;color:#565b6e;">Thank you — your response for quotation <b>' +
        (p.quotationId || "") + '</b> has been recorded.</p>' +
      '</div></div>');
}
```

---

## 4. Notes

- **Preset-specific links:** each preset stores its own Google Sheet and Google
  Doc links (set via *Link Google Sheet* / *Link Google Doc* in the preset editor).
  The frontend sends the preset's `spreadsheetId` and `templateId` on every call,
  so one Web App deployment serves all presets.
- **Re-deploy required:** editing the script is not enough — Apps Script Web Apps
  serve the last *deployed* version. After pasting, **Deploy → Manage deployments →
  Edit (✏️) → Version: New version → Deploy**. Skipping this is the #1 cause of
  "Invalid action" / saves that don't appear in the sheet.
- **Doc template sharing:** the Google Doc template must be accessible to the
  account running the script (the owner) — otherwise `generateDoc` can't copy it.
- **Load & Update (Database tab):** clicking *Load* on a row pulls it back into
  the form; *Update* sends `updateRow`, which finds the row by `Quotation ID` and
  overwrites it — the quotation number stays the same and no duplicate is created.
- **Email tab (Gmail):** `sendEmail` uses `GmailApp`, which needs the Gmail scope.
  After pasting the script, run any function once (or re-deploy) and **accept the
  new Gmail permission** when prompted. Emails are sent from the deploying account.
- **Status buttons:** the Approve / Decline / Negotiate buttons are HTTP links back
  to this Web App (`respond`). Clicking writes the decision into the row's
  **Approval / Decline / Negotiate** column, which then shows as a coloured badge in
  the Email/Database tables. `updateRow` preserves these columns, so editing a
  quotation later won't erase a recorded status.
- **Doc View tab:** embeds `https://docs.google.com/document/d/<id>/preview`, so the
  preset's Google Doc must be shared (at least *Anyone with the link can view*).
- **Delete records:** `deleteRow` removes a row by Quotation ID. The app only shows
  the Delete action to Owner/Admin; success is reported only after the script confirms.
- **Login & roles (current = localStorage):** users sign in with their email. The
  owner email (`spandan305@gmail.com`) is always Owner; others must be added with a
  role by an Owner/Admin (stored in the browser under `quotify.users.v1`).
  **Backend migration:** replace `src/hooks/useAuth.js` storage calls with API
  calls (e.g. a `users` action in this Apps Script backed by a "Users" sheet, or a
  real auth provider) — the role helpers in `src/auth/roles.js` stay unchanged.
- **Global fallback:** `GOOGLE.SPREADSHEET_ID` in `appConfig.js` is only used when
  a preset has no linked sheet; normally you can leave it blank.
- **Offline testing:** set `GOOGLE.ENABLED = false` in `appConfig.js` to log
  payloads to the console instead of calling the network.
