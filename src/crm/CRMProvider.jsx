import { useEffect, useState } from "react";
import { bootstrap } from "./service";
import { CRMContext } from "./context";
export default function CRMProvider({ user, children }) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    members: [],
    teams: [],
    workspaces: [],
    access: {},
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!user?.orgId) {
      Promise.resolve().then(() => {
        if (active)
          setState((old) => ({
            ...old,
            loading: false,
            error:
              "CRM requires a configured Supabase workspace; local quotation/demo features remain available.",
          }));
      });
      return () => {
        active = false;
      };
    }
    bootstrap(user.orgId, controller.signal)
      .then((data) => {
        if (active) setState({ ...data, loading: false, error: "" });
      })
      .catch((e) => {
        if (active)
          setState((old) => ({ ...old, loading: false, error: e.message }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [user?.id, user?.orgId, revision]);
  return (
    <CRMContext.Provider
      value={{ ...state, user, refresh: () => setRevision((n) => n + 1) }}
    >
      {children}
    </CRMContext.Provider>
  );
}
