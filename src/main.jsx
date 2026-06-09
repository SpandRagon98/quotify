import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App.jsx";
import PublicQuotePage from "./components/PublicQuote/PublicQuotePage.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";

// Public tracked-quote route: /q/<token> renders a standalone, no-login page
// for the recipient. It never mounts the authenticated app.
const publicMatch = window.location.pathname.match(/^\/q\/([A-Za-z0-9_-]+)\/?$/);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      {publicMatch ? <PublicQuotePage token={publicMatch[1]} /> : <App />}
    </ErrorBoundary>
  </StrictMode>
);
