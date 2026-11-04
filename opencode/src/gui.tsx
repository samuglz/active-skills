import { Command, Panel, Plugin, Style } from "@opencode/plugin/gui"
import { For, Show, createSignal, onCleanup } from "solid-js"
import { Skills } from "./rpc"
import type { Query } from "./rpc"

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
const sum = (query: Query) => query.skills.reduce((total, skill) => total + skill.tokens, 0)

// Heavier than `warn` shows yellow, heavier than `bad` red; a card's total is a sum, so it gets a higher bar.
const weight = (n: number, warn = 1500, bad = 3000) => (n >= bad ? "bad" : n >= warn ? "warn" : "")
const total = (n: number) => weight(n, 4000, 8000)

const css = `
.active-skills { display: flex; flex-direction: column; gap: 8px; padding: 12px; font-size: 13px; }
.active-skills .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.active-skills .muted { opacity: 0.6; }
.active-skills .version { text-align: right; opacity: 0.6; }
.active-skills .card { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 8px; padding: 6px 10px; }
.active-skills .head { all: unset; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; cursor: pointer; }
.active-skills .head .prompt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.active-skills .head .tokens { flex: none; font-weight: 600; }
.active-skills .skills { display: flex; flex-direction: column; gap: 2px; padding: 6px 0 2px 14px; }
.active-skills .warn { color: #d9a400; }
.active-skills .bad { color: #e5484d; }
`

export default Plugin.define({
  i18n: {
    en: {
      title: "Skills",
      open: "Open Skills panel",
      session: "Session",
      withSkills: "with skills",
      clear: "Clear",
      empty: "No queries yet.",
      none: "(no skills)",
      model: "model",
      user: "typed",
      noSession: "Open a session first.",
    },
    es: {
      title: "Skills",
      open: "Abrir panel de Skills",
      session: "Sesión",
      withSkills: "con skills",
      clear: "Limpiar",
      empty: "Aún no hay consultas.",
      none: "(sin skills)",
      model: "modelo",
      user: "manual",
      noSession: "Abre primero una sesión.",
    },
  },
  setup(ctx) {
    const ui = ctx.ui
    const [data, setData] = createSignal<{ version: string; queries: Query[] }>({ version: "", queries: [] })
    const [opened, setOpened] = createSignal<string[]>([])

    // `ctx.client` changes when the server restarts, so it is read at call time.
    const refresh = () => void ctx.client.rpc(Skills).list({}).then(setData).catch(() => {})
    refresh()
    const timer = setInterval(refresh, 1500)
    onCleanup(() => clearInterval(timer))

    const toggle = (id: string) => setOpened(ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]))
    const clear = () => void ctx.client.rpc(Skills).clear({}).then(() => (setOpened([]), refresh())).catch(() => {})

    ctx.add(Style, css)

    ctx.add(Command, () => ({
      id: "open",
      title: ctx.t("open"),
      keywords: "skills tokens",
      section: "session" as const,
      slash: { name: "skills" },
      run: () => {
        const session = ctx.sessions.current()

        if (!session) {
          ctx.toast.show({ title: ctx.t("title"), description: ctx.t("noSession"), variant: "error" })
          return
        }

        ctx.layout.open(`${ctx.id}:skills`, session, { tab: "select" })
      },
    }))

    ctx.add(Panel, {
      id: "skills",
      region: "side",
      list: () => [{ id: "skills", get title() { return ctx.t("title") }, pinned: true }],
      render: () => {
        const queries = () => data().queries.slice().reverse()
        const all = () => data().queries.reduce((sumOfAll, query) => sumOfAll + sum(query), 0)
        const used = () => data().queries.filter(query => query.skills.length > 0).length

        return (
          <div class="active-skills">
            <Show when={data().version}>
              <div class="version">v{data().version}</div>
            </Show>
            <div class="row">
              <div>
                <strong>{ctx.t("session")}</strong> <strong class={total(all())}>~{fmt(all())} tok</strong>
                <span class="muted"> · {used()} {ctx.t("withSkills")}</span>
              </div>
              <ui.Button size="small" onClick={clear}>{ctx.t("clear")}</ui.Button>
            </div>
            <Show when={queries().length === 0}>
              <div class="muted">{ctx.t("empty")}</div>
            </Show>
            <For each={queries()}>
              {query => (
                <div class="card">
                  <button class="head" onClick={() => toggle(query.id)}>
                    <span class="prompt">{opened().includes(query.id) ? "▾" : "▸"} {query.prompt}</span>
                    <span class={`tokens ${total(sum(query))}`}>~{fmt(sum(query))} tok</span>
                  </button>
                  <Show when={opened().includes(query.id)}>
                    <div class="skills">
                      <Show when={query.skills.length === 0}>
                        <span class="muted">{ctx.t("none")}</span>
                      </Show>
                      <For each={query.skills.slice().sort((a, b) => b.tokens - a.tokens)}>
                        {skill => (
                          <div>
                            • {skill.name} <span class={weight(skill.tokens) || "muted"}>~{fmt(skill.tokens)}</span>
                            <span class="muted"> · {ctx.t(skill.via === "user" ? "user" : "model")}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        )
      },
    })
  },
})
