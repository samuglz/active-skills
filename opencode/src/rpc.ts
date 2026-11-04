import { Rpc } from "@opencode/plugin/rpc"

const skill = {
  type: "object",
  properties: {
    name: { type: "string" },
    tokens: { type: "number" },
    via: { type: "string" },
  },
  required: ["name", "tokens", "via"],
  additionalProperties: false,
} as const

const query = {
  type: "object",
  properties: {
    id: { type: "string" },
    prompt: { type: "string" },
    skills: { type: "array", items: skill },
  },
  required: ["id", "prompt", "skills"],
  additionalProperties: false,
} as const

const nothing = { type: "object", properties: {}, additionalProperties: false } as const

export type Skill = { name: string; tokens: number; via: "user" | "model" }
export type Query = { id: string; prompt: string; skills: Skill[] }

// The server part records the skills of each query; the panel reads them through this contract.
export const Skills = Rpc.define({
  id: "active-skills",
  methods: {
    list: {
      input: nothing,
      output: {
        type: "object",
        properties: { version: { type: "string" }, queries: { type: "array", items: query } },
        required: ["version", "queries"],
        additionalProperties: false,
      },
    },
    clear: { input: nothing, output: nothing },
  },
  events: { changed: { schema: nothing } },
} as const)
