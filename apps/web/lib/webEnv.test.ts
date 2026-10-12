import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseUrl,
  apiUrl,
  deviceKeyUsable,
  isHosted,
  isPublicMode,
  loginSecretsProblem,
  siteOrigin,
} from "./webEnv.ts";

test("API_BASE_URL wins, API_URL is the fallback, then the local API", () => {
  assert.equal(apiBaseUrl({}), "http://localhost:8000");
  assert.equal(apiBaseUrl({ API_URL: "http://127.0.0.1:8920" }), "http://127.0.0.1:8920");
  assert.equal(
    apiBaseUrl({ API_BASE_URL: "https://seedha-api.up.railway.app", API_URL: "http://localhost:8000" }),
    "https://seedha-api.up.railway.app",
  );
  assert.equal(apiBaseUrl({ API_BASE_URL: "  ", API_URL: "http://localhost:8001" }), "http://localhost:8001");
  assert.equal(apiBaseUrl({ API_BASE_URL: "https://api.example.test///" }), "https://api.example.test");
});

test("apiUrl joins one slash and keeps the path", () => {
  const env = { API_BASE_URL: "https://api.example.test/" };
  assert.equal(apiUrl("ledger/channels", env).href, "https://api.example.test/ledger/channels");
  assert.equal(apiUrl("/me", env).href, "https://api.example.test/me");
  assert.equal(apiUrl("health", {}).href, "http://localhost:8000/health");
});

test("site origin: WEB_ORIGIN, PUBLIC_BASE_URL, Vercel production domain, localhost", () => {
  assert.equal(siteOrigin({}).href, "http://localhost:3000/");
  assert.equal(
    siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "seedha.vercel.app" }).href,
    "https://seedha.vercel.app/",
  );
  assert.equal(
    siteOrigin({
      PUBLIC_BASE_URL: "https://pub.example.test/x",
      VERCEL_PROJECT_PRODUCTION_URL: "s.vercel.app",
    }).href,
    "https://pub.example.test/",
  );
  assert.equal(
    siteOrigin({ WEB_ORIGIN: "https://web.example.test", PUBLIC_BASE_URL: "https://pub.example.test" }).href,
    "https://web.example.test/",
  );
  assert.equal(
    siteOrigin({ WEB_ORIGIN: "not a url", PUBLIC_BASE_URL: "javascript:alert(1)" }).href,
    "http://localhost:3000/",
  );
});

test("mode flags are on only for exactly 1", () => {
  assert.equal(isHosted({}), false);
  assert.equal(isHosted({ SEEDHA_HOSTED: "1" }), true);
  assert.equal(isHosted({ SEEDHA_HOSTED: "true" }), false);
  assert.equal(isPublicMode({ SEEDHA_PUBLIC: "1" }), true);
  assert.equal(isPublicMode({ SEEDHA_PUBLIC: "" }), false);
});

const FRESH = {
  OWNER_API_TOKEN: "a".repeat(48),
  SESSION_SECRET: "b".repeat(64),
  DESK_DEVICE_KEY: "c".repeat(48),
};
const DEMO = {
  OWNER_API_TOKEN: "demo-owner-token-change-me",
  SESSION_SECRET: "demo-session-secret-change-me-32chars", // pragma: allowlist secret (published .env.example demo value)
  DESK_DEVICE_KEY: "demo-desk-key-change-me",
};

test("login secrets: missing always fails, demo values fail only in strict production", () => {
  assert.match(loginSecretsProblem({}) ?? "", /not set/);
  assert.equal(loginSecretsProblem({ ...DEMO, NODE_ENV: "development" }), null);
  assert.equal(loginSecretsProblem({ ...DEMO, NODE_ENV: "production", SEEDHA_DEMO: "1" }), null);
  assert.match(loginSecretsProblem({ ...DEMO, NODE_ENV: "production" }) ?? "", /Set your own/);
  assert.match(
    loginSecretsProblem({ ...FRESH, SESSION_SECRET: "short", NODE_ENV: "production" }) ?? "", // pragma: allowlist secret (test string)
    /Set your own/,
  );
  assert.equal(loginSecretsProblem({ ...FRESH, NODE_ENV: "production" }), null);
  assert.equal(loginSecretsProblem({ ...FRESH, NODE_ENV: "production", SEEDHA_HOSTED: "1" }), null);
});

test("desk key: needed, and never the demo key in strict production", () => {
  assert.equal(deviceKeyUsable({}), false);
  assert.equal(deviceKeyUsable({ ...DEMO, NODE_ENV: "development" }), true);
  assert.equal(deviceKeyUsable({ ...DEMO, NODE_ENV: "production", SEEDHA_DEMO: "1" }), true);
  assert.equal(deviceKeyUsable({ ...DEMO, NODE_ENV: "production" }), false);
  assert.equal(deviceKeyUsable({ ...FRESH, NODE_ENV: "production" }), true);
});
