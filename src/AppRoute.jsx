import { lazy, Suspense } from "react";
import LoadingScreen from "./components/common/LoadingScreen";
const App = lazy(() => import("./App.jsx"));
const PublicQuotePage = lazy(
  () => import("./components/PublicQuote/PublicQuotePage.jsx"),
);
const ChangeOrderApprovalPage = lazy(
  () => import("./components/ChangeOrder/ChangeOrderApprovalPage.jsx"),
);
export default function AppRoute({ publicToken, changeOrderToken }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      {publicToken ? <PublicQuotePage token={publicToken} /> : changeOrderToken ? <ChangeOrderApprovalPage token={changeOrderToken} /> : <App />}
    </Suspense>
  );
}
