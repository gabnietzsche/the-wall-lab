-- Migration 002 — Doppio muro
--
-- Modello aggiornato (richiesta utente):
-- - Ogni giocatore vede SOLO i propri colpi sul proprio lato del mattone
-- - Chi rompe il proprio lato per primo prende il contenuto al centro
-- - Se entrambi rompono il proprio lato entro 300ms (collision window),
--   il contenuto è perso e viene fatto rollback dei premi facili
--   (monete + bonus self-add: pistola/scudo/raggi-x/scalpello)
-- - Dinamite/quadrifoglio/fantasma: una volta applicati restano (best-effort)
--
-- Inoltre la partita finisce subito quando TUTTI i mattoni hanno
-- entrambi i lati rotti, senza aspettare il timer.

-- =========================================================================
-- Schema: aggiungo timestamp per lato
-- =========================================================================
alter table public.bricks
  add column if not exists front_broken_at timestamptz,
  add column if not exists back_broken_at  timestamptz;

-- =========================================================================
-- hit_brick — riscritta per il modello doppio muro
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
  v_outcome     text;        -- 'won' | 'lost' | 'opp_taken' | null
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

  -- Carico partita attiva
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

  -- Stati giocatori
  select * into v_state       from public.player_states where game_id = v_game.id and player = v_player for update;
  select * into v_other_state from public.player_states where game_id = v_game.id and player = v_other  for update;

  -- Cooldown 2s
  if v_state.last_hit_at is not null and v_now - v_state.last_hit_at < interval '1.8 seconds' then
    return jsonb_build_object('ok', false, 'error', 'cooldown');
  end if;
  if v_state.shots_remaining <= 0 then
    return jsonb_build_object('ok', false, 'error', 'no_shots');
  end if;

  -- Effetti che modificano il colpo corrente (pistola = 1 hit, scalpello = 3 hits)
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

  -- Carico mattone (lock)
  select * into v_brick from public.bricks where game_id = v_game.id and position = p_position for update;

  -- Se il MIO lato è già rotto, colpo perso (cooldown + colpo consumato)
  if (v_player = 1 and v_brick.front_broken_at is not null) or
     (v_player = 2 and v_brick.back_broken_at  is not null) then
    update public.player_states
      set last_hit_at = v_now,
          shots_remaining = greatest(0, shots_remaining - 1),
          active_effects = v_effects
      where game_id = v_game.id and player = v_player;
    return jsonb_build_object('ok', true, 'my_side_broken_already', true);
  end if;

  -- Incremento i miei hits del mio lato
  if v_player = 1 then
    v_brick.front_hits := v_brick.front_hits + 1;
    v_my_hits := v_brick.front_hits;
  else
    v_brick.back_hits := v_brick.back_hits + 1;
    v_my_hits := v_brick.back_hits;
  end if;

  -- Si rompe il mio lato?
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
      -- L'avversario aveva già rotto il SUO lato
      if v_now - v_other_broken_at < (v_window_ms || ' milliseconds')::interval then
        -- COLLISIONE: premio perso
        v_outcome := 'lost';
        v_brick.taken_by := 0;

        -- Rollback monete sull'avversario
        if v_content = 'coin' then
          if v_other = 1 then
            update public.games set player1_coins = greatest(0, player1_coins - 1) where id = v_game.id;
          else
            update public.games set player2_coins = greatest(0, player2_coins - 1) where id = v_game.id;
          end if;
        end if;

        -- Rollback bonus self-add (rimuovo solo UNA occorrenza, la più recente, dall'avversario)
        if v_content in ('pistola','scudo','raggi-x','scalpello') then
          -- jsonb_path_exists/array_remove non sono diretti su jsonb array; uso un trick:
          -- prendo le entries, rimuovo solo la prima (last-added per nostra convenzione = last element)
          -- visto che gli array crescono con `||`, l'ultima entry è la più recente.
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
        -- Dinamite/quadrifoglio/fantasma: lascio applicati (limite documentato)
      else
        -- L'altro l'ha preso più di window_ms fa: già acquisito
        v_outcome := 'opp_taken';
        -- taken_by resta quello dell'altro, revealed_content è già valorizzato
      end if;
    else
      -- L'altro lato è ancora intatto → PRENDO IL CONTENUTO
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
          -- Posizioni in cui il MIO lato non è ancora rotto
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
          -- Adiacenti sulla griglia 5x5
          select coalesce(array_agg(n), '{}') into v_neighbors
            from unnest(ARRAY[
              case when (p_position % 5) > 0 then p_position - 1 end,
              case when (p_position % 5) < 4 then p_position + 1 end,
              case when p_position >= 5  then p_position - 5 end,
              case when p_position < 20  then p_position + 5 end
            ]) n where n is not null;

          -- Scelgo un adiacente in cui il MIO lato non sia ancora rotto
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
            -- Rompo il MIO lato del mattone adiacente, prendo il contenuto se nessuno l'aveva ancora preso
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
            -- Moneta solo se sono il primo a prendere il contenuto dell'adiacente
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
          -- Lo scudo consuma SOLO UNA istanza
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

  -- Persistenza del mattone
  update public.bricks
    set front_hits       = v_brick.front_hits,
        back_hits        = v_brick.back_hits,
        front_broken_at  = v_brick.front_broken_at,
        back_broken_at   = v_brick.back_broken_at,
        taken_by         = v_brick.taken_by,
        revealed_content = v_brick.revealed_content,
        broken           = (v_brick.front_broken_at is not null and v_brick.back_broken_at is not null)
    where game_id = v_game.id and position = p_position;

  -- Cooldown ed effetti
  if v_new_cooldown is null then v_new_cooldown := v_now; end if;
  update public.player_states
    set last_hit_at     = v_new_cooldown,
        shots_remaining = greatest(0, shots_remaining - 1),
        active_effects  = v_effects
    where game_id = v_game.id and player = v_player;

  -- Fine partita anticipata: tutti i mattoni con entrambi i lati rotti
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
