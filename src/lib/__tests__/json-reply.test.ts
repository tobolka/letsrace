import { expect, it } from "vitest";
import { parseJsonReply } from "@/lib/llm/json-reply";

it("does not swallow an earlier prose bracket into the JSON verdict", () => {
  expect(parseJsonReply('[category context]\n```json\n{"keep":true,"why":"U13 [age] and escaped \\"quote\\" }"}\n```'))
    .toEqual({ keep: true, why: 'U13 [age] and escaped "quote" }' });
});

it("rejects incomplete and ambiguous verdicts", () => {
  expect(parseJsonReply('{"keep": true')).toBeNull();
  expect(parseJsonReply('{"keep":false}\n{"keep":true}')).toBeNull();
  expect(parseJsonReply('{broken: {"keep":true}}')).toBeNull();
});
