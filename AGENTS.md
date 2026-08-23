# AGENTS.md

Diswod: Discord Activity + web para dados de Vampiro: la Mascarada (V20). 100% frontend (React 19 + Vite), persistencia en Supabase, sync en vivo por WebRTC (Yjs), mesa 3D con Three.js.

## Commands

- `npm run dev` — Vite dev server (host expuesto, puerto 5173, `allowedHosts: true`)
- `npm test` — Vitest run (una sola pasada, no watch). Colocated `*.test.js` en `src/lib`.
- `npx vitest run src/lib/parser.test.js` — un solo archivo de test
- `npm run build` — build a `dist/` (el chunk grande >500 kB es solo un warning, no error)
- `npm run preview --host` — sirve `dist`

No hay lint, typecheck ni formatter configurados. No hay CI local; el único "verify" es `npm test`.

## Despliegue

Push a `main` en GitHub → Cloudflare Workers reconstruye automáticamente. No hay comando de deploy manual. Nunca hagas commit de `dist/` (ignorado). No hay `wrangler.toml` ni CI en el repo: todo el build/config está en el dashboard de Cloudflare (Workers Builds).

Hay **dos despliegues** del mismo repo:
- `main` → `diswod.keiberup.dev` (Activity de Discord; **sin** `VITE_ALLOW_WEB`, la web muestra `DiscordOnly`).
- `dev` → `diswod-dev.keiberup-dev.workers.dev` (web abierta con `VITE_ALLOW_WEB=1`, para probar cambios sin afectar la Activity).

Flujo de prueba: commit en `dev` → auto-deploy al workers.dev → probar en navegador → `git checkout main && git merge dev && git push`. En el workers.dev la identidad es local (no hay SDK de Discord), así que las mesas creadas ahí usan un `player_id` local, separado de las de Discord (aunque compartan la misma BD de Supabase).

`vite.config.js` usa `base: './'` (assets relativos, requerido por el sandbox de la Activity) y `vite-plugin-node-polyfills` (lo necesita y-webrtc).

## Env y secretos

- `.env` está gitignoreado; plantilla en `.env.example`.
- Solo se leen vars con prefijo `VITE_` desde el navegador. **Nunca** pongas el client secret de Discord aquí; va en la Edge Function de Supabase (`supabase/functions/discord-token`, secretos `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`).
- **El build de Cloudflare NO ve `.env`** (gitignoreado). Las `VITE_` que necesita el build de Workers deben estar como variables de build en el dashboard (Workers Builds → Settings → Variables). Si faltan `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, la app desplegada arranca con `hasSupabase() === false`: sin mesas, sin bloc de notas ni pizarra (parece "versión vieja", pero es solo falta de env). Verifícalo con: `curl -s https://<worker>/assets/index-*.js | grep -c "kvobnkztrxqilqrhyxbz"` (0 = faltan).
- `VITE_CHRONICLE_ALLOWLIST` **ya no se usa** (no está ni en `.env` ni en `.env.example`): el allowlist (`src/lib/allowlist.js`) es código muerto, solo lo referencia su propio test. El acceso ahora es público con códigos de invitación. No lo reintroduzcas ni dependas de él.

## Arquitectura

- `src/App.jsx` es el orquestador; el resto son piezas.
- `src/lib/`: `parser.js` (parsing de comandos), `dice.js` (tiradas WOD/genéricas), `seats.js` (asientos), `invite.js` (códigos/roles), `discord.js` (SDK Discord), `sync.js` (Yjs/y-webrtc), `supabase.js` (cliente), `mesasApi.js` (todas las llamadas a Supabase), `dice3d.js` (geometrías/texturas 3D de los dados + `planDice`/`quatForValue`), `clipboard.js` (`copyText` con fallback `execCommand` para el sandbox).
- `src/hooks/`: `useActivity` (boot del SDK Discord), `useMesas`, `useMembers`, `useGameLog` (fusiona log vivo + persistido), `useMusic` (música de fondo en bucle).
- `Table3D` se carga con `React.lazy` (code-split de three.js). No lo importes estáticamente.

## Tiradas (formato de comandos)

- `src/lib/parser.js` acepta: genérico `NdS` (suma de N dados de S caras), WOD `NwodD` (N d10 vs dificultad D), modificador en genérico (`NdS+M` / `NdS-M`), y **suma de reservas** con `+` (`/r 4wod6 + 3wod8`).
- **Cambio de formato (breaking)**: antes `NdM` era WOD; ahora `NdM` es genérico y WOD es `NwodM`. La ficha tira `NwodD` (`App.jsx`, `onSheetRoll`).
- La suma produce `type:'multi'` con `pools[]` (cada pool enrollado por separado). `rollMulti`/`formatMultiLine` en `dice.js` agregan éxitos/fallos si todo es WOD, o totales si todo es genérico. El gamelog muestra `[..] + [..]` (`LogEntry.jsx`), y `planDice` aplana los pools para el 3D.

## Dados 3D

- El d10 es un **trapezoedro pentagonal** de 10 kites coplanares (`createD10Geometry` usa `h = tan²(π/10)` para la planitud exacta), con caras opuestas que suman 11. Los triángulos deben estar enrollados **hacia afuera** o las caras se culling por backface (ya hubo ese bug). `src/lib/dice3d.test.js` verifica conteo de caras, opuestos suman 11 y winding; añade un test si tocas geometría.
- El "valor cara arriba" lo hace `quatForValue(sides, value)` (rota la cara cuyo `valueByFace` coincide hacia `UP`). El d6 usa un cubo con números (antes pips), no `faceDataFor`.
- Los **dados extra por 10s** (`die.exploded`) se marcan aparte: en 3D `dieStyle` devuelve `'extra'` (estilo violeta en `styleMaps`) antes que `gold`, y en el gamelog se separan de los dados base con un chip `⟳ +N` (`LogEntry.jsx`).

## Música de fondo

- `src/hooks/useMusic.js` (`useMusic()` en `App.jsx`) lee `/audio/manifest.json` en runtime y encadena las pistas de `tracks` una tras otra, en bucle infinito.
- Para añadir/quitar pistas: suelta los `.mp3/.ogg` en `public/audio/` y listalos en `public/audio/manifest.json` (`tracks` + `volume`). El `volume` del manifest manda; el `DEFAULT_VOLUME` del hook es solo fallback. Los mp3 están commiteados (~38 MB) y se sirven same-origin desde el worker (sin URL Mapping extra).
- **El autoplay con sonido está bloqueado por el navegador hasta el primer clic**: el hook reintenta en el primer `pointerdown`/`keydown`. Es comportamiento esperado, no un bug a "arreglar".
- Mute **individual por jugador** (botón "♪ Música ON/OFF" del topbar), persistido en `localStorage` (`diswod.music.muted`). No hay sync de música entre clientes.

## Identidad y nombres

No existe "nombre de jugador" global. El modelo actual:

- **Identidad** = usuario de Discord (id, nombre visible, avatar). En la Activity viene del auth vía la Edge Function `discord-token`; si falla, `NameGate` muestra la lista de participantes para elegir usuario. En web sin Discord: id local + nombre "Jugador".
- **`useActivity` descarta identidades guardadas que no sean de Discord** (o que no estén en los participantes actuales) para que PC y móvil compartan el mismo `player_id` en Supabase. No reintroduzcas nombres custom en la identidad.
- **Nombre de personaje es por mesa** (`mesa_members.player_name`). Al unirse por código siendo miembro nuevo, se muestra un modal de bienvenida (`CharacterGate`) que pide el nombre de personaje y confirma 18+; si lo omites ("Ahora no") queda tu nombre de Discord. Al crear mesa el creador queda como "Narrador". Se edita con el botón ✎ del topbar (`NameEdit`).
- **Foto de personaje**: en la ficha (`CharacterSheet`) y en el botón ✎ (`NameEdit`) se sube foto con recorte circular (`AvatarCrop`). Se guardan dos imágenes en el bucket `avatars`: el avatar circular (`mesa_members.avatar`, se usa en gamelog/asientos) y el **retrato completo** (`mesa_members.photo`, resized a 1200px). El retrato lo puede ver **cualquiera** desde la pestaña Mesa → Coterie (clic en el avatar abre `Lightbox`). Requiere correr `supabase/migration_avatars.sql` (bucket) y `supabase/migration_photo.sql` (columna `photo`).
- **Renombrar reescribe TODO el historial**: `mesasApi.renameMember` actualiza `mesa_members` + todas las filas de `log_entries` (columna `player_name` y `payload.player.name`), y `log.renamePlayer` reescribe el log vivo en Yjs para todos. Las tiradas nuevas usan el nombre de personaje (`App.jsx`, `charName`).
- La pantalla de entrada (`NameGate`) ya NO pide nombre; solo es el age gate 18+ (texto "contenido 18+") y, en Discord, el picker de participantes. Las páginas legales (`public/tos.html`, `public/privacy.html`) dicen solo 18+.
- **Web bloqueada en producción**: si `useActivity` arranca en modo `standalone` y no hay `VITE_ALLOW_WEB=1`, se muestra `DiscordOnly` invitando a usar la Activity. En dev (`npm run dev`) la web sigue funcionando.

## Reglas de mesa

- Las tiradas solo se bloquean si **te silenciaron** (`mesa_members.muted`). Ya NO se bloquean por presencia del Narrador.
- En su lugar, para proteger la partida, la mesa **solo es accesible cuando el Narrador está presente**: si no eres el Narrador y `waitingForDm` es true, se muestra la pantalla "Esperando al Narrador". `waitingForDm` requiere evidencia positiva de ausencia (`participants` no vacío y `!dmOnline`, donde `dmOnline` = tú eres el dm, o el dm está en `log.remotes` [Yjs] o en `activity.participants`). El `dmId` se deriva del miembro con rol `dm` (`party.members`), con fallback a `mesas.dm_id`. Si `participants` está vacío (desconocido), NO se bloquea (leniente).
- El Narrador silencia/activa jugadores en la pestaña Mesa (`MembersPanel` → `setMemberMuted`).
- **Fondo de mesa**: el Narrador sube una imagen de ubicación desde el topbar (botón "Fondo", solo DM) que se usa como fondo de la mesa 3D (`mesas.background_url`). Se sube al bucket `avatars` con prefijo `bg-` (`uploadBackground`) y se sincroniza a los jugadores por polling (`useMesaBackground` → `getMesa` cada 3 s). El fondo lo aplica `Table3D` con `scene.background` (`Backdrop`).
- **Los números flotantes de los dados están ocultos por defecto** (`showDieLabels` false); hay un botón "Números ON/OFF" en el topbar para mostrarlos. El código de invitación se copia con un clic desde el botón "Código XXXXXX" del topbar (sin pasar por la pestaña Mesa).
- **El sandbox de Discord bloquea y-webrtc** (los signaling servers `signaling.yjs.dev`/heroku no están en URL Mappings): la presencia Yjs no sincroniza ahí dentro. Por eso la presencia del Narrador usa `activity.participants` (eventos nativos `ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE`, funcionan en el sandbox).
- **Supabase Realtime tampoco es fiable en el sandbox** (el WebSocket puede no llegar por el proxy de Discord). Por eso `useGameLog` y `useMembers` hacen **polling REST** cada ~2.5–3 s como fallback (`loadLogSince` con solape de 1 s, `listMembers`). El realtime sigue suscrito como vía rápida cuando funciona. No elimines el polling.

## Ficha de personaje

- Pestaña **Ficha** en el panel crónica (`CharacterSheet.jsx`), solo con mesa persistida. Renderiza **dentro del panel** (no modal): `.sheet-viewer` (selector de ficha del Narrador + NPCs) + `.sheet-paper` desplazable con la hoja en secciones (Atributos/Habilidades/Ventajas/Méritos/Salud). Datos por `(mesa_id, player_id)` en `player_sheets` (jsonb), igual que `player_notes`/`player_boards`.
- **Panel redimensionable**: en escritorio hay un divisor arrastrable (`.splitter`) entre el panel crónica y la mesa 3D (`App.jsx` guarda `panelW` con pointer events). En móvil la mesa 3D se oculta y no hay divisor.
- Estructura de la hoja (V20) en `src/lib/characterSheet.js`: `defaultSheet()` + `normalizeSheet()` (merge con defaults para no romper filas viejas; migra stats numéricos viejos a `{v, spec}`). Al editar se guarda con debounce en `useSheet` (`src/hooks/useSheet.js`).
- Los campos con **autocompletado** (Naturaleza, Conducta, Concepto, Clan, Generación, Senda, Porte, Disciplinas, Trasfondos, Méritos, Defectos y **Especialidades** de cada atributo/habilidad) usan combobox (`<input list>` + `<datalist>`); las listas exactas están en `src/lib/sheetOptions.js`, **extraídas de `mocks/WOD_Editable.pdf`** (no editar a mano; regenerar con el script de extracción). El coste de Méritos/Defectos es manual. Defaults del PDF: Senda "Humanidad", Porte "Resolución", Virtudes Conciencia/Autocontrol (alternables a Convicción/Instinto).
- **Tiradas desde la ficha**: clic en el dado (⚄) o en el *nombre* de una stat arma la tirada en el **campo de dados del footer** (estado `diceText` en `App.jsx`, `DicePanel` es controlado). El *nombre* acumula stats en una reserva combinada (`Fuerza + Potencia`); el dado lanza solo esa stat. La **dificultad** se edita en el propio campo de texto (`/r 5wod6` → cambiar el 6). `composeSheetRoll` conserva la dificultad actual del input (default 6).
- **El Narrador ve todas las fichas** (solo lectura) con el selector de la pestaña Ficha (`sheetTarget` en `App.jsx`). Los jugadores solo ven/editando la suya.
- **NPCs del Narrador**: el Narrador crea/borra fichas de NPC desde la pestaña Ficha (`useNpcs`). Son filas de `player_sheets` con `player_id` prefijado `npc-<uuid>` (`listNpcSheets` filtra por `like 'npc-%'`); el nombre del NPC es `data.header.nombre`.
- Al aceptar el `CharacterGate` (jugador nuevo) se salta a la pestaña Ficha (`setTab('ficha')`).

## Supabase

- `supabase/schema.sql` = esquema completo (tablas + RLS + publicación realtime). Migraciones incrementales: `supabase/migration_members.sql`, `supabase/migration_sheets.sql` (tabla `player_sheets`), `supabase/migration_avatars.sql` (bucket de storage `avatars`), `supabase/migration_background.sql` (columna `mesas.background_url`), `supabase/migration_photo.sql` (columna `mesa_members.photo`).
- El RLS es `using (true)` (abierto a propósito). No lo "endurezcas" sin hablar con el usuario.
- El `roomId` de sync es `mesa-<mesaId>` cuando hay mesa persistida, si no `activity.roomId`.
- **Tú NO puedes ejecutar DDL**: el agente solo tiene la publishable key (REST). Los cambios de schema (`muted` en `mesa_members`, drop de `character_name` en `player_notes`) están en los archivos `.sql`; recuérdale al usuario correrlos en el SQL Editor de Supabase.
- **Sí puedes borrar filas por REST** (así se limpia la BD). DELETE con header `apikey`/`Authorization: Bearer <publishable key>` a `$VITE_SUPABASE_URL/rest/v1/<tabla>?<filtro>`. Las tablas con `id` uuid usan `id=gt.00000000-0000-0000-0000-000000000000`; las de clave compuesta (`player_notes`, `player_boards`, `player_sheets`, `mesa_members`) usan `mesa_id=not.is.null` (un filtro con `id` da 400). Verifica con `select=count` + header `Prefer: count=exact`.

## Discord Activity (gotchas del portal)

- URL Mappings sin `https://` y con el prefix más corto **al final**: `/supabase`, `/gfonts`, `/gstatic`, `/`.
- El SDK mapea Supabase vía `patchUrlMappings` con prefix `/supabase` (`src/lib/discord.js`).
- Si el mapping `/supabase` falla, `cleanError` (lib/supabase.js) convierte respuestas HTML en el hint "Revisa el URL Mapping /supabase en el portal de Discord".
- La identidad de Discord requiere la Edge Function `discord-token`; sin ella cae a "elegir usuario de la Activity".

## Convenciones

- Commits en `main`, estilo Conventional Commits corto: `feat:`, `fix:`.
- `mocks/` está gitignoreado (contiene un PDF con copyright; no lo añadas). Ahí también están los previews de dados para depurar visualmente sin desplegar: `all-dice-preview.html` (autocontenido, three.js por CDN) y `dice-preview.html`+`dice-preview.js` (usa el código real vía `npm run dev` → abre `http://localhost:5173/mocks/dice-preview.html`).
- UX: placeholders vacíos o `XXXXXX` (nunca valores con aspecto real como `K7M2PQ`); los textos de UI van en español.
