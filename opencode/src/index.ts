import { Plugin } from "@opencode/plugin"
import { readFileSync } from "node:fs"
import { Skills } from "./rpc.js"
import type { Query, Skill } from "./rpc.js"

const KEY = "queries"
const KEEP = 50

// shortcut: ~4 characters per token, not a real tokenizer; swap if exact counts matter.
const estimate = (text: string) => Math.ceil(text.length / 4)

const version = () => {
  try {
    return String(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version ?? "")
  } catch {
    return ""
  }
}

type Stored = Query & { sessionID: string }

// The server loads this plugin once per location, all in one process: the queries live at module level
// so every copy reads and writes the same list. The first copy loads them and saves them.
let queries: Stored[] = []
let ready: Promise<void> | undefined
let persist: ((value: Stored[]) => void) | undefined

export default Plugin.define({
  id: "active-skills",
  async setup(ctx) {
    ready ??= (async () => {
      try {
        const saved = await ctx.storage.get(KEY)
        if (Array.isArray(saved)) queries = saved as Stored[]
      } catch {}

      persist = value => void ctx.storage.set(KEY, value as never).catch(() => {})
    })()
    await ready

    const save = () => persist?.(queries.slice(-KEEP))

    const add = (sessionID: string, skill: Skill) => {
      const last = [...queries].reverse().find(q => q.sessionID === sessionID)
      if (!last || last.skills.some(s => s.name === skill.name)) return
      last.skills.push(skill)
      save()
    }

    await ctx.rpc.register(Skills, {
      list: async () => ({ version: version(), queries: queries.slice(-KEEP).map(({ sessionID: _, ...q }) => q) }),
      clear: async () => {
        queries = []
        save()
        return {}
      },
    })

    await ctx.session.hook("prompt", async event => {
      queries.push({
        id: String(event.messageID),
        sessionID: String(event.sessionID),
        prompt: event.prompt.text.replace(/^"|"$/g, "").slice(0, 60),
        skills: [],
      })

      // A skill the person typed arrives with the prompt, with no tool call.
      const typed = (event.prompt.skills ?? []) as unknown[]
      if (typed.length === 0) return save()

      const known = await ctx.skill.list().catch(() => undefined)
      const list = (known as { data?: { id: string; name: string; content?: string }[] } | undefined)?.data ?? []

      for (const entry of typed) {
        const id =
          typeof entry === "string" ? entry : String((entry as { id?: string }).id ?? (entry as { name?: string }).name)
        const info = list.find(s => s.id === id || s.name === id)
        add(String(event.sessionID), { name: info?.name ?? id, tokens: estimate(info?.content ?? ""), via: "user" })
      }
    })

    // The model loads a skill with the `skill` tool; its result carries the whole text.
    await ctx.tool.hook("execute.after", event => {
      if (event.tool !== "skill" || event.status !== "completed") return

      const output = (event.result as { output?: { name?: string; output?: string } } | undefined)?.output
      const id = String((event.input as { id?: string } | undefined)?.id ?? "")
      add(String(event.sessionID), {
        name: output?.name ?? id,
        tokens: estimate(output?.output ?? JSON.stringify(event.result ?? "")),
        via: "model",
      })
    })
  },
})
