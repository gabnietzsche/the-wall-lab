-- Migration 007 — Clock sync RPC
--
-- Il countdown 3-2-1 può sembrare desincronizzato tra i due giocatori se i
-- loro device hanno clock di sistema sfasati. Questa RPC permette al client
-- di calcolare l'offset rispetto al server (Date.now() vs server.now()).

create or replace function public.get_server_now()
returns bigint
language sql
stable
as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$;

grant execute on function public.get_server_now() to anon, authenticated;
