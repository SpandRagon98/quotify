# Google Apps Script setup for Quotify

Quotify talks to a single **Google Apps Script Web App** that handles both
Google Sheets (dynamic row append) and Google Docs (template → generated doc).
The frontend sends JSON payloads with an `action` field; the script branches on it.

This replaces the old fixed-column logic with **dynamic tabs + dynamic headers**.

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

---

## 3. Apps Script code

```javascript
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "appendRow":   return json(appendRow(body));
      case "generateDoc": return json(generateDoc(body));
      default:            return json({ success: false, error: "Unknown action" });
    }
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
  return { success: true, sheetTabName: body.sheetTabName, columns: merged.length };
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
  return { success: true, docUrl: copy.getUrl(), docId: copy.getId() };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

---

## 4. Notes

- **New Sheet link:** set `GOOGLE.SPREADSHEET_ID` in `appConfig.js`, or bind the
  script to the new sheet and leave it blank.
- **New Doc templates:** assign per preset in the UI (Preset → *Google Doc template
  link / ID*). Each preset can use a different template.
- **Offline testing:** set `GOOGLE.ENABLED = false` in `appConfig.js` to log
  payloads to the console instead of calling the network.
