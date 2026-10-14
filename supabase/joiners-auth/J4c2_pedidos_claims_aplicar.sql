-- J4c-2 — CLAIMS, REPORTS E SOLICITAÇÕES DE ENVIO PROTEGIDOS PELO BANCO: claims, reports, envio_solicitacoes
-- Hoje qualquer visitante lê (e altera) claims (nome, e-mail), reports e solicitações de envio (CPF, endereço completo, rastreio) de TODAS as joiners. Depois deste passo:
--   claims              : joiner lê só os próprios; cria o próprio claim (nasce 'pendente'); só consegue DESFAZER o próprio claim pendente (rejeitar/apagar); aprovar é da administradora.
--                         O quadro público de claims e a lista de "vendidos" continuam existindo por visões que NÃO trazem e-mail, COG nem nome real (claims_quadro, claims_vendidos).
--   reports             : joiner lê/cria/edita só os próprios; não consegue escrever a resposta da administradora nem marcar como resolvido (só reabrir).
--   envio_solicitacoes  : joiner lê/cria só as próprias (nasce 'solicitação de envio', sem cotação nem rastreio); depois só escolhe a modalidade, anexa o comprovante e cancela.
--                         Cotação, rastreio e status de andamento: só administradora (ou o servidor).
-- Nada de dado é alterado/apagado; as permissões do visitante saem e NENHUMA é copiada para a conta logada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (VITE_JOINERS_AUTH ligado) e depois do J1, J4-0, J4a e J4b. O site de hoje depende do acesso de visitante.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; t text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-2') then raise exception 'J4c-2 já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  foreach t in array array['claims', 'reports', 'envio_solicitacoes', 'joiners'] loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
  end loop;
  select count(*) into n from pg_attribute where attrelid = 'public.claims'::regclass and not attisdropped and attname in ('id', 'joiner_cog', 'joiner_nome', 'masterlist_id', 'ceg', 'nome_do_item', 'valor', 'status', 'created_at');
  if n <> 9 then raise exception 'claims sem as colunas esperadas (achei % de 9). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.reports'::regclass and not attisdropped and attname in ('id', 'joiner_cog', 'status', 'resposta');
  if n <> 4 then raise exception 'reports sem as colunas esperadas. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.envio_solicitacoes'::regclass and not attisdropped and attname in ('id', 'joiner_cog', 'status', 'modalidade_escolhida', 'comprovante_url');
  if n <> 5 then raise exception 'envio_solicitacoes sem as colunas esperadas. Nada foi alterado.'; end if;
  if to_regclass('public.claims_quadro') is not null or to_regclass('public.claims_vendidos') is not null then raise exception 'As visões de claims já existem. Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-2', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('claims', 'reports', 'envio_solicitacoes');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-2', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.oid in ('public.claims'::regclass, 'public.reports'::regclass, 'public.envio_solicitacoes'::regclass);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-2', 'impressão ' || t, f from (
  select 'claims' as t, 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(status, ''), ',' order by id), '')) as f from public.claims
  union all select 'reports', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(status, ''), ',' order by id), '')) from public.reports
  union all select 'envio_solicitacoes', 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || coalesce(status, ''), ',' order by id), '')) from public.envio_solicitacoes) x;

-- 1) RLS ligado e fora TODAS as policies antigas
alter table public.claims enable row level security;
alter table public.reports enable row level security;
alter table public.envio_solicitacoes enable row level security;
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('claims', 'reports', 'envio_solicitacoes') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) visitante: nenhuma permissão. Conta logada: as policies decidem as LINHAS; os gatilhos (abaixo) decidem os CAMPOS.
revoke all on table public.claims, public.reports, public.envio_solicitacoes from anon, public;
grant select, insert, update, delete on table public.claims to authenticated;
grant select, insert, update on table public.reports, public.envio_solicitacoes to authenticated;

-- 3) visões públicas do quadro de claims (sem e-mail, sem COG, sem nome real: só o nome público da joiner)
create view public.claims_quadro as
  select c.masterlist_id, coalesce(nullif(j.nome_site, ''), c.joiner_cog) as joiner_nome, c.status, c.created_at
    from public.claims c left join public.joiners j on lower(trim(j.cog)) = lower(trim(c.joiner_cog))
   where c.ceg = 'CLAIM' and coalesce(c.status, '') <> 'rejeitado';
create view public.claims_vendidos as
  select c.id, c.ceg, c.nome_do_item, c.valor, c.created_at from public.claims c where c.status = 'aprovado';
revoke all on public.claims_quadro, public.claims_vendidos from public, anon, authenticated;
grant select on public.claims_quadro, public.claims_vendidos to anon, authenticated, service_role;

-- 4) policies
create policy admin_tudo on public.claims for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprios on public.claims for select to authenticated using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))));
create policy joiner_cria_proprio on public.claims for insert to authenticated
  with check (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))) and status = 'pendente');
create policy joiner_desfaz_proprio on public.claims for update to authenticated
  using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))) and status = 'pendente')
  with check (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))) and status = 'rejeitado');
create policy joiner_apaga_proprio_pendente on public.claims for delete to authenticated
  using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))) and status = 'pendente');

create policy admin_tudo on public.reports for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprios on public.reports for select to authenticated using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))));
create policy joiner_cria_proprio on public.reports for insert to authenticated
  with check (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))) and coalesce(status, 'pendente') = 'pendente' and resposta is null);
create policy joiner_edita_proprio on public.reports for update to authenticated
  using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog())))) with check (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))));

create policy admin_tudo on public.envio_solicitacoes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprias on public.envio_solicitacoes for select to authenticated using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))));
create policy joiner_cria_propria on public.envio_solicitacoes for insert to authenticated
  with check (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))) and status = 'solicitação de envio');
create policy joiner_edita_propria on public.envio_solicitacoes for update to authenticated
  using (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog())))) with check (lower(trim(joiner_cog)) = lower(trim((select public.meu_cog()))));

-- 5) gatilhos de campos (para quem NÃO é administradora; o servidor, sem auth.uid(), segue livre)
create function public.trg_reports_protege() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.id is distinct from old.id or new.joiner_cog is distinct from old.joiner_cog or new.created_at is distinct from old.created_at then
    raise exception 'Alteração não permitida neste report.' using errcode = '42501';
  end if;
  if new.resposta is distinct from old.resposta then raise exception 'Alteração não permitida: a resposta é da administradora.' using errcode = '42501'; end if;
  if new.status is distinct from old.status and coalesce(new.status, '') <> 'pendente' then raise exception 'Alteração não permitida: só a administradora resolve o report.' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.trg_reports_protege() from public, anon, authenticated;
create trigger trg_reports_protege before update on public.reports for each row execute function public.trg_reports_protege();

create function public.trg_envio_protege() returns trigger language plpgsql security definer set search_path = '' as $$
declare livres_insert text[] := array['id', 'created_at', 'joiner_cog', 'joiner_nome', 'joiner_handle', 'destinatario', 'cpf', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'itens', 'metodo', 'seguro', 'valor_seguro', 'status', 'storage_selecionados', 'grupo_envio_codigo'];
        livres_update text[] := array['status', 'modalidade_escolhida', 'comprovante_url'];
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if jsonb_strip_nulls(to_jsonb(new) - livres_insert) <> '{}'::jsonb then
      raise exception 'Alteração não permitida: cotação, rastreio e andamento são da administradora.' using errcode = '42501';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - livres_update) is distinct from (to_jsonb(old) - livres_update) then
    raise exception 'Alteração não permitida: cotação, rastreio e dados do pedido são da administradora.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status not in ('pagamento em aberto', 'cancelado') then
    raise exception 'Alteração não permitida: esse andamento é da administradora.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.trg_envio_protege() from public, anon, authenticated;
create trigger trg_envio_protege_ins before insert on public.envio_solicitacoes for each row execute function public.trg_envio_protege();
create trigger trg_envio_protege_upd before update on public.envio_solicitacoes for each row execute function public.trg_envio_protege();

-- 6) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from (values ('public.claims'), ('public.reports'), ('public.envio_solicitacoes')) x(nome)
   where has_table_privilege('anon', x.nome, 'SELECT') or has_table_privilege('anon', x.nome, 'INSERT') or has_table_privilege('anon', x.nome, 'UPDATE') or has_table_privilege('anon', x.nome, 'DELETE')
      or has_any_column_privilege('anon', x.nome, 'SELECT') or has_any_column_privilege('anon', x.nome, 'UPDATE') or has_any_column_privilege('anon', x.nome, 'INSERT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em alguma das 3 tabelas. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('claims', 'reports', 'envio_solicitacoes') and ('anon' = any(roles) or 'public' = any(roles));
  if n > 0 then raise exception 'Sobrou policy para visitante ou PUBLIC. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('claims', 'reports', 'envio_solicitacoes');
  if n <> 13 then raise exception 'Esperava 13 policies novas e há %. Transação desfeita.', n; end if;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name in ('claims_quadro', 'claims_vendidos') and column_name ~* '(email|joiner_cog|cpf)';
  if n > 0 then raise exception 'Uma visão pública de claims expõe e-mail/COG. Transação desfeita.'; end if;
  for t in select unnest(array['claims', 'reports', 'envio_solicitacoes']) loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-2' and objeto = 'impressão ' || t;
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id), '''')) from public.%I', t) into v_d;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
