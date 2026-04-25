import { ToolError } from "./types";
import type { Tool } from "./types";

// Minimal-but-useful JSON transform: dot-path get with bracketed indices.
// e.g. path = "data.items[0].name". The full jq surface area is intentionally
// out of scope; if users need richer transforms they call http.request.

export const jsonTransformTool: Tool = {
  name: "json.transform",
  description:
    "Read a value out of a JSON object using a dot path (supports `[index]` for arrays). Use this instead of writing free-form code.",
  input_schema: {
    type: "object",
    required: ["data", "path"],
    properties: {
      data: { description: "The input JSON value." },
      path: {
        type: "string",
        description: "Dot path. Examples: 'name', 'users[0].email', 'meta.tags'.",
      },
    },
  },
  output_schema: {
    type: "object",
    properties: {
      value: {},
      found: { type: "boolean" },
    },
  },

  async execute(rawInput) {
    const input = rawInput as { data: unknown; path: string };
    if (typeof input?.path !== "string") {
      throw new ToolError("invalid_input", "`path` must be a string.");
    }
    const tokens = tokenise(input.path);
    let cur: unknown = input.data;
    for (const t of tokens) {
      if (cur == null) return { value: null, found: false };
      if (typeof t === "number") {
        if (!Array.isArray(cur)) return { value: null, found: false };
        cur = cur[t];
      } else {
        if (typeof cur !== "object") return { value: null, found: false };
        cur = (cur as Record<string, unknown>)[t];
      }
    }
    return { value: cur ?? null, found: cur !== undefined };
  },
};

function tokenise(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  let buf = "";
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === ".") {
      if (buf) {
        out.push(buf);
        buf = "";
      }
    } else if (ch === "[") {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      const close = path.indexOf("]", i);
      if (close === -1) throw new ToolError("invalid_input", "Unbalanced `[` in path.");
      const idx = Number(path.slice(i + 1, close));
      if (!Number.isInteger(idx)) {
        throw new ToolError("invalid_input", `Bad array index in path near "${path.slice(i)}".`);
      }
      out.push(idx);
      i = close;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}
