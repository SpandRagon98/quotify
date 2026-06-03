# Quotify — RK Enterprise Quotation Automation App

A React web application for generating and managing container quotations for R.K. Enterprise. Quotations are saved to Google Sheets via Apps Script and can be exported as PDFs.

## What the app does

- Fill in client details, container specs, and optional features
- Instantly see a live cost breakdown including GST (18%)
- Save the quotation to Google Sheets (auto-generates a quotation number)
- Generate and open a PDF quotation directly from the browser
- Search previously saved quotations by client name and quotation number
- View or regenerate the PDF for any saved quotation

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Backend | Google Apps Script (via fetch) |
| Styling | Custom CSS (Montserrat font) |

## Folder structure

```
src/
├── components/
│   ├── DetailBox.jsx      # Read-only label/value display
│   ├── Field.jsx          # Text / number / date input
│   └── ToggleField.jsx    # Checkbox toggle card
├── data/
│   └── constants.js       # APPS_SCRIPT_URL, GST_PERCENT, initialForm, PRODUCT_TYPES
├── pages/
│   ├── QuotationPage.jsx  # Main quotation form + live preview panel
│   └── SearchPage.jsx     # Customer search + results with PDF viewer
├── utils/
│   ├── api.js             # Fetch wrappers for Google Apps Script endpoints
│   ├── calculations.js    # Pure cost calculation function (calculateQuote)
│   └── formatters.js      # safeNumber, formatINR helpers
├── App.css                # All component styles + responsive breakpoints
├── App.jsx                # Root: state, API calls, page routing
├── index.css              # Global base styles (font, reset)
└── main.jsx               # React DOM entry point
```

## How to install

```bash
npm install
```

## How to run locally

```bash
npm run dev
```

Opens at `http://localhost:5173/quotify/`

## How to build

```bash
npm run build
```

Output goes to `dist/`. The base path is `/quotify/` (set in `vite.config.js`).

## How to preview the production build

```bash
npm run preview
```

## Deployment notes

- The app is configured for deployment under the `/quotify/` sub-path (e.g., GitHub Pages at `https://SpanDragon.github.io/quotify/`).
- To deploy to GitHub Pages, push the `dist/` folder to the `gh-pages` branch or use the [vite-plugin-gh-pages](https://github.com/caioreix/vite-plugin-gh-pages) package.
- The Google Apps Script URL is in `src/data/constants.js`. Keep this URL private — do not expose it in public forks.
- No `.env` file is required; all configuration is in `src/data/constants.js`.
