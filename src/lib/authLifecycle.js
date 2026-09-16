/** Supabase awaits auth listeners while holding its session lock. Never return
 * a promise or start authenticated database work inside that callback. */
export function observeAuthContext(auth, { load, onReady, onError, timeoutMs = 15000 }) {
  let disposed = false;
  let generation = 0;
  let deferred;
  let controller;
  let deadline;

  const fail = (version, error) => {
    if (disposed || version !== generation) return;
    generation += 1;
    clearTimeout(deferred);
    clearTimeout(deadline);
    controller?.abort();
    onError(error);
  };
  const armDeadline = (version) => {
    clearTimeout(deadline);
    deadline = setTimeout(() => fail(version, new Error(
      "Your workspace took too long to load. Check your connection and try again."
    )), timeoutMs);
  };
  const schedule = (session) => {
    if (disposed) return;
    const version = ++generation;
    clearTimeout(deferred);
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    armDeadline(version);
    // A macrotask, not a microtask: the auth callback and lock must finish first.
    deferred = setTimeout(() => {
      Promise.resolve().then(() => load(session?.user || null, signal)).then((context) => {
        if (disposed || version !== generation) return;
        clearTimeout(deadline);
        onReady(context);
      }).catch((error) => fail(version, error));
    }, 0);
  };

  armDeadline(0);
  const { data } = auth.onAuthStateChange((_event, session) => {
    schedule(session); // Deliberately synchronous and returns undefined.
  });
  Promise.resolve().then(() => auth.getSession()).then(({ data, error }) => {
    // A newer sign-in/sign-out event outranks the initial session snapshot.
    if (disposed || generation !== 0) return;
    if (error) fail(0, error);
    else schedule(data?.session || null);
  }).catch((error) => fail(0, error));

  return () => {
    disposed = true;
    generation += 1;
    clearTimeout(deferred);
    clearTimeout(deadline);
    controller?.abort();
    data?.subscription?.unsubscribe();
  };
}
