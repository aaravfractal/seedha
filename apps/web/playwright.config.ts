import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Read KEY=value lines from the repo .env (or .env.example) without a dependency. */
function loadEnv(): Record<string, string> {
  const root = resolve(__dirname, "../..");
  let text = "";
  try {
    text = readFileSync(resolve(root, ".env"), "utf8");
  } catch {
    text = readFileSync(resolve(root, ".env.example"), "utf8");
  }
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1]) env[match[1]] = match[2] ?? "";
  }
  return env;
}

const fileEnv = loadEnv();
export const E2E_API = "http://127.0.0.1:8001";
export const E2E_WEB = "http://localhost:3001";
const shared = {
  ...fileEnv,
  OWNER_API_TOKEN: fileEnv.OWNER_API_TOKEN || "e2e-owner-token",
  OWNER_PASSCODE: fileEnv.OWNER_PASSCODE || "e2e-passcode",
  SESSION_SECRET: fileEnv.SESSION_SECRET || "e2e-session-secret-0123456789abcdef",
  DESK_DEVICE_KEY: fileEnv.DESK_DEVICE_KEY || "e2e-desk-key",
  // All integrations simulated in e2e, whatever the developer's .env says.
  ANTHROPIC_API_KEY: "",
  WHATSAPP_TOKEN: "",
  WHATSAPP_APP_SECRET: "",
  RAZORPAY_KEY_ID: "",
  PROOF_RPC_URL: "",
};
process.env.E2E_PASSCODE = shared.OWNER_PASSCODE;
process.env.DESK_DEVICE_KEY = shared.DESK_DEVICE_KEY;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: E2E_WEB, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: [
    {
      // Reset and seed its own database first: webServer starts before globalSetup.
      command:
        "rm -f e2e.db && .venv/bin/alembic upgrade head && .venv/bin/python -m seed.load && " +
        ".venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001",
      cwd: resolve(__dirname, "../api"),
      url: `${E2E_API}/health`,
      env: { ...shared, DATABASE_URL: "sqlite:///./e2e.db", WEB_ORIGIN: E2E_WEB },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npx next build && npx next start --port 3001",
      url: `${E2E_WEB}/login`,
      env: { ...shared, API_URL: E2E_API },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
