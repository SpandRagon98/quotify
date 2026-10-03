import { useCallback, useEffect, useState } from "react";
import { journeyRecords } from "./journeyService";
export function useJourney(entity, orgId, options = {}) {
  const [state, setState] = useState({
    rows: [],
    count: 0,
    loading: true,
    error: "",
  });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(options);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((old) => ({ ...old, loading: true, error: "" }));
      try {
        const result = await journeyRecords(
          entity,
          orgId,
          JSON.parse(key),
          controller.signal,
        );
        if (active) setState({ ...result, loading: false, error: "" });
      } catch (error) {
        if (active && !controller.signal.aborted)
          setState({
            rows: [],
            count: 0,
            loading: false,
            error: error.message,
          });
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [entity, orgId, key, revision]);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  return { ...state, reload };
}
