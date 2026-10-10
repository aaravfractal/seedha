import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editProblem } from "./draftRules.ts";

type Fixture = { code: string; link: string; cases: { text: string; problem: string | null }[] };
const fixture = JSON.parse(
  readFileSync(new URL("../../api/tests/fixtures/draft_rules.json", import.meta.url), "utf8"),
) as Fixture;

test("client draft rules match the API's shared cases", () => {
  for (const c of fixture.cases) {
    assert.equal(editProblem(c.text, fixture.code, fixture.link), c.problem, c.text);
  }
});
