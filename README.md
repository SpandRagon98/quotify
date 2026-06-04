# Qyrova

**Qyrova** is a dynamic quotation & form-builder. Instead of fixed input fields,
you design your own **presets** — each with custom fields, its own Google Sheet
tab, and its own Google Doc template. Fill a preset's form, preview it, then save
to Google Sheets and/or generate a document from a Doc template.

## Features

- 🧱 **Dynamic field builder** — Text, Number, Yes/No, Date, Dropdown, Long Text, Email, Phone
- 📋 **Multiple presets** — each preset has completely independent fields (duplicate field names are blocked)
- ✅ **Per-type validation** — required checks, number/email/phone formats, letters-only text, dropdown options
- 🔀 **Reorder / edit / delete** fields; mark required; set defaults, placeholders & options
- 🔗 **Preset-level Google links** — *Link / View Google Sheet* and *Link / View Google Doc* per preset, with URL validation
- 🏷️ **Placeholder panel** — every field shows its `{{Field Name}}` token with one-click Copy / Copy All
- 📊 **Per-preset Google Sheets** — saved rows go to that preset's linked spreadsheet/tab; columns build from field labels and extend without breaking old rows
- 📄 **Per-preset Google Docs** — generation sends entered values straight to the linked template (the Doc never reads the Sheet)
- 🗄️ **Database tab** — browse a preset's linked sheet in a premium table with search, per-column filters, refresh, CSV export, and loading/empty/error states
- 💾 **localStorage persistence** — presets are saved locally (swappable for a backend later); old presets auto-migrate
- 🎨 **Modern SaaS UI** — sidebar dashboard, smooth Framer Motion transitions, responsive layout

## Tech stack

| Layer | Tech |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Backend | Google Apps Script (Sheets + Docs) |
| Storage | Browser localStorage |

## Folder structure

```
src/
├── components/
│   ├── Layout/          AppLayout (sidebar + shell, incl. Database nav)
│   ├── Dashboard/       Dashboard overview
│   ├── PresetManager/   PresetManager (list) + PresetEditor (create/edit)
│   │                    + IntegrationPanel (link Sheet/Doc) + LinkModal
│   │                    + PlaceholderPanel ({{token}} copy)
│   ├── FieldBuilder/    FieldBuilder + FieldEditorRow (dynamic fields)
│   ├── DynamicForm/     DynamicForm + FieldInput (renders a preset's form)
│   ├── QuotationPreview/ Review + save/generate screen
│   ├── Database/        DatabasePage + DataTable (browse linked sheet)
│   └── common/          Modal (reusable animated modal)
├── services/
│   ├── googleSheetsService.js   appendQuotationRow() + fetchSheetData()
│   ├── googleDocsService.js     generateDocument()
│   └── quotationService.js      payloads + submit + fetchPresetData + link guards
├── hooks/
│   └── usePresets.js    localStorage-backed preset store (auto-migrates old presets)
├── config/
│   └── appConfig.js     app + Google integration config (single source)
├── utils/
│   ├── validation.js    field/form/preset validation + input filtering
│   ├── fieldFormatters.js  field-type metadata + value formatting
│   ├── googleLinks.js   URL validation, ID extraction, placeholders, preset normalisation
│   ├── tableData.js     search / column filter / CSV helpers for Database
│   └── idGenerator.js   IDs for presets, fields, quotations
├── data/
│   └── defaultPresets.js  sample presets seeded on first run
├── styles/
│   └── global.css       design system + all component styles
├── App.jsx              view state machine wiring screens together
└── main.jsx             entry point
```

## Preset data model

```js
{
  id, name, description, fields,
  googleSheetUrl, googleSheetId,   // linked spreadsheet
  googleDocUrl,  googleDocId,      // linked doc template
  sheetTabName,                    // tab within the spreadsheet
  createdAt, updatedAt
}
```

Older presets (which used `docTemplateId`) are migrated automatically on load.

## How Sheet / Doc linking works

- Each preset stores its own Google Sheet and Google Doc links. In the **preset
  editor → Google integration**, *Link* opens a modal to paste/validate the URL;
  *View* (disabled until linked) opens it in a new tab.
- **Saving** a quotation writes to that preset's linked sheet/tab. With no sheet
  linked, save is blocked: _"Please link a Google Sheet for this preset before saving details."_
- **Generating** sends the entered field values straight to the linked Doc
  template for `{{placeholder}}` replacement (it does **not** read the Sheet).
  With no doc linked, generation is blocked: _"Please link a Google Doc template
  for this preset before generating the quotation."_

## How placeholders work

The **Placeholder panel** (preset editor) lists every field as `{{Field Name}}`,
updating live as fields are added/edited/deleted. Copy a single token or **Copy
all**, then paste into your Google Doc template. Duplicate field names are
rejected on save so every placeholder is unique.

## How the Database tab works

The left-sidebar **Database** tab reads a preset's linked Google Sheet
independently of the save flow:

1. Pick a preset; the app fetches its linked sheet via `?action=getSheetData`.
2. Search across all columns, apply per-column filters, **Refresh**, or **Export
   CSV** (of the filtered view).
3. Loading, empty, error, and "no sheet linked" states are all handled.

## Run locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/quotify/`.

## Build

```bash
npm run build
```

Output goes to `dist/` (base path `/quotify/`, set in `vite.config.js`).

## How dynamic presets work

1. **Create a preset** (Presets → New Preset): give it a name, an optional
   description, a target **Google Sheet tab name**, and an optional **Google Doc
   template link/ID**.
2. **Add fields** with the field builder: pick a type, label, required flag,
   default, placeholder, and (for dropdowns) options. Reorder with the arrows.
3. **Save** — the preset is stored in localStorage.
4. **Use a preset** (Dashboard tile or Presets → *Use*): the form is generated
   from that preset's fields, validated on submit, then previewed before saving.

## How Google Sheets integration works

- On save, `quotationService` builds a payload: `{ presetName, sheetTabName,
  headers, row, quotationId, createdAt, updatedAt }`.
- Headers = metadata columns (`Quotation ID`, `Preset Name`, `Created At`,
  `Last Updated At`) + each field's label.
- The Apps Script ensures the tab exists, merges/extends headers, and appends the
  row aligned to the live header order — so **adding fields later won't break old
  records**.

## How Google Doc template mapping works

- Each preset stores its own `docTemplateId` (link or ID).
- On *Save & Generate Doc*, the payload sends `{ templateId, placeholders }` where
  `placeholders` maps **field label → value**.
- The Apps Script copies the template and replaces `{{Field Label}}` tokens,
  returning the new document's link.

## Configure new Google Sheet & Doc links

All integration config lives in **`src/config/appConfig.js`**:

- `GOOGLE.APPS_SCRIPT_URL` — your Apps Script Web App URL
- `GOOGLE.SPREADSHEET_ID` — optional specific spreadsheet (blank = script's bound sheet)
- `GOOGLE.ENABLED` — set `false` to test the UI offline (payloads logged to console)
- Per-preset **Doc template** is set in the UI on each preset.

See **[GOOGLE_APPS_SCRIPT_SETUP.md](GOOGLE_APPS_SCRIPT_SETUP.md)** for the full
Apps Script code and deployment steps.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to
GitHub Pages on every push to `main` → `https://<user>.github.io/quotify/`.
