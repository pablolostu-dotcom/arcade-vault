---
name: spec-juego
description: Diseña el spec de un juego nuevo para Arcade Vault — el motor, la fila del catálogo, la portada CSS y el leaderboard. Entrevista sobre el contrato del motor y escribe specs/NN-slug.md en estado Draft. No escribe código.
disable-model-invocation: true
argument-hint: "carpeta de references/started-games/ o descripción del juego"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(head:*)
---

# /spec-juego — Diseñador de specs de juegos nuevos

## Contexto de sesión

Fecha de hoy (usala para el header del spec, nunca la inventes):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ todavía no existe"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No hay carpeta references/started-games/"`

Motores registrados hoy:
!`cat lib/games/registry.ts 2>/dev/null || echo "No existe lib/games/registry.ts"`

Migraciones existentes (de la de seed sale el sort_order más alto):
!`ls supabase/migrations/ 2>/dev/null || echo "No hay carpeta supabase/migrations/"`

Dónde está instalado el skill `/spec`, del que salen las reglas de escritura:
!`ls .claude/skills/spec/ 2>/dev/null || ls ../.claude/skills/spec/ 2>/dev/null || echo "No se encontró el skill spec — buscalo con Glob antes de escribir nada"`

---

Este skill produce **un spec y nada más**: el archivo `specs/NN-slug.md` que describe cómo se agrega un juego jugable a Arcade Vault, con su motor, su fila del catálogo, su portada y su leaderboard. El juego puede venir de `references/started-games/` o no existir todavía.

**Acá no se escribe código.** Ni el motor, ni el `.sql`, ni el CSS. Ni se aplica ninguna migración. Todo eso lo hace `/spec-impl` después de que un humano apruebe el spec.

Tus respuestas van en el mismo idioma del prompt inicial. Si te hablan en español, contestás en español.

## Por qué este skill existe y no alcanza con `/spec`

`/spec` sabe **cómo se escribe un spec**: el método, la estructura, el header, los estados. Eso no se duplica acá — se lee de ahí, en la Fase 1, cada vez.

Lo que `/spec` no sabe es **qué preguntar sobre un juego de Arcade Vault**.

Después del SPEC 05 y el SPEC 06, agregar un juego a Arcade Vault es **mecánico en cinco archivos y difícil en uno solo**: el motor. `<Reproductor>` es un chasis único para todos los juegos, el registro carga el motor de forma perezosa, y el catálogo y los rankings viven en Postgres. Nada de eso hay que rediseñarlo.

Lo que sí hay que decidir cada vez es el contrato del motor, y ahí es donde el juego de referencia pelea con el chasis. Este skill existe para que esa pelea se resuelva en la entrevista y quede escrita en el spec, en vez de aparecer a mitad de la implementación.

## Lo que un juego nuevo toca

| Archivo                                        | Qué cambia                                             | ¿Siempre?                    |
| ---------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `lib/games/<slug>/engine.ts`                   | nuevo: la fábrica `create<X>Engine(canvas, options)`   | sí                           |
| `lib/games/registry.ts`                        | una línea en `ENGINES`                                 | sí                           |
| `supabase/migrations/<ts>_add_game_<slug>.sql` | el `insert into public.games`                          | sí                           |
| `app/globals.css`                              | `.cover-<slug>` (+ `::before` / `::after`)             | sí                           |
| `lib/games/types.ts`                           | hoistear `EngineHandle`/`EngineOptions`/`GameSnapshot` | la primera vez               |
| `components/reproductor.tsx`                   | slot de HUD, tecla de pausa, `lives`                   | según el juego               |
| `app/globals.css` → `.game-canvas`             | `aspect-ratio`, `pointer-events`                       | si no es 4:3 o usa mouse     |
| `public/`                                      | sprites / audio                                        | si el original trae binarios |

Y lo que **no se toca nunca**: `app/juegos/**`, `app/jugar/**`, `app/salon/**`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts`, `app/jugar/actions.ts`. Todo eso es catalog-driven y levanta el juego solo — hasta la tab del Salón de la Fama aparece sola.

Si en la entrevista aparece la necesidad de tocar alguno de esos archivos, es señal de que el pedido no es "un juego más": decilo y proponé partirlo en dos specs.

## Flujo del comando

Cuatro fases en orden estricto. **No avances a la siguiente si la anterior no cerró bien.**

---

### Fase 1 — Reconocer el terreno

Antes de preguntar nada:

1. Leé `CLAUDE.md` (y `AGENTS.md` si existe) para las convenciones del proyecto.
2. **Leé el skill `/spec` completo: su `SKILL.md` y su `template.md`.** Están en `.claude/skills/spec/`, con la ruta exacta en el contexto de sesión de arriba (si ahí no aparecieron, buscalos con Glob: `**/.claude/skills/spec/*.md`). Este skill **no reemplaza a `/spec`, lo especializa**: el método de escritura, la estructura del documento, las reglas del header, los estados válidos y las reglas globales de redacción salen todas de ahí. Lo único que `/spec-juego` agrega es el conocimiento del dominio — qué archivos toca un juego, qué preguntar sobre el motor y qué secciones extra son obligatorias.
   **No escribas ni una línea del spec sin haber leído esos dos archivos en esta corrida.** Si `template.md` y lo que dice este documento se contradicen en algo de forma, gana `template.md`; en el contenido específico de un juego, mandá vos.
3. Leé los dos specs más recientes de `specs/` — de ahí salen el idioma, la forma del header y la palabra exacta que el repo usa para los estados. El spec nuevo tiene que verse igual que esos.
4. Leé `lib/games/asteroides/engine.ts` y `lib/games/registry.ts`. Es el único motor porteado que hay y es el modelo a seguir: la fábrica sin efectos al importar, los listeners atados en `start()` y quitados en `destroy()`, el `emitSnapshot()` con guarda de igualdad, el `dt` topeado.
5. Leé el seed `supabase/migrations/*_seed_games.sql`. Anotá los `id` ya usados, las clases `cover-*` ya usadas y el `sort_order` más alto: **el juego nuevo lleva ese número más uno**.
6. Resolvé de dónde sale el juego según `$ARGUMENTS` (ver **Argumentos** al final).
7. Si hay juego de referencia, leelo entero: su `index.html`, todos sus `.js`, su `README.md` y su `CLAUDE.md` si tiene. Anotá siete cosas, porque son las que se preguntan en la Fase 2:
   - tamaño del canvas y relación de aspecto,
   - entradas (teclado, mouse, las dos) y qué teclas usa,
   - dónde se pinta el HUD: adentro del canvas o en elementos del DOM,
   - qué corre al importar el archivo (casi siempre un `init()` en la última línea),
   - qué assets binarios carga y por qué ruta,
   - si tiene vidas, niveles, o ninguna de las dos,
   - qué overlays propios dibuja (game over, pausa, reinicio con tecla).

No pases a la Fase 2 hasta poder describir esas siete cosas sin suponer.

---

### Fase 2 — Las preguntas

Es la fase que justifica el comando. Tu trabajo acá es **detectar el choque entre el juego y el chasis, y preguntar** — no asumir.

Usá `AskUserQuestion` con 2 a 4 opciones por pregunta, la recomendación primero y etiquetada. Agrupá de 3 a 5 preguntas por vez y esperá la respuesta antes de seguir. Nunca una sola pregunta por turno.

Cuando leíste el juego de referencia, **no preguntes lo que el código ya contesta**. Preguntá qué se hace con eso.

#### Bloque A — Identidad en el catálogo

- `id`: kebab-case, sin acentos, sin chocar con los que leíste del seed (`caida`, `gloton`, `duelo-pixel` son el patrón).
- `title`: MAYÚSCULAS, con acentos (`CAÍDA`, `GLOTÓN`).
- `cat`: uno de `ARCADE` / `PUZZLE` / `SHOOTER` / `VERSUS`. **No se inventan categorías**, hay un CHECK constraint.
- `color`: uno de `cyan` / `magenta` / `yellow` / `green`. También hay un CHECK.
- `short`: una oración terminada en punto. `long`: dos o tres, en el tono de las otras.

#### Bloque B — El contrato del motor

Este es el bloque que importa. Hoy `GameSnapshot` vive dentro de `lib/games/asteroides/engine.ts` y tiene `tripleShot` — un campo de asteroides — metido adentro. `registry.ts` importa `EngineHandle` y `EngineOptions` de ese mismo módulo. El juego nuevo obliga a resolverlo.

- **¿Tiene vidas?** El HUD del reproductor pinta un slot `♥`. Si el juego no tiene el concepto (Tetris no lo tiene), ¿qué muestra ese slot: se oculta, muestra un guion, o se reemplaza por otra cosa?
- **¿Qué stat propio va al HUD?** El equivalente a `tripleShot`: líneas en Tetris, bloques restantes en Arkanoid, lo que sea.
- **¿Cómo se generaliza `GameSnapshot`?** Opciones a ofrecer: hoistear los tres tipos a `lib/games/types.ts` con un campo `extra` opcional (`{ label, value }`), hoistearlos dejando `tripleShot` y sumando el campo nuevo al lado, o dejar todo donde está y que el motor nuevo importe de asteroides. La primera es la recomendable; la tercera deja una dependencia que no significa nada.
- **¿`start()` puede seguir siendo síncrono?** Si el juego carga un spritesheet o audio antes de arrancar, el contrato actual no lo modela y hay que decidir: precargar dentro de `start()` y dibujar recién cuando resuelve, o agregar un estado `loading` al snapshot.
- **¿Cuándo termina la partida, y cómo la fuerza el botón FIN?** En asteroides `end()` pone `lives = 1` y mata la nave, para que FIN y perder la última vida terminen por el mismo camino. El juego nuevo necesita su equivalente.

#### Bloque C — Entradas y encuadre

- **¿Teclado, mouse, o los dos?** `.game-canvas` tiene `pointer-events: none`. Un juego con mouse obliga a cambiarlo, y eso cambia el comportamiento para todos.
- **¿Qué teclas hacen `preventDefault()`?** Las flechas y el espacio scrollean la página si no se las frena.
- **¿La pausa?** El reproductor usa `Escape` y el botón PAUSA. Si el original usa otra tecla (Tetris usa `P`), se elige una: la del portal, la del juego, o las dos.
- **¿Tamaño del mundo y relación de aspecto?** `.game-canvas` es `aspect-ratio: 4 / 3` y el motor de asteroides razona en 800×600. Un mundo 300×600 no entra sin decidir qué pasa: bandas laterales, cambio del `aspect-ratio` por juego, o rediseño de la grilla.

#### Bloque D — Assets

- **¿El original trae PNG o MP3?** Si van, van a `public/` y se referencian con URL absoluta desde la raíz. Si no van, se reemplazan por dibujo vectorial en el canvas, como hizo el SPEC 05.
- **¿Entra el sonido?** El SPEC 05 lo dejó afuera con un argumento que sigue valiendo: agregar audio es diseñar la política de autoplay y el control de silencio, y eso es un spec propio.

#### Bloque E — Portada y paleta

- **¿Qué dibuja `.cover-<slug>`?** Arte CSS puro: capas de `background` con gradientes, más `::before` y `::after` con `clip-path` y `drop-shadow` para el glow. Cero archivos de imagen. Mirá `.cover-asteroides` en `app/globals.css` como modelo.
- **¿Con qué acento se pinta el motor?** Recordá la regla del SPEC 05: los colores se declaran como constantes del motor, **nunca se leen del DOM** — un motor que necesita una hoja de estilos para dibujar falla en silencio.

#### Bloque F — Alcance y recortes

- **¿Qué del original no entra?** Temas claro/oscuro, niveles extra, power-ups, menús propios.
- **¿Qué se le arranca?** Su HUD, su overlay de game over, su reinicio con tecla. El SPEC 05 los eliminó en vez de ocultarlos: código muerto que dibuja encima es peor que código borrado.
- **¿Se rebalancea algo?** La respuesta por defecto es no. Las constantes se portan con sus valores.

#### Si el juego no viene de una referencia

El bloque B se convierte en el grueso de la entrevista: hay que **definir las reglas del juego**, no portearlas. Decilo de frente: un juego inventado es un spec bastante más caro que un port, y muchas veces conviene partirlo en dos — uno que define las reglas y el motor, otro que lo integra al portal. Ofrecelo antes de seguir.

#### Cuándo parar de preguntar

Cuando puedas contestar estas cuatro sin suponer nada:

1. ¿Qué archivos aparecen o cambian?
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo verifico que está terminado?
4. **¿Puedo escribir el `insert into public.games` completo, sin un solo campo pendiente?**

Si alguna todavía no se contesta, seguí preguntando.

---

### Fase 3 — Escribir el spec

**Si la Fase 2 cerró de verdad** —podés contestar las cuatro preguntas de arriba sin inventar— escribí el spec completo y pasá directo a la Fase 4. No lo muestres sección por sección ni pidas aprobación de un borrador: el usuario ya contestó todo y volver a preguntar es fricción. Revisa el archivo guardado y pide cambios si hace falta.

**Sólo si falta información** (cortaron la Fase 2, una respuesta quedó vaga, o alguna sección no se puede escribir sin inventar), desarrollá sección por sección, mostrando cada una y esperando confirmación.

**La estructura sale de `template.md` de `/spec`**, que leíste en la Fase 1: ese archivo manda sobre la forma del documento, y lo que sigue acá es cómo se instancia para un juego. Las etiquetas del header quedan en inglés y todo lo demás en español, igual que el SPEC 05 y el SPEC 06:

```markdown
# SPEC NN — Título corto y descriptivo

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** YYYY-MM-DD
> **Objective:** Una sola oración. Si necesitás dos, el spec es demasiado grande.
```

Después, en este orden:

1. **`## Por qué existe este spec`** — el estado de hoy y **las fricciones concretas del port**. El SPEC 05 listó las tres suyas (script global contra bundler con SSR, dos HUD, canvas fijo contra marco fluido) y ese es el nivel de concreción que se espera. Salen del bloque B y del bloque C.
2. **`## Alcance`** — con `**Dentro:**` y `**Fuera de alcance (para specs futuras):**`. Lo de afuera tiene que estar explícito.
3. **`## Modelo de datos`** — con dos subsecciones **obligatorias**:
   - `### La fila del catálogo`, con el SQL completo y literal, listo para copiar:

     ```sql
     insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
     values ('<slug>', '<TÍTULO>', '<una oración>', '<dos o tres oraciones>',
             '<CAT>', 'cover-<slug>', '<color>', <N+1>);
     ```

     `"long"` va siempre entre comillas: es palabra reservada.

   - `### El contrato del motor`, con el bloque TypeScript de `GameSnapshot`, `EngineHandle`, `EngineOptions` y la firma de la fábrica, más la línea que se agrega a `ENGINES`. Si el bloque B decidió hoistear los tipos, este es el lugar donde se escribe cómo quedan.

4. **`## Plan de implementación`** — numerado, cada paso dejando el sistema funcionando y con su línea de _Verificación:_. El orden canónico es este:
   1. **La migración del catálogo y la portada.** El `.sql` con el insert, aplicado al proyecto remoto, más `.cover-<slug>` en `app/globals.css`. Al terminar el paso, el juego ya aparece en `/juegos`, en su filtro de categoría y en el Salón, y `/jugar/<slug>` corre con el puntaje simulado igual que los otros ocho. Nada se rompió porque nada nuevo se montó. Agregar una fila **no** cambia el esquema: `npm run db:types` sólo hace falta si la migración toca tablas o vistas.
   2. **Hoistear los tipos** a `lib/games/types.ts` sin cambiar comportamiento, si el bloque B lo decidió. Va antes del motor para que el motor nuevo nazca importando del lugar correcto.
   3. **El motor** en `lib/games/<slug>/engine.ts`. Las reglas que el SPEC 05 dejó establecidas y que este paso repite: nada corre al importar el archivo, los listeners se registran en `start()` y se quitan en `destroy()`, `emitSnapshot()` compara con el último snapshot y sólo emite si algo cambió, `resume()` resetea `lastTime` a `null`, el `dt` queda topeado, y `onGameOver` se emite una sola vez.
   4. **El registro y el reproductor.** La línea en `ENGINES` más los ajustes de `<Reproductor>` y `.game-canvas` que hayan salido de los bloques B y C. La rama sin motor tiene que quedar idéntica a como está.
   5. **Paleta y avisos.** Repintar el motor con los acentos del portal y el aviso de teclado o mouse por media query, no por detección en JavaScript.
   6. **Repaso final.** Las rutas responden, las pantallas anteriores se ven igual, la consola limpia.

5. **`## Criterios de aceptación`** — checklist booleano, nada aspiracional. Arrancá de esta batería y sumale los específicos del juego:
   - `npm run build` termina sin errores ni errores de tipos.
   - `npx tsc --noEmit` pasa.
   - `npx eslint app lib components` no reporta errores.
   - `/juegos` muestra N+1 tarjetas y la nueva aparece bajo su filtro de categoría y bajo `TODOS`.
   - `.cover-<slug>` es arte CSS puro: no se agregó ningún archivo de imagen al repo.
   - `/juegos/<slug>` y `/jugar/<slug>` responden 200.
   - El HUD de React muestra los valores reales del motor y el canvas **no** dibuja ningún HUD ni overlay de game over.
   - PAUSA congela el juego por completo y REANUDAR lo sigue desde donde estaba, sin un salto proporcional al tiempo pausado.
   - El botón FIN termina la partida en el acto y abre el modal; perder la última vida lo abre **una sola vez**.
   - Guardar desde el modal inserta una fila en `scores` con ese `game_id`, y recargar `/juegos/<slug>` la muestra en el top-10 y actualiza `Mejor global` y `Partidas`.
   - `/salon` muestra una tab nueva con el ranking del juego.
   - Navegar cinco veces entre `/jugar/<slug>` y `/juegos` no acelera el juego ni duplica el puntaje.
   - Los otros N juegos se ven y se comportan exactamente igual que antes del spec.
   - El motor nuevo no aparece en el bundle compartido de `/jugar/[id]`.
   - `select id, sort_order from games order by sort_order` devuelve N+1 filas con el juego nuevo último.
   - La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.

6. **`## Decisiones`** — lo que se eligió y lo que se descartó, con el porqué en una o dos oraciones. Es la sección de más valor a largo plazo; nunca la saltees.
7. **`## Riesgos`** — tabla de dos columnas, riesgo y mitigación. Cada riesgo del port que salió en la Fase 2 va acá.
8. `## Lo que **no** entra en esta spec` (con el `**no**` en negrita, tal cual lo escriben los specs existentes) — la lista corta, cerrando con la línea `Cada una de esas, si aparece, va en su propia spec.`

Errores a evitar: criterios que no se pueden verificar ("que ande bien"), pasos del plan que no están en el alcance, y nombres de archivo que el usuario nunca confirmó.

---

### Fase 4 — Guardar el spec

Estos son los mismos pasos que la Fase 4 de `/spec`. Si al leerla en la Fase 1 encontrás algo que acá no está —un chequeo extra, una confirmación distinta—, hacelo igual: `/spec` es la fuente de las reglas de guardado.

1. Sacá el próximo número del listado de `specs/` del contexto de sesión: el más alto más uno, con dos dígitos.
2. El slug sale del `id` del juego (`10-juego-tetris`, `11-juego-arkanoid`), siguiendo la forma de los que ya están.
3. Usá la fecha del contexto de sesión. **Nunca escribas una fecha que no leíste de ahí.**
4. Escribí el archivo directo en `specs/NN-slug.md`. **No pidas permiso para escribirlo ni preguntes si el nombre está bien** — anunciá la ruta en la confirmación final. Preguntá sólo si el archivo ya existe.
5. Estado `Draft` (o la palabra equivalente que usen los specs del repo). **Nunca lo marques como aprobado**: eso lo hace el humano después de releerlo.
6. Verificá que cada `SPEC NN` del `**Depends on:**` exista de verdad en `specs/`. Si alguno no está, decilo en vez de escribir una referencia colgada.
7. Confirmá al usuario:
   - la ruta del archivo creado,
   - que quedó en `Draft` y que hay que cambiarlo a mano cuando lo relea,
   - que `/spec-impl` sólo arranca con un estado que signifique "Approved" — los specs del repo dicen `Implementado` y `Completado`, así que la palabra a poner es `Aprobado`,
   - el próximo paso: `/spec-impl NN-slug`.
   - **Frená ahí.** No propongas implementar, no escribas código, no hagas nada más.

## Reglas duras

- **Nunca escribís código en este comando.** Ni el motor, ni el `.sql`, ni el CSS. Sólo el `.md` del spec al final.
- **Nunca escribís el spec sin haber leído `/spec` primero**, en esta misma corrida: su `SKILL.md` y su `template.md`. Este skill es una especialización, no un reemplazo — la forma del documento y el método de escritura viven allá y pueden cambiar sin que este archivo se entere.
- **La migración es el único camino** para agregar la fila del catálogo: `games` tiene RLS activa y su única política es de SELECT. El spec la prescribe con el SQL literal y `/spec-impl` la aplica; **vos no la aplicás ni la escribís como archivo**.
- **Nunca marcás el spec como aprobado.**
- **`cat` y `color` salen de los valores del CHECK.** Si el juego pide una categoría o un acento nuevo, eso es otro spec: toca el SQL, `Category` y `CATS` en `lib/data.ts`, y `CATEGORIES`/`ACCENTS` en `lib/catalog.ts`.
- **Un `id` que ya existe en `games` es un error, no una variante.** Verificalo contra el seed antes de escribirlo. Ojo con los parecidos: `rocas` y `asteroides` son dos juegos distintos del catálogo.
- **No rebalanceás el juego de referencia.** Las constantes se portan con sus valores. Si después resulta difícil o fácil, se ajusta con el juego andando y midiendo.
- **No proponés implementar después de guardar.** Tu trabajo termina cuando el archivo está escrito.
- Si el usuario quiere saltear la Fase 2, recordale que las preguntas ahora ahorran horas después. Si insiste, respetalo y dejalo anotado en la sección de decisiones ("definición rápida sin aclaración detallada").

## Tono al preguntar

Directo y concreto. No te disculpes por preguntar ni uses "si no te molesta" o "podrías tal vez". Te invocaron justamente para que preguntes. Cuando ofrezcas opciones, decí cuál recomendás y por qué.

## Argumentos

`$ARGUMENTS` puede ser cuatro cosas:

- **El nombre de una carpeta de `references/started-games/`** (`03-tetris`, `04-arkanoid`): esa es la referencia. Leela entera en la Fase 1.
- **Una ruta a otra carpeta**: lo mismo, con esa ruta.
- **Una descripción en prosa** (`un buscaminas`, `un juego de naves con jefes`): no hay código de origen. El spec define el juego además de integrarlo, y el bloque B se vuelve el grueso de la entrevista.
- **Vacío**: mostrá el listado de `references/started-games/` del contexto de sesión y preguntá cuál es, o si es un juego que todavía no existe.

## Resumen del comportamiento esperado

```
/spec-juego 03-tetris

→ Lee CLAUDE.md, el SKILL.md y el template.md de /spec, los specs 05 y 06,
  el motor de asteroides, el registro y el seed.
→ Lee references/started-games/03-tetris/ entero.
→ "Leí el juego. Tres cosas chocan con el chasis del portal y necesito que las
   decidas antes de escribir el spec:" + bloque de preguntas A y B.
→ ... bloques C a F ...
→ Escribe specs/10-juego-tetris.md con el insert completo (sort_order 10),
   el contrato del motor con el snapshot generalizado, y los seis pasos del plan.
→ "Creado specs/10-juego-tetris.md, en estado Draft. Cambialo a Aprobado cuando
   lo releas y corré /spec-impl 10-juego-tetris."
→ Frena.
```

```
/spec-juego un buscaminas

→ Lee el contexto del proyecto igual que arriba.
→ "No hay juego de referencia para esto, así que el spec tiene que definir las
   reglas además de integrarlo al portal. Eso es bastante más grande que un port.
   ¿Lo hacemos en un solo spec o lo partimos en dos?"
→ Entrevista larga sobre el bloque B; los demás bloques igual.
→ Escribe el spec, avisa la ruta y frena.
```
