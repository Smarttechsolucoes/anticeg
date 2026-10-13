-- C0-B3 — MULTAS: ninguém (anon / authenticated / PUBLIC) cria, altera ou apaga multas pela API
-- * O SELECT continua aberto (o site conta as multas de cada joiner para o selo). Revisão futura: multas são dados individuais.
-- * O gatilho trg_registrar_multa_paga continua funcionando: ele insere com as permissões de quem atualiza a masterlist
--   (função SEM security definer) e, após o B1, só o service_role (sync da planilha) muda pago_*; o service_role mantém INSERT.
-- * Nenhuma linha de multas_pagas é alterada (conferido por contagem, soma e hash dentro da transação).
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;

create table if not exists emergencia.c0b_estado_anterior (
  id            bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  etapa         text not null,
  objeto        text not null,
  detalhe       text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B3') then
    raise exception 'C0-B3 já foi aplicada: o estado anterior já está registrado e não será sobrescrito.';
  end if;
  if to_regclass('public.multas_pagas') is null then raise exception 'public.multas_pagas não existe. Nada foi alterado.'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.multas_pagas'::regclass) then
    raise exception 'RLS desligado em multas_pagas. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'O papel service_role não existe neste banco. Nada foi alterado.';
  end if;
  -- o gatilho que registra multas precisa existir e estar habilitado (é o que o service_role vai continuar acionando)
  select count(*) into n from pg_trigger t
   where t.tgrelid = 'public.masterlist'::regclass and t.tgname = 'trg_registrar_multa_paga' and not t.tgisinternal and t.tgenabled = 'O';
  if n <> 1 then raise exception 'O gatilho trg_registrar_multa_paga não está como esperado (existente e habilitado). Nada foi alterado.'; end if;
  -- a função do gatilho NÃO pode ser security definer: este script parte do princípio de que ela roda com as permissões de quem atualiza a masterlist
  if (select p.prosecdef from pg_proc p where p.oid = 'public.registrar_multa_paga'::regproc) then
    raise exception 'registrar_multa_paga() é SECURITY DEFINER (esperado: não). A análise do B3 não vale. Nada foi alterado.';
  end if;
end $$;

-- estado ANTERIOR: contagens, policies, permissões da tabela e de cada coluna que tinha permissão própria
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B3', 'impressão de multas_pagas',
       'linhas=' || count(*) || ' soma=' || coalesce(sum(valor_multa), 0) || ' md5=' ||
       md5(coalesce(string_agg(id::text || '|' || joiner_cog || '|' || masterlist_id::text || '|' || campo || '|' || dias_atraso::text || '|' || valor_multa::text, E'\n' order by id), ''))
from public.multas_pagas;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B3', 'policy ' || policyname, format('cmd=%s roles=%s using=%s check=%s permissive=%s', cmd, roles::text, coalesce(qual, 'null'), coalesce(with_check, 'null'), permissive)
from pg_policies where schemaname = 'public' and tablename = 'multas_pagas';

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B3', 'public.multas_pagas (permissões da tabela)', coalesce(c.relacl::text, '(padrão do dono)')
from pg_class c where c.oid = 'public.multas_pagas'::regclass;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B3', 'public.multas_pagas.' || a.attname || ' (permissão da coluna)', a.attacl::text
from pg_attribute a
where a.attrelid = 'public.multas_pagas'::regclass and a.attnum > 0 and not a.attisdropped and a.attacl is not null;

-- 1) a policy que deixava qualquer um inserir (with check true) sai; o SELECT fica como está
drop policy if exists "multas_pagas_insert_all" on public.multas_pagas;

-- 2) sem INSERT / UPDATE / DELETE (e sem TRUNCATE etc.) para anon, authenticated e PUBLIC: tabela inteira E cada coluna
revoke insert, update, delete, truncate, references, trigger on table public.multas_pagas from anon, authenticated, public;
do $$
declare cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into cols
    from pg_attribute where attrelid = 'public.multas_pagas'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s), references (%s) on public.multas_pagas from anon, authenticated, public', cols, cols, cols);
end $$;

-- 3) leitura continua; o service_role (sync + gatilho) mantém permissão EXPLÍCITA
grant select on table public.multas_pagas to anon, authenticated;
grant select, insert, update, delete on table public.multas_pagas to service_role;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_linhas text; v_antes text; v_depois text;
begin
  select count(*) into n from (values ('anon'), ('authenticated')) as r(rolname)
   where has_table_privilege(r.rolname, 'public.multas_pagas', 'INSERT')
      or has_table_privilege(r.rolname, 'public.multas_pagas', 'UPDATE')
      or has_table_privilege(r.rolname, 'public.multas_pagas', 'DELETE')
      or has_table_privilege(r.rolname, 'public.multas_pagas', 'TRUNCATE')
      or has_any_column_privilege(r.rolname, 'public.multas_pagas', 'INSERT')
      or has_any_column_privilege(r.rolname, 'public.multas_pagas', 'UPDATE');
  if n > 0 then raise exception 'anon/authenticated ainda podem criar, alterar ou apagar multas (tabela ou coluna). Transação desfeita.'; end if;

  select count(*) into n from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'multas_pagas' and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and exists (select 1 from unnest(p.roles) r
                  where case when r = 'public' then true
                             else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end);
  if n > 0 then raise exception 'Ainda existe policy permissiva de escrita aplicável a anon/authenticated (% encontrada(s)). Transação desfeita.', n; end if;

  if not (has_table_privilege('anon', 'public.multas_pagas', 'SELECT') and has_table_privilege('authenticated', 'public.multas_pagas', 'SELECT')) then
    raise exception 'anon/authenticated perderam o SELECT (o site conta as multas do joiner). Transação desfeita.';
  end if;
  if not (has_table_privilege('service_role', 'public.multas_pagas', 'INSERT') and has_table_privilege('service_role', 'public.multas_pagas', 'UPDATE')
          and has_table_privilege('service_role', 'public.multas_pagas', 'DELETE') and has_table_privilege('service_role', 'public.multas_pagas', 'SELECT')) then
    raise exception 'service_role perdeu permissão em multas_pagas (o gatilho da sincronização quebraria). Transação desfeita.';
  end if;

  -- nenhuma multa foi tocada
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'B3' and objeto = 'impressão de multas_pagas';
  select 'linhas=' || count(*) || ' soma=' || coalesce(sum(valor_multa), 0) || ' md5=' ||
         md5(coalesce(string_agg(id::text || '|' || joiner_cog || '|' || masterlist_id::text || '|' || campo || '|' || dias_atraso::text || '|' || valor_multa::text, E'\n' order by id), ''))
    into v_depois from public.multas_pagas;
  if v_antes is distinct from v_depois then raise exception 'As multas mudaram durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
