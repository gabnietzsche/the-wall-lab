-- Migration 003 — Countdown pre-partita di 3 secondi
--
-- Quando il matchmaking trova due giocatori, prima che inizi il gameplay
-- effettivo c'è una finestra di 3 secondi in cui entrambi vedono un countdown
-- 3-2-1 GO! e i colpi sono ignorati. Questo dà tempo ai client di sincronizzarsi
-- e ai giocatori di prepararsi.
--
-- Implementazione:
-- - games.playing_from = started_at + 3 sec  → da quel momento si può colpire
-- - games.ends_at      = started_at + 103 sec → 100s di gioco effettivo
-- - hit_brick rifiuta i colpi prima di playing_from con error='not_started'

-- =========================================================================
-- Schema
-- =========================================================================
alter table public.games
  add column if not exists playing_from timestamptz;

-- Backfill (sicurezza per partite già attive: parte subito, niente countdown)
update public.games set playing_from = started_at where playing_from is null;

alter table public.games
  alter column playing_from set not null,
  alter column playing_from set default (now() + interval '3 seconds');

-- ends_at deve dare 100s di gioco effettivo, quindi started_at + 103
alter table public.games
  alter column ends_at set default (now() + interval '103 seconds');

-- =========================================================================
-- Ricreo la view games_public per esporre playing_from al client
-- =========================================================================
drop view if exists public.games_public;
create view public.games_public with (security_invoker = on) as
  select id, status, started_at, ends_at, playing_from,
         player1_nick, player2_nick,
         player1_id, player2_id,
         player1_coins, player2_coins,
         powerups
    from public.games;

grant select on public.games_public to anon, authenticated;

-- =========================================================================
-- _create_game: imposta playing_from = now() + 3s e ends_at = now() + 103s
-- =========================================================================
create or replace function public._create_game(p1_id text, p1_nick text, p2_id text, p2_nick text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool text[] := ARRAY['pistola','dinamite','raggi-x','scudo','quadrifoglio','scalpello','gabbia','doppia-gabbia','fantasma'];
  v_gen jsonb;
  v_powerups text[];
  v_game_id uuid;
  v_i int;
  v_now timestamptz := now();
begin
  v_gen := public._generate_wall(v_pool);
  v_powerups := array(select jsonb_array_elements_text(v_gen->'powerups'));

  insert into public.games(
    player1_id, player1_nick, player2_id, player2_nick, wall, powerups,
    started_at, playing_from, ends_at
  ) values (
    p1_id, p1_nick, p2_id, p2_nick, v_gen, v_powerups,
    v_now, v_now + interval '3 seconds', v_now + interval '103 seconds'
  ) returning id into v_game_id;

  for v_i in 0..24 loop
    insert into public.bricks(game_id, position) values (v_game_id, v_i);
  end loop;

  insert into public.player_states(game_id, player, client_id) values
    (v_game_id, 1, p1_id),
    (v_game_id, 2, p2_id);

  return v_game_id;
end $$;

-- =========================================================================
-- hit_brick: aggiunto check 'not_started' prima del cooldown
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
  v_now         timestamptz := now();
  v_my_side_broken boolean := false;
  v_other_broken_at timestamptz;
  v_my_hits     int;
  v_outcome     text;
  v_content     text;
  v_effects     jsonb;
  v_other_eff   jsonb;
  v_eff         jsonb;
  v_kept        jsonb := '[]'::jsonb;
  v_has_shield  boolean := false;
  v_blast_pos   int := null;
  v_blast_content text;
  v_neighbors   int[];
  v_adj         int;
  v_revealed    jsonb := '[]'::jsonb;
  v_xray_pos    int[];
  v_new_cooldown timestamptz;
  v_total_broken int;
  v_window_ms   int := 300;
begin
  if p_position is null or p_position < 0 or p_position > 24 then
    return jsonb_build_object('ok', false, 'error', 'invalid_position');
  end if;

  select * into v_game from public.games
    where (player1_id = p_client_id or player2_id = p_client_id)
      and status = 'playing'
      and ends_at > v_now
    order by started_at desc
    limit 1;
  if v_game.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_active_game');
  end if;

  -- COUNTDOWN: rifiuta i colpi prima dell'inizio effettivo
  if v_game.playing_from is not null and v_now < v_game.playing_from then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;

  v_player := case when v_game.player1_id = p_client_id then 1 else 2 end;
  v_other  := 3 - v_player;

  select * into v_state       from public.player_states where game_id = v_game.id and player = v_player for update;
  select * into v_other_state from public.player_states where game_id = v_game.id and player = v_other  for update;

  if v_state.last_hit_at is not null and v_now - v_state.last_hit_at < interval '1.8 seconds' then
    return jsonb_build_object('ok', false, 'error', 'cooldown');
  end if;
  if v_state.shots_remaining <= 0 then
    return jsonb_build_object('ok', false, 'error', 'no_shots');
  end if;

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

  select * into v_brick from public.bricks where game_id = v_game.id and position = p_position for update;

  if (v_player = 1 and v_brick.front_broken_at is not null) or
     (v_player = 2 and v_brick.back_broken_at  is not null) then
    update public.player_states
      set last_hit_at = v_now,
          shots_remaining = greatest(0, shots_remaining - 1),
          active_effects = v_effects
      where game_id = v_game.id and player = v_player;
    return jsonb_build_object('ok', true, 'my_side_broken_already', true);
  end if;

  if v_player = 1 then
    v_brick.front_hits := v_brick.front_hits + 1;
    v_my_hits := v_brick.front_hits;
  else
    v_brick.back_hits := v_brick.back_hits + 1;
    v_my_hits := v_brick.back_hits;
  end if;

  if v_my_hits >= v_hits_needed then
    v_my_side_broken := true;
    if v_player = 1 then
      v_brick.front_broken_at := v_now;
      v_other_broken_at := v_brick.back_broken_at;
    else
      v_brick.back_broken_at := v_now;
      v_other_broken_at := v_brick.front_broken_at;
    end if;

    v_content := v_game.wall->'contents'->>p_position;
    v_brick.revealed_content := v_content;

    if v_other_broken_at is not null then
      if v_now - v_other_broken_at < (v_window_ms || ' milliseconds')::interval then
        v_outcome := 'lost';
        v_brick.taken_by := 0;

        if v_content = 'coin' then
          if v_other = 1 then
            update public.games set player1_coins = greatest(0, player1_coins - 1) where id = v_game.id;
          else
            update public.games set player2_coins = greatest(0, player2_coins - 1) where id = v_game.id;
          end if;
        end if;

        if v_content in ('pistola','scudo','raggi-x','scalpello') then
          v_other_eff := (
            with ord as (
              select e, ord
              from jsonb_array_elements(v_other_state.active_effects) with ordinality as t(e, ord)
            ),
            target as (
              select max(ord) as ord from ord where e->>'type' = v_content
            )
            select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
            from ord, target
            where ord.ord <> target.ord or target.ord is null
          );
          update public.player_states
            set active_effects = coalesce(v_other_eff, '[]'::jsonb)
            where game_id = v_game.id and player = v_other;
        end if;
      else
        v_outcome := 'opp_taken';
      end if;
    else
      v_outcome := 'won';
      v_brick.taken_by := v_player;

      if v_content = 'coin' then
        if v_player = 1 then
          update public.games set player1_coins = player1_coins + 1 where id = v_game.id;
        else
          update public.games set player2_coins = player2_coins + 1 where id = v_game.id;
        end if;
      elsif v_content in ('pistola','dinamite','raggi-x','scudo','quadrifoglio') then
        if v_content = 'pistola' then
          v_effects := v_effects || jsonb_build_object('type','pistola','shots_left', 2);
        elsif v_content = 'scudo' then
          v_effects := v_effects || jsonb_build_object('type','scudo');
        elsif v_content = 'quadrifoglio' then
          update public.player_states
            set last_hit_at = v_now + interval '2 seconds'
            where game_id = v_game.id and player = v_other;
        elsif v_content = 'raggi-x' then
          select coalesce(array_agg(position), '{}') into v_xray_pos from (
            select position from public.bricks
              where game_id = v_game.id
                and position <> p_position
                and case when v_player = 1
                         then front_broken_at is null
                         else back_broken_at  is null
                    end
              order by random() limit 3
          ) z;
          v_revealed := to_jsonb(v_xray_pos);
          v_effects := v_effects || jsonb_build_object('type','raggi-x','revealed', to_jsonb(v_xray_pos));
        elsif v_content = 'dinamite' then
          select coalesce(array_agg(n), '{}') into v_neighbors
            from unnest(ARRAY[
              case when (p_position % 5) > 0 then p_position - 1 end,
              case when (p_position % 5) < 4 then p_position + 1 end,
              case when p_position >= 5  then p_position - 5 end,
              case when p_position < 20  then p_position + 5 end
            ]) n where n is not null;

          select b.position into v_adj
            from public.bricks b
            where b.game_id = v_game.id
              and b.position = any(v_neighbors)
              and case when v_player = 1
                       then b.front_broken_at is null
                       else b.back_broken_at  is null
                  end
            order by random() limit 1;

          if v_adj is not null then
            v_blast_pos := v_adj;
            v_blast_content := v_game.wall->'contents'->>v_adj;
            if v_player = 1 then
              update public.bricks
                set front_broken_at = v_now,
                    front_hits      = greatest(front_hits, 2),
                    revealed_content= coalesce(revealed_content, v_blast_content),
                    taken_by        = coalesce(taken_by, v_player)
                where game_id = v_game.id and position = v_adj;
            else
              update public.bricks
                set back_broken_at = v_now,
                    back_hits      = greatest(back_hits, 2),
                    revealed_content= coalesce(revealed_content, v_blast_content),
                    taken_by       = coalesce(taken_by, v_player)
                where game_id = v_game.id and position = v_adj;
            end if;
            if v_blast_content = 'coin' and not exists (
              select 1 from public.bricks
              where game_id = v_game.id and position = v_adj and taken_by is not null and taken_by <> v_player
            ) then
              if v_player = 1 then
                update public.games set player1_coins = player1_coins + 1 where id = v_game.id;
              else
                update public.games set player2_coins = player2_coins + 1 where id = v_game.id;
              end if;
            end if;
          end if;
        end if;
      elsif v_content in ('scalpello','gabbia','doppia-gabbia') then
        v_has_shield := exists (
          select 1 from jsonb_array_elements(v_effects) e where e->>'type' = 'scudo'
        );
        if v_has_shield then
          v_other_eff := (
            with ord as (
              select e, ord
              from jsonb_array_elements(v_effects) with ordinality as t(e, ord)
            ),
            target as (
              select min(ord) as ord from ord where e->>'type' = 'scudo'
            )
            select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
            from ord, target
            where ord.ord <> target.ord or target.ord is null
          );
          v_effects := coalesce(v_other_eff, '[]'::jsonb);
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
        update public.player_states
          set active_effects = v_other_state.active_effects ||
            jsonb_build_object('type','fantasma','expires_at', to_jsonb((v_now + interval '8 seconds')::text))
          where game_id = v_game.id and player = v_other;
      end if;
    end if;
  end if;

  update public.bricks
    set front_hits       = v_brick.front_hits,
        back_hits        = v_brick.back_hits,
        front_broken_at  = v_brick.front_broken_at,
        back_broken_at   = v_brick.back_broken_at,
        taken_by         = v_brick.taken_by,
        revealed_content = v_brick.revealed_content,
        broken           = (v_brick.front_broken_at is not null and v_brick.back_broken_at is not null)
    where game_id = v_game.id and position = p_position;

  if v_new_cooldown is null then v_new_cooldown := v_now; end if;
  update public.player_states
    set last_hit_at     = v_new_cooldown,
        shots_remaining = greatest(0, shots_remaining - 1),
        active_effects  = v_effects
    where game_id = v_game.id and player = v_player;

  select count(*) into v_total_broken
    from public.bricks
    where game_id = v_game.id
      and front_broken_at is not null
      and back_broken_at  is not null;
  if v_total_broken >= 25 then
    update public.games set status = 'finished' where id = v_game.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'my_side_broken', v_my_side_broken,
    'outcome', v_outcome,
    'content', case when v_my_side_broken then v_content else null end,
    'blast_position', v_blast_pos,
    'xray', v_revealed
  );
end $$;

grant execute on function public.hit_brick(text, int) to anon, authenticated;
