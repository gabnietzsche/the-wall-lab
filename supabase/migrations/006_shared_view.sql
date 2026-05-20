-- Migration 006 — Lab v1: vista condivisa + hits random 2/3 + colore mattone
--
-- Modello aggiornato (semplificazione):
-- - Vista condivisa: entrambi i giocatori vedono lo stesso muro e le stesse crepe
-- - Ogni mattone ha hits_needed random (2 o 3) settato alla creazione
-- - Il mattone si rompe quando (front_hits + back_hits) >= hits_needed
-- - L'ultimo che colpisce prende il contenuto e il mattone si colora del suo colore
-- - Pistola: il prossimo MIO colpo rompe sempre il mattone
-- - Scalpello: rimosso dal pool (incompatibile col modello condiviso)

-- Schema: hits_needed per mattone
alter table public.bricks
  add column if not exists hits_needed int not null default 2;

-- _generate_wall: pool senza scalpello (8 powerup invece di 9, incluso x2-coins)
create or replace function public._generate_wall(p_pool text[])
returns jsonb
language plpgsql
as $$
declare
  v_positions int[] := array(select i from generate_series(0,24) i order by random());
  v_powerups text[];
  v_contents text[] := array_fill('empty'::text, ARRAY[25]);
  v_i int;
  v_coins_count int;
  v_pup_count int;
begin
  v_coins_count := 16 + floor(random() * 7)::int;
  v_pup_count   := 4  + floor(random() * 4)::int;
  if v_coins_count + v_pup_count > 25 then
    v_pup_count := 25 - v_coins_count;
  end if;

  v_powerups := (
    select array_agg(p) from (
      select p from unnest(p_pool) p order by random() limit v_pup_count
    ) x
  );

  for v_i in 1..v_coins_count loop
    v_contents[v_positions[v_i] + 1] := 'coin';
  end loop;
  for v_i in 1..v_pup_count loop
    v_contents[v_positions[v_coins_count + v_i] + 1] := v_powerups[v_i];
  end loop;

  return jsonb_build_object(
    'contents', to_jsonb(v_contents),
    'powerups', to_jsonb(v_powerups)
  );
end $$;

-- _create_game: rimuovo scalpello dal pool + popolo hits_needed random per ogni brick
drop function if exists public._create_game(text, text, text, text, text, text) cascade;
create function public._create_game(
  p1_id text, p1_nick text, p1_skin text,
  p2_id text, p2_nick text, p2_skin text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool text[] := ARRAY[
    'pistola','dinamite','raggi-x','scudo','quadrifoglio','x2-coins',
    'gabbia','doppia-gabbia','fantasma'
  ];
  v_gen jsonb;
  v_powerups text[];
  v_game_id uuid;
  v_i int;
  v_now timestamptz := now();
begin
  v_gen := public._generate_wall(v_pool);
  v_powerups := array(select jsonb_array_elements_text(v_gen->'powerups'));

  insert into public.games(
    player1_id, player1_nick, player1_skin,
    player2_id, player2_nick, player2_skin,
    wall, powerups,
    started_at, playing_from, ends_at
  ) values (
    p1_id, p1_nick, p1_skin,
    p2_id, p2_nick, p2_skin,
    v_gen, v_powerups,
    v_now, v_now + interval '3 seconds', v_now + interval '63 seconds'
  ) returning id into v_game_id;

  -- Random hits_needed 2 o 3 per ogni mattone
  for v_i in 0..24 loop
    insert into public.bricks(game_id, position, hits_needed)
      values (v_game_id, v_i, 2 + floor(random() * 2)::int);
  end loop;

  insert into public.player_states(game_id, player, client_id) values
    (v_game_id, 1, p1_id),
    (v_game_id, 2, p2_id);

  return v_game_id;
end $$;

-- request_match: non cambia interfaccia ma serve ricreare dopo cascade
drop function if exists public.request_match(text, text, text) cascade;
create function public.request_match(p_client_id text, p_nick text, p_skin text)
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

  select * into v_partner
    from public.lobby
    where client_id <> p_client_id
    order by joined_at asc
    for update skip locked
    limit 1;

  if v_partner is not null then
    delete from public.lobby where client_id in (p_client_id, v_partner.client_id);
    v_new_game := public._create_game(
      v_partner.client_id, v_partner.nick, coalesce(v_partner.skin, 'ladro'),
      p_client_id, p_nick, coalesce(p_skin, 'ladro')
    );
    return query select v_new_game;
    return;
  end if;

  insert into public.lobby(client_id, nick, skin) values (p_client_id, p_nick, p_skin)
    on conflict (client_id) do update set nick = excluded.nick, skin = excluded.skin, joined_at = now();
  return query select null::uuid;
end $$;

grant execute on function public.request_match(text, text, text) to anon, authenticated;

-- hit_brick: modello classico (vista condivisa, somma hits, ultimo che colpisce vince)
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
  v_just_broken boolean := false;
  v_outcome     text;
  v_content     text;
  v_effects     jsonb;
  v_other_eff   jsonb;
  v_eff         jsonb;
  v_kept        jsonb := '[]'::jsonb;
  v_has_shield  boolean := false;
  v_has_x2      boolean := false;
  v_coin_value  int := 1;
  v_blast_pos   int := null;
  v_blast_content text;
  v_neighbors   int[];
  v_adj         int;
  v_revealed    jsonb := '[]'::jsonb;
  v_xray_pos    int[];
  v_new_cooldown timestamptz;
  v_total_broken int;
  v_in_overtime boolean := false;
  v_overtime_winner boolean := false;
  v_new_streak  int;
  v_streak_bonus int := 0;
  v_streak_completed boolean := false;
  v_total_hits  int;
begin
  if p_position is null or p_position < 0 or p_position > 24 then
    return jsonb_build_object('ok', false, 'error', 'invalid_position');
  end if;

  select * into v_game from public.games
    where (player1_id = p_client_id or player2_id = p_client_id)
      and status = 'playing'
    order by started_at desc
    limit 1;
  if v_game.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_active_game');
  end if;

  -- Pre-game countdown
  if v_game.playing_from is not null and v_now < v_game.playing_from then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;

  -- Post-timer: overtime sudden death o finished
  if v_now > v_game.ends_at then
    if v_game.overtime_until is null then
      if v_game.player1_coins = v_game.player2_coins then
        update public.games
          set overtime_until = v_now + interval '15 seconds'
          where id = v_game.id;
        select * into v_game from public.games where id = v_game.id;
        v_in_overtime := true;
      else
        update public.games set status = 'finished' where id = v_game.id;
        return jsonb_build_object('ok', false, 'error', 'finished');
      end if;
    elsif v_now <= v_game.overtime_until then
      v_in_overtime := true;
    else
      update public.games set status = 'finished' where id = v_game.id;
      return jsonb_build_object('ok', false, 'error', 'finished');
    end if;
  end if;

  v_player := case when v_game.player1_id = p_client_id then 1 else 2 end;
  v_other  := 3 - v_player;

  select * into v_state       from public.player_states where game_id = v_game.id and player = v_player for update;
  select * into v_other_state from public.player_states where game_id = v_game.id and player = v_other  for update;

  -- Cooldown 1s
  if v_state.last_hit_at is not null and v_now - v_state.last_hit_at < interval '0.9 seconds' then
    return jsonb_build_object('ok', false, 'error', 'cooldown');
  end if;
  if v_state.shots_remaining <= 0 then
    return jsonb_build_object('ok', false, 'error', 'no_shots');
  end if;

  -- Effetti che modificano il colpo: solo pistola ora (scalpello rimosso dal pool)
  v_effects := v_state.active_effects;
  v_kept := '[]'::jsonb;
  for v_eff in select * from jsonb_array_elements(v_effects) loop
    if (v_eff->>'type') = 'pistola' and coalesce((v_eff->>'shots_left')::int, 0) > 0 then
      v_one_shot := true;
      if (v_eff->>'shots_left')::int - 1 > 0 then
        v_kept := v_kept || jsonb_build_object('type','pistola','shots_left', (v_eff->>'shots_left')::int - 1);
      end if;
    else
      v_kept := v_kept || v_eff;
    end if;
  end loop;
  v_effects := v_kept;

  -- x2-coins attivo?
  v_has_x2 := exists (
    select 1 from jsonb_array_elements(v_effects) e
    where e->>'type' = 'x2-coins'
      and (e->>'expires_at')::timestamptz > v_now
  );
  v_coin_value := case when v_has_x2 then 2 else 1 end;

  -- Carico mattone (lock)
  select * into v_brick from public.bricks where game_id = v_game.id and position = p_position for update;

  -- Mattone già rotto: il colpo si "perde" (cooldown + shot consumati)
  if v_brick.broken then
    update public.player_states
      set last_hit_at = v_now,
          shots_remaining = greatest(0, shots_remaining - 1),
          active_effects = v_effects
      where game_id = v_game.id and player = v_player;
    return jsonb_build_object('ok', true, 'broken_already', true, 'streak', v_state.streak);
  end if;

  -- Determino la soglia effettiva: pistola → 1, altrimenti hits_needed del mattone (default 2)
  v_hits_needed := coalesce(v_brick.hits_needed, 2);
  if v_one_shot then v_hits_needed := 1; end if;

  -- Incremento hits del lato del giocatore (front=P1, back=P2)
  if v_player = 1 then
    v_brick.front_hits := v_brick.front_hits + 1;
  else
    v_brick.back_hits := v_brick.back_hits + 1;
  end if;
  v_total_hits := v_brick.front_hits + v_brick.back_hits;

  -- Mattone si rompe?
  if v_total_hits >= v_hits_needed then
    v_just_broken := true;
    v_brick.broken := true;
    v_brick.taken_by := v_player;
    v_content := v_game.wall->'contents'->>p_position;
    v_brick.revealed_content := v_content;
    v_outcome := 'won';

    -- Applico contenuto
    if v_content = 'coin' then
      if v_player = 1 then
        update public.games set player1_coins = player1_coins + v_coin_value where id = v_game.id;
      else
        update public.games set player2_coins = player2_coins + v_coin_value where id = v_game.id;
      end if;
    elsif v_content = 'x2-coins' then
      v_effects := v_effects || jsonb_build_object(
        'type','x2-coins',
        'expires_at', to_jsonb((v_now + interval '6 seconds')::text)
      );
    elsif v_content = 'pistola' then
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
          where game_id = v_game.id and not broken and position <> p_position
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
        where b.game_id = v_game.id and b.position = any(v_neighbors) and not b.broken
        order by random() limit 1;

      if v_adj is not null then
        v_blast_pos := v_adj;
        v_blast_content := v_game.wall->'contents'->>v_adj;
        update public.bricks
          set broken           = true,
              taken_by         = v_player,
              revealed_content = v_blast_content,
              front_hits       = case when v_player = 1 then greatest(front_hits, hits_needed) else front_hits end,
              back_hits        = case when v_player = 2 then greatest(back_hits,  hits_needed) else back_hits  end
          where game_id = v_game.id and position = v_adj;
        if v_blast_content = 'coin' then
          if v_player = 1 then
            update public.games set player1_coins = player1_coins + v_coin_value where id = v_game.id;
          else
            update public.games set player2_coins = player2_coins + v_coin_value where id = v_game.id;
          end if;
        end if;
      end if;
    elsif v_content in ('gabbia','doppia-gabbia') then
      v_has_shield := exists (
        select 1 from jsonb_array_elements(v_effects) e where e->>'type' = 'scudo'
      );
      if v_has_shield then
        -- Consumo uno scudo
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
        if v_content = 'gabbia' then
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

    -- Overtime: rompere un mattone con contenuto utile = vittoria
    if v_in_overtime and v_content is not null and v_content <> 'empty' then
      v_overtime_winner := true;
    end if;

    -- Combo Streak: 3 mattoni di fila con contenuto utile → +1 moneta bonus
    if v_content is not null and v_content <> 'empty' then
      v_new_streak := v_state.streak + 1;
      if v_new_streak >= 3 then
        v_streak_bonus := v_coin_value;
        if v_player = 1 then
          update public.games set player1_coins = player1_coins + v_streak_bonus where id = v_game.id;
        else
          update public.games set player2_coins = player2_coins + v_streak_bonus where id = v_game.id;
        end if;
        v_new_streak := 0;
        v_streak_completed := true;
      end if;
    else
      v_new_streak := 0;
    end if;
  else
    -- Solo crepa, mattone non rotto: streak invariata
    v_new_streak := v_state.streak;
  end if;

  -- Persistenza brick
  update public.bricks
    set front_hits       = v_brick.front_hits,
        back_hits        = v_brick.back_hits,
        broken           = v_brick.broken,
        taken_by         = v_brick.taken_by,
        revealed_content = v_brick.revealed_content,
        front_broken_at  = case when v_brick.broken and v_player = 1 then v_now else v_brick.front_broken_at end,
        back_broken_at   = case when v_brick.broken and v_player = 2 then v_now else v_brick.back_broken_at end
    where game_id = v_game.id and position = p_position;

  if v_new_cooldown is null then v_new_cooldown := v_now; end if;
  update public.player_states
    set last_hit_at     = v_new_cooldown,
        shots_remaining = greatest(0, shots_remaining - 1),
        active_effects  = v_effects,
        streak          = v_new_streak
    where game_id = v_game.id and player = v_player;

  if v_overtime_winner then
    update public.games set status = 'finished' where id = v_game.id;
  end if;

  -- Fine partita anticipata: tutti i 25 mattoni rotti
  select count(*) into v_total_broken
    from public.bricks
    where game_id = v_game.id and broken = true;
  if v_total_broken >= 25 then
    update public.games set status = 'finished' where id = v_game.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'just_broken', v_just_broken,
    'outcome', v_outcome,
    'content', case when v_just_broken then v_content else null end,
    'blast_position', v_blast_pos,
    'xray', v_revealed,
    'streak', v_new_streak,
    'streak_completed', v_streak_completed,
    'in_overtime', v_in_overtime,
    'overtime_winner', v_overtime_winner
  );
end $$;

grant execute on function public.hit_brick(text, int) to anon, authenticated;
