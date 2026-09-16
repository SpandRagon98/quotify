import { useEffect, useState } from "react";
import { rpc } from "./service";
export function useQuery(name, args, revision = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const key = JSON.stringify(args);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((old) => ({ ...old, loading: true, error: "" }));
      try {
        const data = await rpc(name, JSON.parse(key), controller.signal);
        if (active) setState({ data, loading: false, error: "" });
      } catch (e) {
        if (active && !controller.signal.aborted)
          setState({ data: null, loading: false, error: e.message });
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [name, key, revision]);
  return state;
}
