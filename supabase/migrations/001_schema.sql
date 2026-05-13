-- The Wall — schema + RPC
-- Esegui questo file nell'SQL Editor di Supabase (nuovo progetto).

-- =========================================================================
-- Pulizia (idempotente in dev)
-- =========================================================================
drop function if exists public.request_match(text, text) cascade;
drop function if exists public.cancel_match(text) cascade;
drop function if exists public.hit_brick(text, int) cascade;
drop function if exists public.finalize_game(uuid) cascade;
drop function if exists public._generate_wall(text[]) cascade;
drop function if exists public._create_game(text, text, text, text) cascade;

drop table if exists public.player_states cascade;
drop table if exists public.bricks cascade;
drop table if exists public.lobby cascade;
drop table if exists public.games cascade;

-- =========================================================================
-- Tabelle
-- =========================================================================
create table public.games (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'playing' check (status in ('playing','finished')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '100 seconds'),
  player1_nick text not null,
  player2_nick text not null,
  player1_id text not null,
  player2_id text not null,
  player1_coins int not null default 0,
  player2_coins int not null default 0,
  wall jsonb not null,                  -- 25 contenuti veri (server-only via RLS)
  powerups text[] not null              -- 5 powerup scelti dal pool di 9
);
create index on public.games(player1_id);
create index on public.games(player2_id);

create table public.bricks (
  game_id uuid not null references public.games(id) on delete cascade,
  position int not null check (position between 0 and 24),
  front_hits int not null default 0,    -- player 1
  back_hits int not null default 0,     -- player 2
  broken boolean not null default false,
  revealed_content text,                -- popolato solo a rottura
  taken_by int,                          -- 1 o 2
  primary key (game_id, position)
);

create table public.player_states (
  game_id uuid not null references public.games(id) on delete cascade,
  player int not null check (player in (1,2)),
  client_id text not null,
  last_hit_at timestamptz,
  shots_remaining int not null default 50,
  active_effects jsonb not null default '[]'::jsonb,
  primary key (game_id, player)
);
create index on public.player_states(client_id);

create table public.lobby (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  nick text not null,
  joined_at timestamptz not null default now()
);

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.games          enable row level security;
alter table public.bricks         enable row level security;
alter table public.player_states  enable row level security;
alter table public.lobby          enable row level security;

-- Tutti gli anonymous possono LEGGERE games e bricks (con 'wall' filtrato sotto)
create policy "read games"  on public.games          for select to anon, authenticated using (true);
create policy "read bricks" on public.bricks         for select to anon, authenticated using (true);
create policy "read states" on public.player_states  for select to anon, authenticated using (true);
create policy "read lobby"  on public.lobby          for select to anon, authenticated using (true);

-- NESSUNA policy INSERT/UPDATE/DELETE → si scrive solo via RPC SECURITY DEFINER

-- Nascondi il contenuto del muro ai client: creiamo una view senza la colonna 'wall'
drop view if exists public.games_public;
create view public.games_public with (security_invoker = on) as
  select id, status, started_at, ends_at,
         player1_nick, player2_nick,
         player1_id, player2_id,
         player1_coins, player2_coins,
         powerups
    from public.games;

grant select on public.games_public to anon, authenticated;

-- =========================================================================
-- Helper interni
-- =========================================================================
-- Genera muro 5x5: 20 monete, 5 powerup random da pool, rest empty (= 0 nel nostro caso totale 25, già pieno)
create or replace function public._generate_wall(p_pool text[])
returns jsonb
language plpgsql
as $$
declare
  v_positions int[] := array(select i from generate_series(0,24) i order by random());
  v_powerups text[];
  v_contents text[] := array_fill('empty'::text, ARRAY[25]);
  v_i int;
begin
  -- 5 powerup random dal pool di 9
  v_powerups := (
    select array_agg(p) from (
      select p from unnest(p_pool) p order by random() limit 5
    ) x
  );
  -- prime 20 posizioni → monete
  for v_i in 1..20 loop
    v_contents[v_positions[v_i] + 1] := 'coin';
  end loop;
  -- successive 5 posizioni → powerup (uno per powerup scelto)
  for v_i in 1..5 loop
    v_contents[v_positions[20 + v_i] + 1] := v_powerups[v_i];
  end loop;
  return jsonb_build_object('contents', to_jsonb(v_contents), 'powerups', to_jsonb(v_powerups));
end $$;

-- Crea una partita date due coppie (nick, client_id)
create or replace function public._create_game(p1_id text, p1_nick text, p2_id text, p2_nick text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool text[] := ARRAY['pistola','dinamite','raggi-x','scudo','quadrifoglio','scalpello','gabbia','doppia-gabbia','fantasma'];
  v_gen jsonb;
  v_contents jsonb;
  v_powerups text[];
  v_game_id uuid;
  v_i int;
begin
  v_gen := public._generate_wall(v_pool);
  v_contents := v_gen->'contents';
  v_powerups := array(select jsonb_array_elements_text(v_gen->'powerups'));

  insert into public.games(
    player1_id, player1_nick, player2_id, player2_nick, wall, powerups
  ) values (
    p1_id, p1_nick, p2_id, p2_nick, v_gen, v_powerups
  ) returning id into v_game_id;

  -- 25 mattoni vuoti
  for v_i in 0..24 loop
    insert into public.bricks(game_id, position) values (v_game_id, v_i);
  end loop;

  insert into public.player_states(game_id, player, client_id) values
    (v_game_id, 1, p1_id),
    (v_game_id, 2, p2_id);

  return v_game_id;
end $$;

-- =========================================================================
-- RPC: matchmaking
-- =========================================================================
create or replace function public.request_match(p_client_id text, p_nick text)
returns table(game_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner record;
  v_existing uuid;
  v_new_game uuid;
begin
  -- 1) Se sono già in una partita attiva, ritorno quella
  select id into v_existing
    from public.games
    where status = 'playing'
      and ends_at > now()
      and (player1_id = p_client_id or player2_id = p_client_id)
    order by started_at desc
    limit 1;
  if v_existing is not null then
    return query select v_existing;
    return;
  end if;

  -- 2) Cerco un altro in lobby (skip locked per evitare race)
  select * into v_partner
    from public.lobby
    where client_id <> p_client_id
    order by joined_at asc
    for update skip locked
    limit 1;

  if v_partner is not null then
    -- match! rimuovi entrambi dalla lobby e crea partita
    delete from public.lobby where client_id in (p_client_id, v_partner.client_id);
    v_new_game := public._create_game(v_partner.client_id, v_partner.nick, p_client_id, p_nick);
    return query select v_new_game;
    return;
  end if;

  -- 3) Nessun avversario disponibile: aggiungiti alla lobby
  insert into public.lobby(client_id, nick) values (p_client_id, p_nick)
    on conflict (client_id) do update set nick = excluded.nick, joined_at = now();
  return query select null::uuid;
end $$;

create or replace function public.cancel_match(p_client_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.lobby where client_id = p_client_id;
end $$;

-- =========================================================================
-- RPC: hit_brick — logica principale
-- =========================================================================
create or replace function public.hit_brick(p_client_id text, p_position int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game        public.games%rowtype;
  v_player      int;
  v_other       int;
  v_state       public.player_states%rowtype;
  v_other_state public.player_states%rowtype;
  v_brick       public.bricks%rowtype;
  v_hits_needed int := 2;
  v_one_shot    boolean := false;
  v_blast_pos   int := null;
  v_now timestamptz := now();
  v_contents    jsonb;
  v_content     text;
  v_effects     jsonb;
  v_other_eff   jsonb;
  v_revealed    jsonb := '[]'::jsonb;
  v_xray_pos    int[];
  v_eff         jsonb;
  v_kept        jsonb := '[]'::jsonb;
  v_has_shield  boolean := false;
  v_neighbors   int[];
  v_adj         int;
  v_blast_content text;
  v_new_cooldown timestamptz;
begin
  if p_position is null or p_position < 0 or p_position > 24 then
    return jsonb_build_object('ok', false, 'error', 'invalid_position');
  end if;

  -- Carico partita
  select * into v_game from public.games
    where (player1_id = p_client_id or player2_id = p_client_id)
      and status = 'playing'
      and ends_at > v_now
    order by started_at desc
    limit 1;
  if v_game.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_active_game');
  end if;

  v_player := case when v_game.player1_id = p_client_id then 1 else 2 end;
  v_other  := 3 - v_player;

  -- Stati
  select * into v_state from public.player_states where game_id = v_game.id and player = v_player for update;
  select * into v_other_state from public.player_states where game_id = v_game.id and player = v_other for update;

  -- Cooldown 2s
  if v_state.last_hit_at is not null and v_now - v_state.last_hit_at < interval '1.8 seconds' then
    return jsonb_build_object('ok', false, 'error', 'cooldown');
  end if;
  if v_state.shots_remaining <= 0 then
    return jsonb_build_object('ok', false, 'error', 'no_shots');
  end if;

  -- Applica effetti attivi su SE STESSO che modificano il colpo (pistola, scalpello)
  v_effects := v_state.active_effects;
  v_kept := '[]'::jsonb;
  for v_eff in select * from jsonb_array_elements(v_effects) loop
    if (v_eff->>'type') = 'pistola' and coalesce((v_eff->>'shots_left')::int, 0) > 0 then
      v_one_shot := true;
      if (v_eff->>'shots_left')::int - 1 > 0 then
        v_kept := v_kept || jsonb_build_object('type','pistola','shots_left', (v_eff->>'shots_left')::int - 1);
      end if;
    elsif (v_eff->>'type') = 'scalpello' and coalesce((v_eff->>'shots_left')::int, 0) > 0 then
      v_hits_needed := 3;
      if (v_eff->>'shots_left')::int - 1 > 0 then
        v_kept := v_kept || jsonb_build_object('type','scalpello','shots_left', (v_eff->>'shots_left')::int - 1);
      end if;
    else
      v_kept := v_kept || v_eff;
    end if;
  end loop;
  v_effects := v_kept;

  if v_one_shot then v_hits_needed := 1; end if;

  -- Carico mattone
  select * into v_brick from public.bricks where game_id = v_game.id and position = p_position for update;
  if v_brick.broken then
    -- Mattone già rotto: il colpo si "perde" comunque (rispetta cooldown + colpi)
    update public.player_states
      set last_hit_at = v_now,
          shots_remaining = greatest(0, shots_remaining - 1),
          active_effects = v_effects
      where game_id = v_game.id and player = v_player;
    return jsonb_build_object('ok', true, 'broken_already', true);
  end if;

  -- Incremento hit lato giusto
  if v_player = 1 then
    v_brick.front_hits := v_brick.front_hits + 1;
  else
    v_brick.back_hits  := v_brick.back_hits + 1;
  end if;

  -- Rottura?
  if (v_brick.front_hits + v_brick.back_hits) >= v_hits_needed then
    v_brick.broken := true;
    v_brick.taken_by := v_player;
    v_contents := v_game.wall->'contents';
    v_content := (v_contents->>p_position);
    v_brick.revealed_content := v_content;
  end if;

  update public.bricks
    set front_hits = v_brick.front_hits,
        back_hits  = v_brick.back_hits,
        broken     = v_brick.broken,
        taken_by   = v_brick.taken_by,
        revealed_content = v_brick.revealed_content
    where game_id = v_game.id and position = p_position;

  -- Se ho appena rotto il mattone, processo il contenuto
  if v_brick.broken and v_brick.taken_by = v_player then
    if v_content = 'coin' then
      if v_player = 1 then
        update public.games set player1_coins = player1_coins + 1 where id = v_game.id;
      else
        update public.games set player2_coins = player2_coins + 1 where id = v_game.id;
      end if;
    elsif v_content in ('pistola','dinamite','raggi-x','scudo','quadrifoglio') then
      -- BONUS per chi ha rotto
      if v_content = 'pistola' then
        v_effects := v_effects || jsonb_build_object('type','pistola','shots_left', 2);
      elsif v_content = 'scudo' then
        v_effects := v_effects || jsonb_build_object('type','scudo');
      elsif v_content = 'quadrifoglio' then
        -- blocca l'avversario per 2s: forza last_hit_at avanti
        update public.player_states
          set last_hit_at = v_now + interval '2 seconds'
          where game_id = v_game.id and player = v_other;
      elsif v_content = 'raggi-x' then
        -- rivela 3 mattoni non rotti casuali (solo al chiamante via return)
        select coalesce(array_agg(position), '{}') into v_xray_pos from (
          select position from public.bricks
            where game_id = v_game.id and not broken and position <> p_position
            order by random() limit 3
        ) z;
        v_revealed := to_jsonb(v_xray_pos);
        v_effects := v_effects || jsonb_build_object('type','raggi-x','revealed', to_jsonb(v_xray_pos));
      elsif v_content = 'dinamite' then
        -- adiacenti reali sulla griglia 5x5
        select coalesce(array_agg(n), '{}') into v_neighbors
          from unnest(ARRAY[
            case when (p_position % 5) > 0 then p_position - 1 end,
            case when (p_position % 5) < 4 then p_position + 1 end,
            case when p_position >= 5  then p_position - 5 end,
            case when p_position < 20  then p_position + 5 end
          ]) n where n is not null;
        -- scegli un adiacente non rotto random
        select b.position into v_adj
          from public.bricks b
          where b.game_id = v_game.id and b.position = any(v_neighbors) and not b.broken
          order by random() limit 1;
        if v_adj is not null then
          v_blast_pos := v_adj;
          v_blast_content := v_game.wall->'contents'->>v_adj;
          update public.bricks
            set broken = true, taken_by = v_player, revealed_content = v_blast_content,
                front_hits = case when v_player = 1 then 2 else front_hits end,
                back_hits  = case when v_player = 2 then 2 else back_hits end
            where game_id = v_game.id and position = v_adj;
          if v_blast_content = 'coin' then
            if v_player = 1 then
              update public.games set player1_coins = player1_coins + 1 where id = v_game.id;
            else
              update public.games set player2_coins = player2_coins + 1 where id = v_game.id;
            end if;
          end if;
        end if;
      end if;

    elsif v_content in ('scalpello','gabbia','doppia-gabbia') then
      -- MALUS subito da chi ha rotto. Scudo blocca.
      v_has_shield := exists (
        select 1 from jsonb_array_elements(v_effects) e where e->>'type' = 'scudo'
      );
      if v_has_shield then
        -- consuma scudo
        v_effects := (
          select coalesce(jsonb_agg(e), '[]'::jsonb)
          from jsonb_array_elements(v_effects) e
          where (e->>'type') <> 'scudo'
        );
      else
        if v_content = 'scalpello' then
          v_effects := v_effects || jsonb_build_object('type','scalpello','shots_left', 2);
        elsif v_content = 'gabbia' then
          v_new_cooldown := v_now + interval '2 seconds';
        elsif v_content = 'doppia-gabbia' then
          v_new_cooldown := v_now + interval '4 seconds';
        end if;
      end if;

    elsif v_content = 'fantasma' then
      -- Malus contro l'avversario: nasconde il MIO punteggio al suo HUD per 8s
      v_other_eff := v_other_state.active_effects ||
        jsonb_build_object('type','fantasma','expires_at', to_jsonb((v_now + interval '8 seconds')::text));
      update public.player_states
        set active_effects = v_other_eff
        where game_id = v_game.id and player = v_other;
    end if;
  end if;

  -- Salva stato giocatore (effetti + cooldown + colpi)
  if v_new_cooldown is null then
    v_new_cooldown := v_now;
  end if;
  update public.player_states
    set last_hit_at = v_new_cooldown,
        shots_remaining = greatest(0, shots_remaining - 1),
        active_effects = v_effects
    where game_id = v_game.id and player = v_player;

  return jsonb_build_object(
    'ok', true,
    'broken', v_brick.broken,
    'content', case when v_brick.broken then v_content else null end,
    'blast_position', v_blast_pos,
    'xray', v_revealed
  );
end $$;

-- =========================================================================
-- RPC: finalize_game — quando il timer scade
-- =========================================================================
create or replace function public.finalize_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games
    set status = 'finished'
    where id = p_game_id and (ends_at <= now() or status = 'playing');
end $$;

-- Permessi RPC
grant execute on function public.request_match(text, text) to anon, authenticated;
grant execute on function public.cancel_match(text)        to anon, authenticated;
grant execute on function public.hit_brick(text, int)      to anon, authenticated;
grant execute on function public.finalize_game(uuid)       to anon, authenticated;

-- =========================================================================
-- Realtime: abilita sul publication di default
-- =========================================================================
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.bricks;
alter publication supabase_realtime add table public.player_states;
alter publication supabase_realtime add table public.lobby;
