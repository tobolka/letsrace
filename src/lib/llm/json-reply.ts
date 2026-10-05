/** One complete JSON value, allowing markdown or explanatory text around it. */
export function parseJsonReply<T>(reply: string): T | null {
  try { return JSON.parse(reply.trim()) as T; } catch { /* Try a delimited value. */ }
  const values: T[] = [];
  let start = -1;
  let stack: string[] = [];
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < reply.length; i++) {
    const character = reply[i]!;
    if (start < 0) {
      if (character === "{" || character === "[") { start = i; stack = [character]; quoted = false; escaped = false; }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === "{" || character === "[") stack.push(character);
    if (character === "}" || character === "]") {
      const matches = stack.at(-1) === (character === "}" ? "{" : "[");
      if (!matches) { start = -1; stack = []; continue; }
      stack.pop();
      if (!stack.length) {
        try { values.push(JSON.parse(reply.slice(start, i + 1)) as T); } catch { /* A prose bracket is not JSON. */ }
        start = -1;
      }
    }
  }
  // Several different JSON blocks are ambiguous, not a verified answer.
  return values.length === 1 ? values[0]! : null;
}
