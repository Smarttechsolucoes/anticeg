-- S1 — EXCLUSÃO SEGURA E ATÔMICA DA MASTERLIST (o sync deixa de apagar direto)
-- Problema: o sync (scripts/sync-masterlist.js, service_role) apagava da masterlist toda linha ausente da planilha, inclusive linhas criadas pelo site
-- (slots 'disponivel', ceg 'CLAIM'), linhas com claim ativo e linhas já pagas.
-- O que este script cria (ADITIVO: nenhuma linha, COG, pedido ou claim existente é alterado):
--   1) public.masterlist_exclusoes — arquivo de tudo que for apagado (foto completa da linha, com o id original, para poder restaurar).
--   2) public.prune_masterlist(p_ids, p_linhas_planilha, p_limite) — a ÚNICA porta de exclusão do sync. Em UMA transação ela:
--        • recusa se a planilha veio vazia/parcial (menos de 50% das linhas do banco);
--        • separa as linhas PROTEGIDAS e nunca as apaga: claim não rejeitado, ceg 'CLAIM', cog 'disponivel', na_loja, qualquer pago_* marcado, multa registrada;
--        • aplica um LIMITE por execução (no máximo 25 e nunca mais que 5% da tabela, mínimo 10): se houver mais candidatas que o limite, NÃO apaga nenhuma;
--        • arquiva e apaga o restante e devolve um relatório (sem nomes de joiners).
--   3) gatilho trg_masterlist_protege_claims — segunda camada, vale para QUALQUER chamador (inclusive service_role): linha com claim não rejeitado não pode ser apagada.
-- Execução da função: somente service_role. Nada muda para o site nem para a planilha.
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'S1') then raise exception 'S1 já foi aplicado. Nada foi alterado.'; end if;
  if to_regclass('public.masterlist') is null or to_regclass('public.claims') is null or to_regclass('public.multas_pagas') is null then
    raise exception 'Faltam masterlist, claims ou multas_pagas. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'public.claims'::regclass and attname = 'masterlist_id' and not attisdropped) then
    raise exception 'claims.masterlist_id não existe. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then raise exception 'service_role não existe. Nada foi alterado.'; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'prune_masterlist') then
    raise exception 'public.prune_masterlist já existe. Nada foi alterado.';
  end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('S1', 'linhas da masterlist', (select count(*)::text from public.masterlist)),
  ('S1', 'linhas de claims', (select count(*)::text from public.claims)),
  ('S1', 'gatilhos da masterlist', (select coalesce(string_agg(tgname, ', ' order by tgname), '(nenhum)') from pg_trigger where tgrelid = 'public.masterlist'::regclass and not tgisinternal));

create table public.masterlist_exclusoes (
  id           bigint generated always as identity primary key,
  excluido_em  timestamptz not null default now(),
  masterlist_id bigint not null,
  dados        jsonb not null,
  origem       text not null default 'sync'
);
alter table public.masterlist_exclusoes enable row level security;
revoke all on table public.masterlist_exclusoes from public, anon, authenticated;
grant select, insert on table public.masterlist_exclusoes to service_role;

-- Por que uma linha NÃO pode ser apagada (vazio = livre para apagar)
create function public.masterlist_motivos_protecao(p_id bigint)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when exists (select 1 from public.claims c where c.masterlist_id = m.id and coalesce(c.status, '') <> 'rejeitado') then 'claim_ativo' end,
    case when m.ceg = 'CLAIM' then 'origem_site_claim' end,
    case when lower(coalesce(m.cog, '')) = 'disponivel' then 'origem_site_disponivel' end,
    case when m.na_loja is true then 'na_loja' end,
    case when m.pago_item is true or m.pago_frete is true or m.pago_rf is true then 'pagamento_registrado' end,
    case when exists (select 1 from public.multas_pagas mp where mp.masterlist_id = m.id) then 'multa_registrada' end
  ], null)
  from public.masterlist m where m.id = p_id
$$;
revoke all on function public.masterlist_motivos_protecao(bigint) from public, anon, authenticated;
grant execute on function public.masterlist_motivos_protecao(bigint) to service_role;

create function public.prune_masterlist(p_ids bigint[], p_linhas_planilha integer, p_limite integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_total integer; v_limite integer; v_ids bigint[]; v_protegidas jsonb := '{}'::jsonb; v_prot_ids bigint[] := '{}'; v_livres bigint[] := '{}';
  r record; v_motivos text[]; m text; v_apagadas integer := 0;
begin
  if p_ids is null or p_linhas_planilha is null then
    return jsonb_build_object('abortado', true, 'motivo', 'parametros_ausentes', 'apagadas', 0);
  end if;
  select count(*) into v_total from public.masterlist;
  if p_linhas_planilha < 1 or p_linhas_planilha < v_total * 0.5 then
    return jsonb_build_object('abortado', true, 'motivo', 'planilha_parcial', 'linhas_planilha', p_linhas_planilha, 'linhas_banco', v_total, 'apagadas', 0);
  end if;
  v_limite := greatest(1, least(coalesce(p_limite, 25), 25, greatest(10, floor(v_total * 0.05)::integer)));
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_ids) x where x is not null;

  -- trava as linhas candidatas durante a decisão (ninguém troca o estado delas no meio)
  for r in select id from public.masterlist where id = any (v_ids) order by id for update loop
    v_motivos := public.masterlist_motivos_protecao(r.id);
    if coalesce(array_length(v_motivos, 1), 0) > 0 then
      v_prot_ids := v_prot_ids || r.id;
      foreach m in array v_motivos loop v_protegidas := jsonb_set(v_protegidas, array[m], to_jsonb(coalesce((v_protegidas ->> m)::int, 0) + 1)); end loop;
    else
      v_livres := v_livres || r.id;
    end if;
  end loop;

  if coalesce(array_length(v_livres, 1), 0) > v_limite then
    return jsonb_build_object('abortado', true, 'motivo', 'limite_excedido', 'candidatas_livres', array_length(v_livres, 1), 'limite', v_limite,
                              'protegidas', coalesce(array_length(v_prot_ids, 1), 0), 'por_motivo', v_protegidas, 'apagadas', 0);
  end if;

  if coalesce(array_length(v_livres, 1), 0) > 0 then
    insert into public.masterlist_exclusoes (masterlist_id, dados) select id, to_jsonb(ml) from public.masterlist ml where id = any (v_livres);
    delete from public.masterlist where id = any (v_livres);
    get diagnostics v_apagadas = row_count;
  end if;
  return jsonb_build_object('abortado', false, 'apagadas', v_apagadas, 'protegidas', coalesce(array_length(v_prot_ids, 1), 0), 'por_motivo', v_protegidas, 'limite', v_limite);
end $$;
revoke all on function public.prune_masterlist(bigint[], integer, integer) from public, anon, authenticated;
grant execute on function public.prune_masterlist(bigint[], integer, integer) to service_role;

-- segunda camada: nenhuma linha com claim não rejeitado some, por nenhuma via
create function public.trg_masterlist_protege_claims() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.claims c where c.masterlist_id = old.id and coalesce(c.status, '') <> 'rejeitado') then
    raise exception 'Linha % da masterlist tem claim ativo e não pode ser apagada. Rejeite ou resolva o claim antes.', old.id using errcode = '23503';
  end if;
  return old;
end $$;
revoke all on function public.trg_masterlist_protege_claims() from public, anon, authenticated;
create trigger trg_masterlist_protege_claims before delete on public.masterlist for each row execute function public.trg_masterlist_protege_claims();

-- verificação interna: nada foi apagado/alterado e as portas estão fechadas
do $$
declare a bigint; b bigint;
begin
  select (select count(*) from public.masterlist), (select count(*) from public.claims) into a, b;
  if a <> (select detalhe::bigint from emergencia.c0b_estado_anterior where etapa = 'S1' and objeto = 'linhas da masterlist')
     or b <> (select detalhe::bigint from emergencia.c0b_estado_anterior where etapa = 'S1' and objeto = 'linhas de claims') then
    raise exception 'Contagem mudou durante o S1. Revertendo.';
  end if;
  if has_function_privilege('anon', 'public.prune_masterlist(bigint[],integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.prune_masterlist(bigint[],integer,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.prune_masterlist(bigint[],integer,integer)', 'execute') then
    raise exception 'Permissões da função prune_masterlist incorretas. Revertendo.';
  end if;
  if has_table_privilege('anon', 'public.masterlist_exclusoes', 'select') or has_table_privilege('authenticated', 'public.masterlist_exclusoes', 'select') then
    raise exception 'O arquivo de exclusões ficou legível por visitantes. Revertendo.';
  end if;
end $$;

commit;
select 'S1 aplicado' as resultado;
