# Quotify

**Quotify** is a dynamic quotation & form-builder. Instead of fixed input fields,
you design your own **presets** — each with custom fields, its own Google Sheet
tab, and its own Google Doc template. Fill a preset's form, preview it, then save
to Google Sheets and/or generate a document from a Doc template.

## Features

- 🧱 **Dynamic field builder** — Text, Number, Yes/No, Date, Dropdown, Long Text, Email, Phone
- 📋 **Multiple presets** — each preset has completely independent fields
- ✅ **Per-type validation** — required checks, number/email/phone formats, letters-only text, dropdown options
- 🔀 **Reorder / edit / delete** fields; mark required; set defaults, placeholders & options
- 📊 **Dynamic Google Sheets** — each preset writes to its own tab; columns are created from field labels; new fields extend columns without breaking old rows
- 📄 **Dynamic Google Docs** — each preset maps to a Doc template; `{{Field Label}}` placeholders are filled on generate
- 💾 **localStorage persistence** — presets are saved locally (swappable for a backend later)
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
│   ├── Layout/          AppLayout (sidebar + shell)
│   ├── Dashboard/       Dashboard overview
│   ├── PresetManager/   PresetManager (list) + PresetEditor (create/edit)
│   ├── FieldBuilder/    FieldBuilder + FieldEditorRow (dynamic fields)
│   ├── DynamicForm/     DynamicForm + FieldInput (renders a preset's form)
│   └── QuotationPreview/ Review + save/generate screen
├── services/
│   ├── googleSheetsService.js   appendQuotationRow()
│   ├── googleDocsService.js     generateDocument()
│   └── quotationService.js      builds payloads + orchestrates submit
├── hooks/
│   └── usePresets.js    localStorage-backed preset store
├── config/
│   └── appConfig.js     app + Google integration config (single source)
├── utils/
│   ├── validation.js    field/form/preset validation + input filtering
│   ├── fieldFormatters.js  field-type metadata + value formatting
│   └── idGenerator.js   IDs for presets, fields, quotations
├── data/
│   └── defaultPresets.js  sample presets seeded on first run
├── styles/
│   └── global.css       design system + all component styles
├── App.jsx              view state machine wiring screens together
└── main.jsx             entry point
```

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
