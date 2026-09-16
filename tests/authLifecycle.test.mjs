import test from "node:test";
import assert from "node:assert/strict";
import { observeAuthContext } from "../src/lib/authLifecycle.js";
import { createClient } from "@supabase/supabase-js";

const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));
const session = (id) => ({ user: { id } });
function fakeAuth(initial = null) {
  const callbacks = new Set();
  let locked = false;
  return {
    callbacks,
    getSession: async () => ({ data: { session: initial } }),
    onAuthStateChange(callback) {
      callbacks.add(callback);
      return { data: { subscription: { unsubscribe: () => callbacks.delete(callback) } } };
    },
    async emit(value) {
      locked = true;
      for (const callback of callbacks) {
        const result = callback("SIGNED_IN", value);
        assert.equal(result, undefined, "Auth callbacks must not return database promises");
        await result;
      }
      locked = false;
    },
    assertUnlocked: () => assert.equal(locked, false, "Database work ran under the auth lock"),
  };
}

test("restores a saved session and keeps both auth/cloud listeners outside the lock", async () => {
  const auth = fakeAuth(session("saved"));
  const results = [];
  const options = {
    load: async (user) => { auth.assertUnlocked(); return user?.id || null; },
    onReady: (value) => results.push(value),
    onError: (error) => assert.fail(error.message),
  };
  const stopAuth = observeAuthContext(auth, options);
  const stopCloud = observeAuthContext(auth, options);
  await delay();
  assert.deepEqual(results, ["saved", "saved"]);
  await auth.emit(session("signed-in"));
  await delay();
  assert.deepEqual(results, ["saved", "saved", "signed-in", "signed-in"]);
  stopAuth(); stopCloud();
  assert.equal(auth.callbacks.size, 0);
});

test("an old getSession snapshot cannot override a newer auth event", async () => {
  const auth = fakeAuth();
  let resolveInitial;
  auth.getSession = () => new Promise((resolve) => { resolveInitial = resolve; });
  const results = [];
  const stop = observeAuthContext(auth, {
    load: async (user) => user?.id || null,
    onReady: (value) => results.push(value), onError: assert.fail,
  });
  await delay();
  await auth.emit(session("new"));
  resolveInitial({ data: { session: session("old") } });
  await delay();
  assert.deepEqual(results, ["new"]);
  stop();
});

test("sign-out cancels an old user's in-flight profile load", async () => {
  const auth = fakeAuth(session("old"));
  const results = [];
  let finishOld;
  let oldSignal;
  const stop = observeAuthContext(auth, {
    load: (user, signal) => user ? new Promise((resolve) => {
      finishOld = resolve; oldSignal = signal;
    }) : null,
    onReady: (value) => results.push(value), onError: assert.fail,
  });
  await delay();
  await auth.emit(null);
  await delay();
  finishOld("old");
  await delay();
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(results, [null]);
  stop();
});

test("hung session restoration shows an error instead of an infinite splash", async () => {
  const auth = fakeAuth();
  auth.getSession = () => new Promise(() => {});
  const errors = [];
  const stop = observeAuthContext(auth, {
    load: assert.fail, onReady: assert.fail,
    onError: (error) => errors.push(error.message), timeoutMs: 15,
  });
  await delay(35);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /too long/);
  stop();
});

test("hung profile queries are aborted and their late results ignored", async () => {
  const auth = fakeAuth(session("saved"));
  let signal;
  let finish;
  const errors = [];
  const stop = observeAuthContext(auth, {
    load: (_user, currentSignal) => new Promise((resolve) => { signal = currentSignal; finish = resolve; }),
    onReady: assert.fail, onError: (error) => errors.push(error), timeoutMs: 15,
  });
  await delay(35);
  assert.equal(signal.aborted, true);
  assert.equal(errors.length, 1);
  finish("late profile");
  await delay();
  stop();
});

test("session rejection reaches recovery and cleanup prevents deferred work", async () => {
  const auth = fakeAuth();
  auth.getSession = async () => { throw new Error("Network unavailable"); };
  const errors = [];
  const stop = observeAuthContext(auth, {
    load: assert.fail, onReady: assert.fail, onError: (error) => errors.push(error.message),
  });
  await delay();
  assert.deepEqual(errors, ["Network unavailable"]);
  stop();
  const stopAgain = observeAuthContext(fakeAuth(), {
    load: assert.fail, onReady: assert.fail, onError: assert.fail,
  });
  stopAgain();
  await delay();
});

test("the real Supabase client completes sign-in and two profile queries without deadlocking", { timeout: 2000 }, async () => {
  const user = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.invalid" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  const client = createClient("https://qyrova-test.invalid", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      const response = String(url).includes("/token")
        ? { access_token: token, refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user }
        : { full_name: "Test profile" };
      return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  const profiles = [];
  const stop = [0, 1].map(() => observeAuthContext(client.auth, {
    load: async (currentUser, signal) => {
      if (!currentUser) return null;
      const { data, error } = await client.from("profiles").select("full_name").maybeSingle().abortSignal(signal);
      if (error) throw error;
      return data.full_name;
    },
    onReady: (value) => { if (value) profiles.push(value); },
    onError: assert.fail,
  }));
  try {
    const result = await client.auth.signInWithPassword({ email: user.email, password: "test-password" });
    assert.equal(result.error, null);
    await delay(30);
    assert.deepEqual(profiles, ["Test profile", "Test profile"]);
  } finally {
    stop.forEach((unsubscribe) => unsubscribe());
  }
});
