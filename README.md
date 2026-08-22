# Diswod

**Diswod** es una [Discord Activity](https://discord.com/developers/docs/activities/overview) y web para jugar *Vampiro: la Mascarada* (reglas al estilo **V20**) con amigos en un canal de voz. 100 % frontend: sin backend propio, con persistencia en **Supabase** y sincronización en vivo entre clientes mediante **WebRTC (Yjs)**.

Incluye una **mesa 3D** (Three.js) con 4 asientos donde los dados caen y se ven reflejados para todos, y un panel lateral con gamelog, notas y pizarra.

---

## Características

### Dados
- **WOD / V20**: `/r 3d6 ataque sigiloso`
  - Éxito si el dado `>= dificultad`.
  - Los `10` repiten (explosión).
  - Los `1` anulan éxitos.
  - Resultado: `Ataque sigiloso: [8, 6, 5] = 3 successes (0 failures)`.
- **Genéricos**: `/r 1d10+4`, `/r 2d6-2`, `/r 1d10+3 iniciativa`
  - Suma el modificador (siempre obligatorio).
  - Resultado: `Iniciativa: 12 (Dados: 8 + Mod: 4)`.
- Descripción opcional después de la expresión. Prefijos `/r` o `/roll`.

### Mesas y jugadores
- Cada mesa tiene un **código de invitación** (p. ej. `K7M2PQ`).
- Hasta **4 asientos** (Narrador + jugadores). El resto entra como **visitante**.
- El **Narrador** puede dar/quitar asiento, silenciar y expulsar jugadores.
- Cualquiera puede **salir** de la mesa.
- Varias mesas a la vez; archivar y retomar.

### Persistencia (Supabase)
- Gamelog persistido entre sesiones de juego.
- **Bloc de notas** y **pizarra** (trazos) por jugador y mesa.
- **Borrar mis datos** (anonimiza tiradas y elimina notas/pizarra).

### Actividad de Discord
- Identidad desde el SDK (`identify`), lista de participantes en la activity.
- La versión web está bloqueada en producción (muestra un aviso para usar Discord); en desarrollo local funciona igual con `?room=` para compartir sala, o con `VITE_ALLOW_WEB=1`.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 19 + Vite |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| Discord | @discord/embedded-app-sdk |
| Persistencia | Supabase (Postgres + Realtime) |
| Sync en vivo | Yjs + y-webrtc |
| Hosting | Cloudflare Workers (estático) |

---

## Desarrollo

```bash
npm install
npm run dev
```

Tests:

```bash
npm test
```

Build:

```bash
npm run build
```

### Variables de entorno

Copia `.env.example` a `.env`:

```bash
VITE_DISCORD_CLIENT_ID=            # ID de la app de Discord
VITE_SUPABASE_URL=                 # URL del proyecto Supabase
VITE_SUPABASE_PUBLISHABLE_KEY=     # publishable key de Supabase
```

> Las variables con `VITE_` viajan al navegador. No pongas el *client secret* de Discord en el frontend: va en la Edge Function `discord-token`.

---

## Base de datos (Supabase)

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta `supabase/schema.sql`.
3. Si ya tenías tablas previas, ejecuta `supabase/migration_members.sql`.

Tablas: `mesas`, `sessions`, `log_entries`, `mesa_members`, `player_notes`, `player_boards`.

### Identidad de Discord (opcional)

Para obtener el usuario de Discord en la activity, despliega la Edge Function `supabase/functions/discord-token` y configura los secretos `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET`.

---

## Configurar la Activity en Discord

En el [Portal de desarrolladores](https://discord.com/developers/applications):

1. **OAuth2 → Redirects**: `https://127.0.0.1` (placeholder).
2. **Actividades → Ajustes**:
   - Habilitar Actividades: ON.
   - Restricción por edad: ON (contenido 18+).
   - Máximo de participantes: el que quieras.
3. **Actividades → Asignaciones de URL** (sin `https://`, el más corto al final):

   | Prefix | Target |
   |--------|--------|
   | `/supabase` | `TU_PROYECTO.supabase.co` |
   | `/gfonts` | `fonts.googleapis.com` |
   | `/gstatic` | `fonts.gstatic.com` |
   | `/` | `diswod.tudominio.com` |

4. **Información general**:
   - Condiciones: `https://diswod.tudominio.com/tos.html`
   - Privacidad: `https://diswod.tudominio.com/privacy.html`

Para probar: entra a un canal de voz, abre el estante de Activities (cohete) y lanza **Diswod** (disponible para ti y tu equipo hasta publicarla).

---

## Estructura

```
src/
  lib/         parser, dados, seats, invite, discord, supabase, sync, mesasApi
  hooks/       useActivity, useMesas, useMembers, useGameLog
  components/  Table3D, DicePanel, GameLog, ChroniclePanel, NotesPad,
               Whiteboard, MembersPanel, MesaLobby, NameGate, ...
supabase/
  schema.sql   esquema completo (tablas + RLS)
  migration_members.sql  migración para instalaciones previas
  functions/discord-token  Edge Function de intercambio OAuth
public/
  tos.html, privacy.html  páginas legales para el portal
```

---

## Licencia y legal

Código y marca Diswod: del operador de la instancia. *Vampire: The Masquerade* y marcas relacionadas pertenecen a sus titulares; esta app solo implementa una mecánica de dados de aficionado y no incluye el reglamento oficial.
