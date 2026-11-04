# active-skills

Un panel lateral que muestra **qué skills se han usado en cada consulta** y cuántos tokens aporta cada una (estimación). Hay una versión para cada herramienta, en este mismo repositorio:

| | Carpeta | Para | Instalación |
|---|---|---|---|
| **Claude Code** | [`claude/`](claude/) | el mod de Claude Code | `/plugin install active-skills --marketplace samuglz/active-skills` |
| **OpenCode** | [`opencode/`](opencode/) | OpenCode 2 Desktop | clonar el repositorio y apuntar a `opencode/` (ver su README) |

*English: a side panel that shows which skills were used in each query and an estimated token count per skill. One version for Claude Code and one for OpenCode 2 Desktop, in the same repository.*

## Claude Code

En una sesión de terminal:

```
/plugin install active-skills --marketplace samuglz/active-skills
```

Desde una shell: `claude plugin install active-skills --marketplace samuglz/active-skills`. En la app de escritorio, donde `/plugin` no funciona: **+** junto al cuadro de texto, **Plugins**, **Add marketplace** con `samuglz/active-skills` y **Add plugin**. Más detalles en [`claude/README.md`](claude/README.md).

## OpenCode 2 Desktop

Clona el repositorio y añade la carpeta `opencode/` a tu configuración global de OpenCode. Los pasos exactos están en [`opencode/README.md`](opencode/README.md).

## Versiones

Cada plugin lleva su propia versión y su propia etiqueta de GitHub: `claude-vX.Y.Z` y `opencode-vX.Y.Z`. Las etiquetas `v0.1.0`–`v0.1.4` son anteriores a que el repositorio tuviera las dos carpetas y corresponden al mod de Claude Code.

## Licencia

[MIT](LICENSE)
