# The Wall — Beta

Gioco 1v1 realtime mobile-first. Due giocatori distruggono mattoni di una griglia 5×5 in 100 secondi per raccogliere monete. Dietro ogni mattone: moneta, bonus, malus o vuoto. Chi rompe per primo prende il premio.

Stack: **Next.js 16** (App Router) + **TypeScript** + **Tailwind v4** + **Framer Motion** + **Supabase** (Postgres + Realtime). Audio generato in-app via Web Audio API.

---

## 1. Setup Supabase (5 min, gratis)

1. Vai su [supabase.com](https://supabase.com) → **New Project** (free tier).
   - Scegli password DB (la dimenticherai, va bene)
   - Region: Europa (es. Frankfurt) per latenza più bassa dall'Italia
2. Apri **SQL Editor** → **New query** → incolla il contenuto di
   [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql) → **Run**.
   Crea tabelle, RPC e abilita Realtime.
3. Vai su **Project Settings → API**:
   - Copia `Project URL`
   - Copia `anon public` key
4. Nel progetto crea `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

---

## 2. Run locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000` su due dispositivi (o due browser diversi / due finestre incognito): inserisci due nickname, premi **GIOCA** su entrambi, parte la partita.

**Test su mobile reale**: collega il telefono alla stessa rete Wi-Fi del Mac, apri `http://192.168.x.y:3000` (l'IP che Next stampa come "Network").

---

## 3. Deploy su Vercel (gratis)

```bash
git init && git add . && git commit -m "init"
gh repo create the-wall-beta --public --source=. --push
```

Poi:

1. Vai su [vercel.com/new](https://vercel.com/new) → importa il repo
2. **Environment Variables**: aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (stessi valori del `.env.local`)
3. Deploy → ottieni un URL `https://the-wall-beta.vercel.app`
4. Condividi il link con i tester

---

## Architettura in 30 secondi

- **Frontend** in `app/` (Home → Lobby → Game) + componenti in `components/`
- **Logica autoritaria** in Postgres (`supabase/migrations/001_schema.sql`):
  - `request_match(client_id, nick)` — matchmaking
  - `hit_brick(client_id, position)` — valida colpo, applica bonus/malus, aggiorna stato
  - `finalize_game(game_id)` — chiude la partita quando scade il timer
- **Realtime** via Supabase: ogni client è subscribed a `games`, `bricks`, `player_states` filtrati per `game_id`. Niente WebSocket sul nostro server → compatibile con Vercel free.
- **Identità**: solo nickname + UUID generato in `localStorage` (`getClientId()`). Niente account, niente login.
- **Audio**: Web Audio API in `lib/audio.ts` — oscillatori + rumore filtrato, niente asset da scaricare.

## Regole implementate

- Partita 100s, max 50 colpi, 1 colpo ogni 2s
- Griglia 5×5, 20 monete + 5 powerup random (da pool di 9)
- 2 colpi per rompere (1 con Pistola, 3 con Scalpello)
- Modello "doppio muro": ogni mattone ha `front_hits` (G1) e `back_hits` (G2). Si rompe quando il totale ≥ soglia. Chi dà il colpo finale prende il contenuto.
- 9 powerup: Pistola, Dinamite, Raggi X, Scudo, Quadrifoglio (bonus); Scalpello, Gabbia, Doppia Gabbia, Fantasma (malus)
- Monete tenute anche da chi perde (in `localStorage`)

## Limiti free tier

- **Vercel**: 100 GB bandwidth/mese
- **Supabase**: 500 MB DB, 2 GB egress, 50k connessioni Realtime/mese

Ampiamente sufficienti per centinaia di partite di test.

## Sviluppi futuri (non in questa beta)

- Bot/IA per partita solo
- Classifiche persistenti + account
- Versione premium (soldi reali)
- Condivisione clip social
- Iconografia powerup più ricca
