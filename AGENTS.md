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

Push a `main` en GitHub → Cloudflare Workers reconstruye automáticamente. No hay comando de deploy manual. Nunca hagas commit de `dist/` (ignorado).

`vite.config.js` usa `base: './'` (assets relativos, requerido por el sandbox de la Activity) y `vite-plugin-node-polyfills` (lo necesita y-webrtc).

## Env y secretos

- `.env` está gitignoreado; plantilla en `.env.example`.
- Solo se leen vars con prefijo `VITE_` desde el navegador. **Nunca** pongas el client secret de Discord aquí; va en la Edge Function de Supabase (`supabase/functions/discord-token`, secretos `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`).
- **El build de Cloudflare NO ve `.env`** (gitignoreado). Las `VITE_` que necesita el build de Workers deben estar como variables de build en el dashboard (Workers Builds → Settings → Variables). Si faltan `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, la app desplegada arranca con `hasSupabase() === false`: sin mesas, sin bloc de notas ni pizarra (parece "versión vieja", pero es solo falta de env). Verifícalo con: `curl -s https://<worker>/assets/index-*.js | grep -c "kvobnkztrxqilqrhyxbz"` (0 = faltan).
- `VITE_CHRONICLE_ALLOWLIST` está en `.env` pero **ya no se usa**: el allowlist (`src/lib/allowlist.js`) es código muerto, solo lo referencia su propio test. El acceso ahora es público con códigos de invitación. No lo reintroduzcas ni dependas de él.

## Arquitectura

- `src/App.jsx` es el orquestador; el resto son piezas.
- `src/lib/`: `parser.js` (parsing de comandos), `dice.js` (tiradas WOD/genéricas), `seats.js` (asientos), `invite.js` (códigos/roles), `discord.js` (SDK Discord), `sync.js` (Yjs/y-webrtc), `supabase.js` (cliente), `mesasApi.js` (todas las llamadas a Supabase).
- `src/hooks/`: `useActivity` (boot del SDK Discord), `useMesas`, `useMembers`, `useGameLog` (fusiona log vivo + persistido).
- `Table3D` se carga con `React.lazy` (code-split de three.js). No lo importes estáticamente.

## Identidad y nombres

No existe "nombre de jugador" global. El modelo actual:

- **Identidad** = usuario de Discord (id, nombre visible, avatar). En la Activity viene del auth vía la Edge Function `discord-token`; si falla, `NameGate` muestra la lista de participantes para elegir usuario. En web sin Discord: id local + nombre "Jugador".
- **`useActivity` descarta identidades guardadas que no sean de Discord** (o que no estén en los participantes actuales) para que PC y móvil compartan el mismo `player_id` en Supabase. No reintroduzcas nombres custom en la identidad.
- **Nombre de personaje es por mesa** (`mesa_members.player_name`). Al unirse por código siendo miembro nuevo, se muestra un modal de bienvenida (`CharacterGate`) que pide el nombre de personaje y confirma 18+; si lo omites ("Ahora no") queda tu nombre de Discord. Al crear mesa el creador queda como "Narrador". Se edita con el botón ✎ del topbar (`NameEdit`).
- **Renombrar reescribe TODO el historial**: `mesasApi.renameMember` actualiza `mesa_members` + todas las filas de `log_entries` (columna `player_name` y `payload.player.name`), y `log.renamePlayer` reescribe el log vivo en Yjs para todos. Las tiradas nuevas usan el nombre de personaje (`App.jsx`, `charName`).
- La pantalla de entrada (`NameGate`) ya NO pide nombre; solo es el age gate 18+ (texto "contenido 18+") y, en Discord, el picker de participantes. Las páginas legales (`public/tos.html`, `public/privacy.html`) dicen solo 18+.
- **Web bloqueada en producción**: si `useActivity` arranca en modo `standalone` y no hay `VITE_ALLOW_WEB=1`, se muestra `DiscordOnly` invitando a usar la Activity. En dev (`npm run dev`) la web sigue funcionando.

## Reglas de mesa

- Las tiradas se bloquean (`DicePanel` disabled) si el **Narrador no está online** (detección vía presencia Yjs: `log.remotes` contiene el `dmId`) o si **te silenciaron** (`mesa_members.muted`). Notas y pizarra siguen editables. Lógica en `App.jsx` (`dmOnline`, `rollBlocked`).
- El Narrador silencia/activa jugadores en la pestaña Mesa (`MembersPanel` → `setMemberMuted`).

## Supabase

- `supabase/schema.sql` = esquema completo (tablas + RLS + publicación realtime). `supabase/migration_members.sql` = incremental para instalaciones previas.
- El RLS es `using (true)` (abierto a propósito). No lo "endurezcas" sin hablar con el usuario.
- El `roomId` de sync es `mesa-<mesaId>` cuando hay mesa persistida, si no `activity.roomId`.
- **Tú NO puedes ejecutar DDL**: el agente solo tiene la publishable key (REST). Los cambios de schema (`muted` en `mesa_members`, drop de `character_name` en `player_notes`) están en los archivos `.sql`; recuérdale al usuario correrlos en el SQL Editor de Supabase.
- **Sí puedes borrar filas por REST** (así se limpia la BD). DELETE con header `apikey`/`Authorization: Bearer <publishable key>` a `$VITE_SUPABASE_URL/rest/v1/<tabla>?<filtro>`. Las tablas con `id` uuid usan `id=gt.00000000-0000-0000-0000-000000000000`; las de clave compuesta (`player_notes`, `player_boards`, `mesa_members`) usan `mesa_id=not.is.null` (un filtro con `id` da 400). Verifica con `select=count` + header `Prefer: count=exact`.

## Discord Activity (gotchas del portal)

- URL Mappings sin `https://` y con el prefix más corto **al final**: `/supabase`, `/gfonts`, `/gstatic`, `/`.
- El SDK mapea Supabase vía `patchUrlMappings` con prefix `/supabase` (`src/lib/discord.js`).
- Si el mapping `/supabase` falla, `cleanError` (lib/supabase.js) convierte respuestas HTML en el hint "Revisa el URL Mapping /supabase en el portal de Discord".
- La identidad de Discord requiere la Edge Function `discord-token`; sin ella cae a "elegir usuario de la Activity".

## Convenciones

- Commits en `main`, estilo Conventional Commits corto: `feat:`, `fix:`.
- `mocks/` está gitignoreado (contiene un PDF con copyright; no lo añadas).
- UX: placeholders vacíos o `XXXXXX` (nunca valores con aspecto real como `K7M2PQ`); los textos de UI van en español.
