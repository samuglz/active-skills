import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Query, Skill } from '../types'

const PANE = 'active-skills'
// Change a tag when the stored fields change: it declines what an earlier version stored.
const queries = atom({ plugin: 'active-skills', key: 'queries' } as const, [], {
  shape: 'queries-3',
})
// Skills whose text is in the context now: a second load of one of these is not expanded again,
// so it costs nothing. Emptied when the context is cleared or compacted.
const loaded = atom({ plugin: 'active-skills', key: 'loaded' } as const, [], {
  shape: 'loaded-1',
})

// Cards start folded: only the ones the person opened are stored.
const expanded = atom({ plugin: 'active-skills', key: 'expanded' } as const, [], {
  shape: 'expanded-1',
})

// shortcut: ~4 characters per token, not a real tokenizer; swap if exact counts matter.
const estimate = (text: string) => Math.ceil(text.length / 4)
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
const sum = (skills: Skill[]) => skills.reduce((t, s) => t + s.tokens, 0)

// Adds a skill, or replaces the same one: a name may arrive bare from the tool and prefixed from the prompt.
const sameName = (a: string, b: string) => a === b || b.endsWith(':' + a) || a.endsWith(':' + b)

const withSkill = (skills: Skill[], skill: Skill) => {
  const same = (s: Skill) => sameName(s.name, skill.name)

  return skills.some(same)
    ? skills.map(s => (same(s) && s.reused ? { ...skill, via: s.via ?? skill.via } : s))
    : [...skills, skill]
}

// Heavier than `warn` shows yellow, heavier than `bad` red; a card's total is a sum, so it gets a higher bar.
const weight = (n: number, warn = 1500, bad = 3000) =>
  n >= bad ? 'error' : n >= warn ? 'warning' : undefined
const total = (n: number) => weight(n, 4000, 8000)
const TEXT = {
  en: {
    description: "Show the skills used in each query in a side pane",
    opened: "Skills pane opened.",
    session: "Session",
    query: "query",
    queries: "queries",
    withSkills: "with skills",
    clear: "Clear",
    reused: "reused",
    via: { user: "typed", model: "model", other: "auto" },
    other: "other",
    empty: "No queries yet.",
    none: "(no skills)",
  },
  es: {
    description: "Muestra en un panel lateral las skills usadas en cada consulta",
    opened: "Panel de skills abierto.",
    session: "Sesión",
    query: "consulta",
    queries: "consultas",
    withSkills: "con skills",
    clear: "Limpiar",
    reused: "ya cargada",
    via: { user: "manual", model: "modelo", other: "auto" },
    other: "otras",
    empty: "Aún no hay consultas.",
    none: "(sin skills)",
  },
}

type Host = {
  settings: { read: (a: { key: string }) => Promise<unknown> }
  env: { get: (name: "LC_ALL" | "LANG") => Promise<string | undefined> }
  process: { run: (argv: readonly string[]) => Promise<{ exitCode: number; stdout: string }> }
}

// The system language, asked once: LC_ALL / LANG, else on Windows the UI culture ("es-ES").
// shortcut: a language set after the first draw is picked up only after a reload.
let system: Promise<string> | undefined
const systemLanguage = ($: Host) =>
  (system ??= (async () => {
    const env = (await $.env.get("LC_ALL")) || (await $.env.get("LANG"))

    if (env) {
      return env
    }

    try {
      const run = await $.process.run(["powershell", "-NoProfile", "-Command", "(Get-UICulture).Name"])

      return run.exitCode === 0 ? run.stdout.trim() : ""
    } catch {
      return ""
    }
  })())

// The version shown in the pane is the one in plugin.json, read once, so there is a single place to bump it.
let versionOnce: Promise<string> | undefined
const pluginVersion = ($: {
  fs: { read: (path: string) => Promise<string> }
  plugin: { root: string }
}) =>
  (versionOnce ??= $.fs
    .read(`${$.plugin.root}/.claude-plugin/plugin.json`)
    .then(text => String(JSON.parse(text).version ?? ''))
    .catch(() => ''))

// Claude Code's own `language` setting ("spanish", "es", ...) wins; unset, the system language decides.
// Anything that is not Spanish is English.
const texts = async ($: Host) => {
  const set = String((await $.settings.read({ key: "language" })) ?? "")

  return /^(es|span)/i.test(set || (await systemLanguage($))) ? TEXT.es : TEXT.en
}

// A skill at least this heavy raises a toast when it loads.
const HEAVY = 3000

// "plugin:skill" names group under their plugin; a name without ':' stays flat.
const groupSkills = (skills: Skill[]) => {
  const groups = new Map<string, Skill[]>()
  const flat: Skill[] = []

  for (const s of skills) {
    const i = s.name.indexOf(':')

    if (i < 0) {
      flat.push(s)
    } else {
      const group = s.name.slice(0, i)
      groups.set(group, [...(groups.get(group) ?? []), { ...s, name: s.name.slice(i + 1) }])
    }
  }

  const byWeight = (a: Skill, b: Skill) => b.tokens - a.tokens
  const heaviest = [...groups].map(([g, list]) => [g, list.sort(byWeight)] as const)

  return { flat: flat.sort(byWeight), groups: heaviest.sort((a, b) => sum(b[1]) - sum(a[1])) }
}

export const register: Register = on => {
  // The skill the person typed as /name in this query; the Skill tool call marks the model's.
  let typed: string | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'active-skills',
      description: (await texts($)).description,
    })
    void $.ui.open({ id: PANE, title: 'Skills' })

    if (e.source === 'clear' || e.source === 'compact') {
      await update($, loaded, () => [])
    }

    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    await update($, loaded, () => [])

    return next(e)
  })

  on('command.run', { command: 'active-skills' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Skills' })

    return { text: (await texts($)).opened }
  })

  on('prompt.submit', async ($, e, next) => {
    typed = e.command?.name
    const query: Query = { id: await $.clock.now(), prompt: e.text.slice(0, 60), skills: [] }
    await update($, queries, list => [...list, query].slice(-50))

    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    const name = e.pluginName && !e.skill.includes(':') ? `${e.pluginName}:${e.skill}` : e.skill
    const inContext = (await read($, loaded)).some(n => sameName(n, name))
    const via = typed && sameName(typed, name) ? 'user' : 'other'
    const skill: Skill = inContext
      ? { name, tokens: 0, reused: true, via }
      : { name, tokens: estimate(e.text), via }

    if (!inContext) {
      await update($, loaded, list => [...list, name])
    }

    await update($, queries, list =>
      list.map((q, i) => (i === list.length - 1 ? { ...q, skills: withSkill(q.skills, skill) } : q)),
    )

    if (skill.tokens >= HEAVY) {
      $.ui.toast(`${name} ~${fmt(skill.tokens)} tok`)
    }

    return next(e)
  })

  // The Skill tool runs on every call, even when the engine does not expand a skill that is
  // already in the context again: that call is a reuse, with no tokens of its own.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    await update($, queries, list =>
      list.map((q, i) =>
        i === list.length - 1
          ? { ...q, skills: withSkill(q.skills, { name: e.skill, tokens: 0, reused: true, via: 'model' }) }
          : q,
      ),
    )

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, queries)
    const opened = await read($, expanded)
    const t = await texts($)
    const version = await pluginVersion($)
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 6) / 4))
    const all = list.reduce((t, q) => t + sum(q.skills), 0)
    const used = list.filter(q => q.skills.length > 0).length

    // A Button seems to draw its text without the Text colors, so the weight also shows as an emoji.
    const dot: Record<string, string> = { warning: "🟡 ", error: "🔴 " }
    const tag = (sk: Skill) => (sk.via ? ` · ${t.via[sk.via]}` : '')
    const label = (sk: Skill) => (sk.reused ? t.reused : `~${fmt(sk.tokens)}`)
    const tokens = (q: Query) => `~${fmt(sum(q.skills))} tok`

    const shown = list.slice(-room).reverse()
    const byPlugin = new Map<string, number>()

    for (const q of list) {
      for (const sk of q.skills) {
        const i = sk.name.indexOf(":")
        const plugin = i < 0 ? t.other : sk.name.slice(0, i)
        byPlugin.set(plugin, (byPlugin.get(plugin) ?? 0) + sk.tokens)
      }
    }

    const plugins = [...byPlugin].sort((a, b) => b[1] - a[1])

    const clear = async () => {
      await update($, queries, () => [])
      await update($, expanded, () => [])
    }

    const toggle = (id: number) =>
      update($, expanded, ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]))

    return (
      <Box flexDirection="column">
        {version && (
          <Box justifyContent="flex-end">
            <Text dimColor>v{version}</Text>
          </Box>
        )}
        <Box justifyContent="space-between">
          <Text bold>
            {t.session} <Text color={total(all)}>~{fmt(all)} tok</Text>
            <Text dimColor> · {used} {used === 1 ? t.query : t.queries} {t.withSkills}</Text>
          </Text>
          <Button key="clear" label={t.clear} onPress={clear} />
        </Box>
        {plugins.length > 0 && (
          <Text dimColor>{plugins.map(([p, n]) => p + " ~" + fmt(n)).join(" · ")}</Text>
        )}
        {list.length === 0 && <Text dimColor>{t.empty}</Text>}
        {shown.map(q => {
            const { flat, groups } = groupSkills(q.skills)
            const isFolded = !opened.includes(q.id)

            return (
              <Box flexDirection="column" borderStyle="round" paddingX={1} marginTop={1}>
                <Button plain key={`head-${q.id}`} onPress={() => toggle(q.id)}>
                  <Text bold color={total(sum(q.skills))}>{dot[total(sum(q.skills)) ?? ""]}{tokens(q)} </Text>
                  <Text wrap="truncate-end">{isFolded ? "▸" : "▾"} {q.prompt}</Text>
                </Button>
                {!isFolded && q.skills.length === 0 && <Text dimColor>  {t.none}</Text>}
                {!isFolded &&
                  groups.map(([group, skills]) =>
                    skills.length === 1 ? (
                      <Text>
                        {'  • '}{group}:{skills[0].name}{' '}
                        <Text color={weight(skills[0].tokens)} dimColor={!weight(skills[0].tokens)}>
                          {label(skills[0])}
                        </Text>
                        <Text dimColor>{tag(skills[0])}</Text>
                      </Text>
                    ) : (
                      <Box flexDirection="column">
                        <Text>
                          {'  • '}{group}{' '}
                          <Text color={weight(sum(skills))} dimColor={!weight(sum(skills))}>
                            ~{fmt(sum(skills))}
                          </Text>
                        </Text>
                        {skills.map(s => (
                          <Text>
                            {'      ◦ '}{s.name}{' '}
                            <Text color={weight(s.tokens)} dimColor={!weight(s.tokens)}>
                              {label(s)}
                            </Text>
                            <Text dimColor>{tag(s)}</Text>
                          </Text>
                        ))}
                      </Box>
                    ),
                  )}
                {!isFolded &&
                  flat.map(s => (
                    <Text>
                      {'  • '}{s.name}{' '}
                      <Text color={weight(s.tokens)} dimColor={!weight(s.tokens)}>
                        {label(s)}
                      </Text>
                      <Text dimColor>{tag(s)}</Text>
                    </Text>
                  ))}
              </Box>
            )
          })}
      </Box>
    )
  })
}
