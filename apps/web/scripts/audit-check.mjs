// npm audit gate: fail on any high or critical advisory, except advisories in
// the reviewed allowlist below. Each allowlisted advisory needs a reason and
// an expiry date, after which the gate fails again and forces a re-review.
import { execFileSync } from "node:child_process";

const ALLOWLIST = {
  // braces <= 3.0.3 (no fixed release exists). Reached only through
  // eslint-config-next -> fast-glob -> micromatch, a dev-time lint tool that
  // never ships to users and only expands glob patterns we write ourselves.
  // See docs/decisions.md D-012.
  "GHSA-vfj7-8cjw-p6xm": { expires: "2026-12-31" },
};

let raw;
try {
  raw = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  raw = err.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw);
const today = new Date().toISOString().slice(0, 10);
const problems = [];

for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (vuln.severity !== "high" && vuln.severity !== "critical") continue;
  const advisories = vuln.via.filter((v) => typeof v === "object");
  for (const adv of advisories) {
    const id = String(adv.url ?? "")
      .split("/")
      .pop();
    const allowed = ALLOWLIST[id];
    if (!allowed || allowed.expires < today) problems.push(`${name}: ${adv.title} (${id})`);
  }
}

const prodRaw = (() => {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    return err.stdout;
  }
})();
const prod = JSON.parse(prodRaw).metadata?.vulnerabilities ?? {};
if ((prod.high ?? 0) + (prod.critical ?? 0) > 0)
  problems.push("production dependencies have high/critical advisories");

if (problems.length) {
  console.error("npm audit gate FAILED:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
const total = report.metadata?.vulnerabilities ?? {};
process.stdout.write(
  `npm audit gate passed: production 0 high/critical; dev ${total.high ?? 0} high (allowlisted, reviewed).\n`,
);
