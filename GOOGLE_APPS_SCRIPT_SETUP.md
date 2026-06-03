# Google Apps Script setup for Quotify

Quotify talks to a single **Google Apps Script Web App** that handles both
Google Sheets (dynamic row append) and Google Docs (template → generated doc).
The frontend sends JSON payloads with an `action` field; the script branches on it.

This replaces the old fixed-column logic with **dynamic tabs + dynamic headers**.

> ## ⚠️ If saving "succeeds" but nothing happens, or the Database tab says "Invalid action"
> Your deployed Web App is an **older script** that doesn't implement the
> `appendRow`, `updateRow`, `generateDoc`, and `getSheetData` actions below.
> **Replace the entire script with the code in section 3 and re-deploy a new version**
> (Deploy → Manage deployments → Edit → Version: *New version* → Deploy).
> Each response now echoes its `action`; the Quotify frontend verifies this and
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
      case "generateDoc": return json(generateDoc(body));
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

  var rowOut = merged.map(function (h) { return valueMap[h] !== undefined ? valueMap[h] : ""; });
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
- **Global fallback:** `GOOGLE.SPREADSHEET_ID` in `appConfig.js` is only used when
  a preset has no linked sheet; normally you can leave it blank.
- **Offline testing:** set `GOOGLE.ENABLED = false` in `appConfig.js` to log
  payloads to the console instead of calling the network.
