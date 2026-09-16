import { lazy, Suspense } from "react";
import LoadingScreen from "./components/common/LoadingScreen";
const App = lazy(() => import("./App.jsx"));
const PublicQuotePage = lazy(
  () => import("./components/PublicQuote/PublicQuotePage.jsx"),
);
export default function AppRoute({ publicToken }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      {publicToken ? <PublicQuotePage token={publicToken} /> : <App />}
    </Suspense>
  );
}
