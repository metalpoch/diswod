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

## Env y secretos

- `.env` está gitignoreado; plantilla en `.env.example`.
- Solo se leen vars con prefijo `VITE_` desde el navegador. **Nunca** pongas el client secret de Discord aquí; va en la Edge Function de Supabase (`supabase/functions/discord-token`, secretos `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`).
- `VITE_CHRONICLE_ALLOWLIST` está en `.env` pero **ya no se usa**: el allowlist (`src/lib/allowlist.js`) es código muerto, solo lo referencia su propio test. El acceso ahora es público con códigos de invitación. No lo reintroduzcas ni dependas de él.

## Arquitectura

- `src/App.jsx` es el orquestador; el resto son piezas.
- `src/lib/`: `parser.js` (parsing de comandos), `dice.js` (tiradas WOD/genéricas), `seats.js` (asientos), `invite.js` (códigos/roles), `discord.js` (SDK Discord), `sync.js` (Yjs/y-webrtc), `supabase.js` (cliente), `mesasApi.js` (todas las llamadas a Supabase).
- `src/hooks/`: `useActivity` (boot del SDK Discord), `useMesas`, `useMembers`, `useGameLog` (fusiona log vivo + persistido).
- `Table3D` se carga con `React.lazy` (code-split de three.js). No lo importes estáticamente.

## Supabase

- `supabase/schema.sql` = esquema completo (tablas + RLS + publicación realtime). `supabase/migration_members.sql` = incremental para instalaciones previas.
- El RLS es `using (true)` (abierto a propósito). No lo "endurezcas" sin hablar con el usuario.
- El `roomId` de sync es `mesa-<mesaId>` cuando hay mesa persistida, si no `activity.roomId`.

## Discord Activity (gotchas del portal)

- URL Mappings sin `https://` y con el prefix más corto **al final**: `/supabase`, `/gfonts`, `/gstatic`, `/`.
- El SDK mapea Supabase vía `patchUrlMappings` con prefix `/supabase` (`src/lib/discord.js`).
- La identidad de Discord requiere la Edge Function `discord-token`; sin ella cae a "elegir usuario de la Activity".

## Convenciones

- Commits en `main`, estilo Conventional Commits corto: `feat:`, `fix:`.
- `mocks/` está gitignoreado (contiene un PDF con copyright; no lo añadas).
