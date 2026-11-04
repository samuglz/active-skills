# active-skills para OpenCode

Un plugin para **OpenCode 2 Desktop** que añade un panel lateral con las skills que se han usado en cada consulta, con una estimación de los tokens que aporta cada una.

*English: an OpenCode 2 Desktop plugin that adds a side panel listing which skills were used in each query, with an estimated token count per skill. The panel follows the app's language (Spanish or English).*

## Qué muestra

- **Una card por consulta**, con el texto de la consulta a la izquierda y el total de tokens a la derecha. Las cards vienen desplegadas; al pulsar la cabecera se pliegan.
- **Las skills de cada consulta**, de más a menos pesadas, con su peso en tokens y cómo se cargaron: `modelo` (la cargó el modelo con su herramienta `skill`) o `manual` (la escribiste tú en el prompt).
- **Color por peso:** amarillo desde ~1,5k tokens y rojo desde ~3k en cada skill; en el total de una card, desde ~4k y ~8k.
- **Resumen de la sesión** arriba, con el total y cuántas consultas usaron skills, la versión del plugin y un botón **Limpiar**.

## Instalación

Necesitas OpenCode 2 (probado con 2.2.5) y su aplicación de escritorio. La parte de panel es la API experimental de Desktop; la versión de terminal (TUI) no está implementada.

1. Descarga este repositorio. El panel ya viene construido en `opencode/dist/`, no hace falta compilar.

   ```
   git clone https://github.com/samuglz/active-skills
   ```

2. Añade el plugin a tu configuración **global** de OpenCode, `~/.config/opencode/opencode.jsonc` (en Windows, `C:\Users\<tú>\.config\opencode\opencode.jsonc`), con la ruta de la carpeta `opencode/` dentro de lo descargado:

   ```jsonc
   {
     "plugins": [{ "package": "C:/ruta/a/active-skills/opencode" }]
   }
   ```

   Desktop lee las partes de panel de la configuración global, no de la del proyecto.

3. Reinicia el servicio y abre Desktop de nuevo:

   ```
   opencode service restart
   ```

## Uso

Abre una sesión y la pestaña **Skills** aparece anclada en la región lateral. También puedes abrirla con `/skills` o desde la paleta de comandos (`Open Skills panel`).

## Qué hay que saber

- **Los tokens son una estimación:** caracteres entre 4, no un tokenizador real. El resultado de la herramienta añade algo de texto alrededor, así que cada skill puede salir algo por encima.
- **Una skill cuenta una vez por consulta.** OpenCode no avisa de skills que ya estaban en el contexto, así que cargarla en otra consulta vuelve a contar sus tokens.
- **No gasta tokens del modelo:** solo observa las llamadas a la herramienta `skill` y el texto de los prompts; no llama al modelo ni cambia nada.
- **Datos:** guarda las últimas 50 consultas con los nombres de las skills y el comienzo del texto de cada una (60 caracteres) en el almacenamiento propio del plugin, en tu máquina.
- **Probado** con OpenCode Desktop 2.2.5 en Windows.

## Desarrollo

```
cd opencode
npm install
npm run build     # genera dist/gui-experimental.cjs
npx tsc -p .      # comprueba los tipos
```

Las skills de prueba (`test-tiny` … `test-huge`) están en `.opencode/skills/` y no se publican.

## Licencia

[MIT](../LICENSE)
