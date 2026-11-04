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

export default Plugin.define({
  id: "active-skills",
  async setup(ctx) {
    const instance = Math.random().toString(36).slice(2, 6)

    // The server loads this plugin once per location, each with its own copy of the module, so the list
    // cannot live in a variable: the plugin storage is the one place every copy reads and writes.
    const load = async () => {
      const saved = await ctx.storage.get(KEY).catch(() => undefined)
      return Array.isArray(saved) ? (saved as Stored[]) : []
    }
    // One write at a time per copy, so a prompt and its skill calls do not overwrite each other.
    let chain: Promise<unknown> = Promise.resolve()
    const change = (edit: (list: Stored[]) => Stored[]) => {
      chain = chain
        .then(async () => ctx.storage.set(KEY, edit(await load()).slice(-KEEP) as never))
        .catch(() => {})
      return chain
    }

    const add = (sessionID: string, skill: Skill) =>
      change(list => {
        const last = [...list].reverse().find(q => q.sessionID === sessionID)
        if (last && !last.skills.some(s => s.name === skill.name)) last.skills.push(skill)
        return list
      })

    await ctx.rpc.register(Skills, {
      list: async () => {
        const list = await load()
        return { version: version(), queries: list.slice(-KEEP).map(({ sessionID: _, ...q }) => q) }
      },
      clear: async () => {
        await change(() => [])
        return {}
      },
    })

    await ctx.session.hook("prompt", async event => {
      await change(list => [
        ...list,
        {
          id: String(event.messageID),
          sessionID: String(event.sessionID),
          prompt: event.prompt.text.replace(/^"|"$/g, "").slice(0, 60),
          skills: [],
        },
      ])

      // A skill the person typed arrives with the prompt, with no tool call.
      const typed = (event.prompt.skills ?? []) as unknown[]
      if (typed.length === 0) return

      const known = await ctx.skill.list().catch(() => undefined)
      const list = (known as { data?: { id: string; name: string; content?: string }[] } | undefined)?.data ?? []

      for (const entry of typed) {
        const id =
          typeof entry === "string" ? entry : String((entry as { id?: string }).id ?? (entry as { name?: string }).name)
        const info = list.find(s => s.id === id || s.name === id)
        await add(String(event.sessionID), { name: info?.name ?? id, tokens: estimate(info?.content ?? ""), via: "user" })
      }
    })

    // The model loads a skill with the `skill` tool; its result carries the whole text.
    await ctx.tool.hook("execute.after", async event => {
      if (event.tool !== "skill" || event.status !== "completed") return

      const output = (event.result as { output?: { name?: string; output?: string } } | undefined)?.output
      const id = String((event.input as { id?: string } | undefined)?.id ?? "")
      await add(String(event.sessionID), {
        name: output?.name ?? id,
        tokens: estimate(output?.output ?? JSON.stringify(event.result ?? "")),
        via: "model",
      })
    })
  },
})
