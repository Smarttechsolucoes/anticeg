-- J1 (v2) — CONTAS DAS JOINERS: vínculo seguro entre uma conta do Supabase Auth e uma joiner existente, pelo IDENTIFICADOR PERMANENTE (joiners.id)
-- ADITIVO: não altera a tabela joiners nem nenhuma outra tabela do site; ninguém perde COG, claim, pedido ou pagamento.
-- O vínculo é por joiners.id (nunca muda). O COG é só um rótulo que pode mudar ou ter variações de maiúscula: meu_cog() devolve sempre o COG ATUAL da joiner vinculada.
-- Regras do vínculo (ativar_minha_conta):
--   * só vale para conta COM E-MAIL CONFIRMADO (a pessoa provou que controla o endereço);
--   * o e-mail confirmado precisa ser IGUAL ao e-mail cadastrado da joiner, e ser único entre as joiners;
--   * saber o @ ou o COG NÃO basta; e-mail ausente, inválido, diferente, compartilhado, COG repetido ou joiner já vinculada => não vincula;
--     esses casos viram um pedido em vinculos_pendentes para o administrador resolver (escolhendo a joiner exata pelo id), sem acesso automático;
--   * a resposta ao usuário é sempre a mesma nas falhas (sem enumerar @ nem e-mails).
-- Nada aqui fecha a leitura atual dos dados: isso é a etapa de RLS (J4), depois que o login estiver no ar.
-- Tudo em uma transação com registro e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
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
declare n integer; v_nulos integer; v_dup integer;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J1') then
    raise exception 'J1 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regclass('auth.users') is null then raise exception 'auth.users não existe. Nada foi alterado.'; end if;
  if to_regclass('public.joiners') is null then raise exception 'public.joiners não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.joiners'::regclass and attname in ('id', 'cog', 'email') and not attisdropped;
  if n <> 3 then raise exception 'Esperava as colunas id, cog e email em public.joiners. Nada foi alterado.'; end if;
  -- o identificador permanente precisa ser mesmo permanente: preenchido e sem repetição
  select count(*) filter (where id is null), count(*) - count(distinct id) into v_nulos, v_dup from public.joiners;
  if v_nulos > 0 or v_dup > 0 then raise exception 'joiners.id tem % valor(es) nulo(s) e % repetido(s): não serve como identificador. Nada foi alterado.', v_nulos, v_dup; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2 não aplicados). Nada foi alterado.'; end if;
  if to_regclass('public.contas_joiner') is not null or to_regclass('public.vinculos_pendentes') is not null then
    raise exception 'contas_joiner/vinculos_pendentes já existem: revise antes. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then raise exception 'O papel service_role não existe. Nada foi alterado.'; end if;
end $$;

-- impressão de joiners ANTES (para provar que nada nela muda): só contagem e hash, sem mostrar e-mails
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J1', 'impressão de joiners',
       'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(cog, '') || '|' || coalesce(email, ''), E'\n' order by id), ''))
from public.joiners;

-- ── 1) quem é a conta de quem (pelo id permanente) ────────────────────────────────────────────
create table public.contas_joiner (
  user_id      uuid   primary key references auth.users (id) on delete cascade,
  joiner_id    bigint not null,
  vinculado_em timestamptz not null default now(),
  origem       text not null default 'email_verificado' check (origem in ('email_verificado', 'admin'))
);
create unique index contas_joiner_joiner_unico on public.contas_joiner (joiner_id);
-- se joiners.id for único por constraint, protege também contra apagar uma joiner que tem conta ligada
do $$
begin
  if exists (select 1 from pg_index i where i.indrelid = 'public.joiners'::regclass and i.indisunique and i.indnatts = 1
               and (select a.attname from pg_attribute a where a.attrelid = i.indrelid and a.attnum = i.indkey[0]) = 'id') then
    alter table public.contas_joiner add constraint contas_joiner_joiner_fk foreign key (joiner_id) references public.joiners (id) on delete restrict;
  end if;
end $$;
alter table public.contas_joiner enable row level security;
revoke all on table public.contas_joiner from public, anon, authenticated;
grant select on table public.contas_joiner to authenticated;
grant select, insert, update, delete on table public.contas_joiner to service_role;
create policy contas_joiner_propria on public.contas_joiner for select to authenticated using (user_id = (select auth.uid()));
create policy contas_joiner_admin on public.contas_joiner for select to authenticated using ((select public.is_admin()));

-- ── 2) pedidos que precisam de decisão do administrador ───────────────────────────────────────
create table public.vinculos_pendentes (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  cog_pedido          text not null,
  joiner_id_candidato bigint,                 -- preenchido quando o COG pedido corresponde a uma única joiner
  motivo              text not null check (motivo in ('cog_inexistente', 'cog_ambiguo', 'email_ausente', 'email_invalido', 'email_diferente', 'email_compartilhado', 'cog_ja_vinculado')),
  status              text not null default 'aberto' check (status in ('aberto', 'aprovado', 'recusado')),
  criado_em           timestamptz not null default now(),
  resolvido_por       uuid,
  resolvido_em        timestamptz
);
create unique index vinculos_pendentes_um_aberto on public.vinculos_pendentes (user_id) where status = 'aberto';
alter table public.vinculos_pendentes enable row level security;
revoke all on table public.vinculos_pendentes from public, anon, authenticated;
grant select on table public.vinculos_pendentes to authenticated;
grant select, insert, update, delete on table public.vinculos_pendentes to service_role;
create policy vinculos_pendentes_admin on public.vinculos_pendentes for select to authenticated using ((select public.is_admin()));

-- ── 3) o vínculo seguro ───────────────────────────────────────────────────────────────────────
create function public.ativar_minha_conta(p_cog text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text; v_confirmado timestamptz;
  v_cog text := lower(trim(both from regexp_replace(coalesce(p_cog, ''), '^\s*@+', '')));
  v_n integer; v_j record; v_motivo text; v_candidato bigint;
begin
  if v_uid is null then return jsonb_build_object('status', 'nao_autenticado'); end if;
  select lower(trim(u.email)), u.email_confirmed_at into v_email, v_confirmado from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmado is null then return jsonb_build_object('status', 'email_nao_verificado'); end if;

  if exists (select 1 from public.contas_joiner c where c.user_id = v_uid) then return jsonb_build_object('status', 'ok'); end if;

  if v_cog = '' or length(v_cog) > 64 then return jsonb_build_object('status', 'pendente'); end if;

  select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_cog;
  if v_n = 0 then v_motivo := 'cog_inexistente';
  elsif v_n > 1 then v_motivo := 'cog_ambiguo';
  else
    select * into v_j from public.joiners j where lower(trim(j.cog)) = v_cog;
    v_candidato := v_j.id;
    if coalesce(trim(v_j.email), '') = '' then v_motivo := 'email_ausente';
    elsif lower(trim(v_j.email)) !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then v_motivo := 'email_invalido';
    elsif lower(trim(v_j.email)) <> v_email then v_motivo := 'email_diferente';
    elsif (select count(*) from public.joiners j2 where lower(trim(j2.email)) = v_email) > 1 then v_motivo := 'email_compartilhado';
    elsif exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then v_motivo := 'cog_ja_vinculado';
    end if;
  end if;

  if v_motivo is null then
    begin
      insert into public.contas_joiner (user_id, joiner_id, origem) values (v_uid, v_j.id, 'email_verificado');
      return jsonb_build_object('status', 'ok');
    exception when unique_violation then
      v_motivo := 'cog_ja_vinculado';
    end;
  end if;

  insert into public.vinculos_pendentes (user_id, cog_pedido, joiner_id_candidato, motivo) values (v_uid, left(v_cog, 64), v_candidato, v_motivo)
  on conflict (user_id) where status = 'aberto'
  do update set cog_pedido = excluded.cog_pedido, joiner_id_candidato = excluded.joiner_id_candidato, motivo = excluded.motivo, criado_em = now();
  return jsonb_build_object('status', 'pendente');
end $$;
revoke all on function public.ativar_minha_conta(text) from public, anon;
grant execute on function public.ativar_minha_conta(text) to authenticated, service_role;

-- ── 4) quem sou eu: COG ATUAL e id da joiner da conta logada (base das policies de RLS do J4) ──
create function public.meu_cog()
returns text language sql stable security definer set search_path = '' as $$
  select j.cog from public.contas_joiner c join public.joiners j on j.id = c.joiner_id where c.user_id = (select auth.uid())
$$;
revoke all on function public.meu_cog() from public, anon;
grant execute on function public.meu_cog() to authenticated, service_role;

create function public.meu_joiner_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select c.joiner_id from public.contas_joiner c where c.user_id = (select auth.uid())
$$;
revoke all on function public.meu_joiner_id() from public, anon;
grant execute on function public.meu_joiner_id() to authenticated, service_role;

-- ── 5) resolução administrativa ───────────────────────────────────────────────────────────────
create function public.admin_vinculos_pendentes()
returns table (id bigint, email_da_conta text, cog_pedido text, joiner_id_candidato bigint, motivo text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'sem permissão'; end if;
  return query
    select p.id, u.email::text, p.cog_pedido, p.joiner_id_candidato, p.motivo, p.criado_em
      from public.vinculos_pendentes p join auth.users u on u.id = p.user_id
     where p.status = 'aberto' order by p.criado_em;
end $$;
revoke all on function public.admin_vinculos_pendentes() from public, anon;
grant execute on function public.admin_vinculos_pendentes() to authenticated, service_role;

-- a administradora procura a joiner certa (por COG, nome do site ou @) e vê o id para decidir os casos repetidos
create function public.admin_buscar_joiners(p_termo text)
returns table (id bigint, cog text, nome_site text, twitter text, email text, conta_vinculada boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_t text := regexp_replace(lower(trim(coalesce(p_termo, ''))), '^@+', '');
begin
  if not (select public.is_admin()) then raise exception 'sem permissão'; end if;
  if length(v_t) < 2 then return; end if;
  return query
    select j.id, j.cog::text, j.nome_site::text, j.twitter::text, j.email::text, exists (select 1 from public.contas_joiner c where c.joiner_id = j.id)
      from public.joiners j
     where lower(j.cog) like '%' || replace(replace(v_t, '%', ''), '_', '') || '%' or lower(coalesce(j.nome_site, '')) like '%' || replace(replace(v_t, '%', ''), '_', '') || '%'
        or lower(coalesce(j.twitter, '')) like '%' || replace(replace(v_t, '%', ''), '_', '') || '%'
     order by j.cog limit 20;
end $$;
revoke all on function public.admin_buscar_joiners(text) from public, anon;
grant execute on function public.admin_buscar_joiners(text) to authenticated, service_role;

create function public.admin_resolver_vinculo(p_id bigint, p_aprovar boolean, p_joiner_id bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p record; v_j record; v_n integer; v_cog text; v_uid uuid := (select auth.uid());
begin
  if not (select public.is_admin()) then raise exception 'sem permissão'; end if;
  select * into v_p from public.vinculos_pendentes where id = p_id and status = 'aberto' for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if not p_aprovar then
    update public.vinculos_pendentes set status = 'recusado', resolvido_por = v_uid, resolvido_em = now() where id = p_id;
    return jsonb_build_object('status', 'recusado');
  end if;
  if p_joiner_id is not null then
    select * into v_j from public.joiners j where j.id = p_joiner_id;
    if not found then raise exception 'joiner % não existe', p_joiner_id; end if;
  else
    -- sem id: só aceita se o COG pedido corresponder a UMA joiner
    v_cog := lower(trim(both from regexp_replace(v_p.cog_pedido, '^\s*@+', '')));
    select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_cog;
    if v_n <> 1 then raise exception 'o COG % corresponde a % joiners; informe o id da joiner (admin_buscar_joiners)', v_cog, v_n; end if;
    select * into v_j from public.joiners j where lower(trim(j.cog)) = v_cog;
  end if;
  if exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then raise exception 'a joiner % já está vinculada a outra conta', v_j.id; end if;
  if exists (select 1 from public.contas_joiner c where c.user_id = v_p.user_id) then raise exception 'esta conta já está vinculada'; end if;
  insert into public.contas_joiner (user_id, joiner_id, origem) values (v_p.user_id, v_j.id, 'admin');
  update public.vinculos_pendentes set status = 'aprovado', resolvido_por = v_uid, resolvido_em = now() where id = p_id;
  return jsonb_build_object('status', 'aprovado', 'joiner_id', v_j.id);
end $$;
revoke all on function public.admin_resolver_vinculo(bigint, boolean, bigint) from public, anon;
grant execute on function public.admin_resolver_vinculo(bigint, boolean, bigint) to authenticated, service_role;

-- desfazer um vínculo feito por engano (a joiner volta ao modo limitado; nada do cadastro ou do histórico é apagado)
create function public.admin_desvincular_conta(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not (select public.is_admin()) then raise exception 'sem permissão'; end if;
  delete from public.contas_joiner where user_id = p_user_id;
  get diagnostics n = row_count;
  return jsonb_build_object('status', case when n = 1 then 'desvinculada' else 'nao_encontrada' end);
end $$;
revoke all on function public.admin_desvincular_conta(uuid) from public, anon;
grant execute on function public.admin_desvincular_conta(uuid) to authenticated, service_role;

-- conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from (values ('public.contas_joiner'), ('public.vinculos_pendentes')) t(nome)
   where not (select relrowsecurity from pg_class where oid = t.nome::regclass);
  if n > 0 then raise exception 'RLS desligado em alguma tabela nova. Transação desfeita.'; end if;
  select count(*) into n from (values ('anon')) r(rolname), (values ('public.contas_joiner'), ('public.vinculos_pendentes')) t(nome)
   where has_table_privilege(r.rolname, t.nome, 'SELECT') or has_table_privilege(r.rolname, t.nome, 'INSERT')
      or has_table_privilege(r.rolname, t.nome, 'UPDATE') or has_table_privilege(r.rolname, t.nome, 'DELETE');
  if n > 0 then raise exception 'anon tem acesso a tabelas de contas. Transação desfeita.'; end if;
  select count(*) into n from (values ('authenticated')) r(rolname), (values ('public.contas_joiner'), ('public.vinculos_pendentes')) t(nome)
   where has_table_privilege(r.rolname, t.nome, 'INSERT') or has_table_privilege(r.rolname, t.nome, 'UPDATE') or has_table_privilege(r.rolname, t.nome, 'DELETE');
  if n > 0 then raise exception 'authenticated pode escrever direto em tabelas de contas. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.meu_cog()'::regprocedure, 'public.meu_joiner_id()'::regprocedure,
         'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure,
         'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure)
     and (not p.prosecdef or p.proconfig is distinct from array['search_path=""']);
  if n > 0 then raise exception 'Função sem security definer / search_path vazio. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.meu_cog()'::regprocedure, 'public.meu_joiner_id()'::regprocedure,
         'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_buscar_joiners(text)'::regprocedure,
         'public.admin_resolver_vinculo(bigint, boolean, bigint)'::regprocedure, 'public.admin_desvincular_conta(uuid)'::regprocedure)
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'anon pode executar funções de conta. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'J1' and objeto = 'impressão de joiners';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(cog, '') || '|' || coalesce(email, ''), E'\n' order by id), ''))
    into v_depois from public.joiners;
  if v_antes is distinct from v_depois then raise exception 'joiners mudou durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
