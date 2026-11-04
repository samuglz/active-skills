# active-skills

Un mod para Claude Code que abre un panel lateral con las skills que se han usado en cada consulta de la sesión, con una estimación de los tokens que aporta cada una.

*English: a Claude Code mod that adds a side pane listing which skills were used in each query, with an estimated token count per skill. The pane follows Claude Code's `language` setting (Spanish or English).*

## Qué muestra

- **Una card por consulta**, con el total de tokens arriba (`~7.4k tok`) y el texto de la consulta. Las cards vienen plegadas; al pulsar la cabecera se despliegan.
- **Las skills de cada consulta**, agrupadas por plugin (`superpowers`, `ponytail`…) y ordenadas de más a menos pesadas, con su subtotal.
- **Color por peso:** amarillo desde ~1,5k tokens y rojo desde ~3k en cada skill. En la cabecera de la card, un 🟡 o un 🔴 a partir de ~4k y ~8k.
- **Cómo se cargó cada skill:** `manual` (la escribiste tú como `/nombre`), `modelo` (la invocó el modelo) o `auto` (otra vía, por ejemplo una precarga).
- **Skills ya cargadas:** si una skill ya está en el contexto, no se vuelve a expandir; aparece como `ya cargada` y no suma tokens.
- **Resumen de la sesión** arriba: total de tokens y reparto por plugin.
- **Aviso (toast)** cuando se carga una skill de 3k tokens o más.
- Botón **Limpiar** para vaciar el historial.

## Instalación

En una sesión de terminal de Claude Code:

```
/plugin install active-skills --marketplace samuglz/active-skills
```

Te preguntará si añades el marketplace (`y`) y en qué ámbito instalarlo.

Desde una shell:

```
claude plugin install active-skills --marketplace samuglz/active-skills
```

En la app de escritorio, donde `/plugin` no funciona: pulsa **+** junto al cuadro de texto, luego **Plugins**, **Add marketplace** con `samuglz/active-skills` y después **Add plugin**.

Para quitarlo:

```
claude plugin uninstall active-skills
```

## Uso

El panel **Skills** se abre al iniciar la sesión. Si lo cierras, vuelve a abrirlo con:

```
/active-skills
```

El idioma (español o inglés) sale del ajuste `language` de Claude Code (`"language": "spanish"` en `~/.claude/settings.json`). Si no lo tienes definido, el mod pregunta una vez por sesión el idioma del sistema; en Windows lo hace ejecutando `powershell -NoProfile -Command (Get-UICulture).Name`. Con cualquier otro idioma, el panel sale en inglés.

## Qué hay que saber

- **Los tokens son una estimación:** caracteres entre 4, no un tokenizador real. Puede desviarse, sobre todo con código o con texto en español.
- **Solo cuenta lo que ve desde que se carga el mod:** no conoce las skills que ya estaban en el contexto antes. La primera vez que se recarga una de ellas cuenta como una carga nueva.
- **Las skills ya cargadas se deducen:** el mod apunta qué skills hay en el contexto y las vacía al compactar o limpiar la conversación. Es una deducción, no un dato del motor, y puede equivocarse en casos raros.
- **No gasta tokens del modelo:** solo observa lo que pasa, no llama al modelo ni añade nada al prompt. Lo único que queda en la conversación es la respuesta corta de `/active-skills`.
- **Probado en la app de escritorio.** En terminal no se ha probado cómo se dibuja el panel.
- **Un detalle de la interfaz:** el color del total de la cabecera no se aplica dentro de un botón, por eso se refuerza con el emoji.

## Licencia

[MIT](LICENSE)

## Desarrollo

```
claude plugin validate .
```

Para ejecutarlo desde su carpeta durante el desarrollo: `claude --plugin-dir <carpeta>`.
