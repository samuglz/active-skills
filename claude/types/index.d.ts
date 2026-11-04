export type Skill = { name: string; tokens: number; reused?: boolean; via?: 'user' | 'model' | 'other' }
export type Query = { id: number; prompt: string; skills: Skill[] }

declare module 'claude-code' {
  interface PluginState {
    'active-skills': { queries: Shaped<Query[]>; collapsed: Shaped<number[]>; loaded: Shaped<string[]> }
  }
}
