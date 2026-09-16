import { useCallback, useEffect, useState } from "react";
import { listRecords } from "./service";
export function useRecords(entity, orgId, options = {}) {
  const [result, setResult] = useState({
    rows: [],
    count: 0,
    loading: true,
    error: "",
  });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(options);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      setResult((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        const data = await listRecords(
          entity,
          orgId,
          JSON.parse(key),
          controller.signal,
        );
        if (active) setResult({ ...data, loading: false, error: "" });
      } catch (error) {
        if (active && !controller.signal.aborted)
          setResult({
            rows: [],
            count: 0,
            loading: false,
            error: error.message,
          });
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [entity, orgId, key, revision]);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  return { ...result, reload };
}
