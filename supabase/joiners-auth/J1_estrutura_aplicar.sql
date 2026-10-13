-- J1 — CONTAS DAS JOINERS: estrutura do vínculo seguro entre uma conta do Supabase Auth e uma joiner existente
-- ADITIVO: não altera a tabela joiners nem nenhuma outra tabela do site; ninguém perde COG, claim, pedido ou pagamento.
-- Regras do vínculo (ativar_minha_conta):
--   * só vale para conta COM E-MAIL CONFIRMADO (a pessoa provou que controla o endereço);
--   * o e-mail confirmado precisa ser IGUAL ao e-mail cadastrado da joiner, e ser único entre as joiners;
--   * saber o @ ou o COG NÃO basta; e-mail ausente, inválido, diferente, compartilhado, COG repetido ou já vinculado => não vincula;
--     esses casos viram um pedido em vinculos_pendentes para o administrador resolver, sem conceder acesso automático;
--   * a resposta ao usuário é sempre a mesma nos casos de falha (sem enumerar @ nem e-mails).
-- Nada aqui fecha a leitura atual dos dados: isso é a etapa de RLS, depois que o login estiver no ar.
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
declare n integer;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J1') then
    raise exception 'J1 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regclass('auth.users') is null then raise exception 'auth.users não existe. Nada foi alterado.'; end if;
  if to_regclass('public.joiners') is null then raise exception 'public.joiners não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.joiners'::regclass and attname in ('cog', 'email') and not attisdropped;
  if n <> 2 then raise exception 'Esperava as colunas cog e email em public.joiners. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2 não aplicados). Nada foi alterado.'; end if;
  if to_regclass('public.contas_joiner') is not null or to_regclass('public.vinculos_pendentes') is not null then
    raise exception 'contas_joiner/vinculos_pendentes já existem: revise antes. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then raise exception 'O papel service_role não existe. Nada foi alterado.'; end if;
end $$;

-- impressão de joiners ANTES (para provar que nada nela muda): só contagem e hash, sem mostrar e-mails
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J1', 'impressão de joiners',
       'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(coalesce(cog, '') || '|' || coalesce(email, ''), E'\n' order by cog, email), ''))
from public.joiners;

-- ── 1) quem é a conta de quem ─────────────────────────────────────────────────────────────────
create table public.contas_joiner (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  cog          text not null check (length(trim(cog)) > 0),
  vinculado_em timestamptz not null default now(),
  origem       text not null default 'email_verificado' check (origem in ('email_verificado', 'admin'))
);
create unique index contas_joiner_cog_unico on public.contas_joiner (lower(cog));
alter table public.contas_joiner enable row level security;
revoke all on table public.contas_joiner from public, anon, authenticated;
grant select on table public.contas_joiner to authenticated;
grant select, insert, update, delete on table public.contas_joiner to service_role;
create policy contas_joiner_propria on public.contas_joiner for select to authenticated using (user_id = (select auth.uid()));
create policy contas_joiner_admin on public.contas_joiner for select to authenticated using ((select public.is_admin()));

-- ── 2) pedidos que precisam de decisão do administrador ───────────────────────────────────────
create table public.vinculos_pendentes (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  cog_pedido   text not null,
  motivo       text not null check (motivo in ('cog_inexistente', 'cog_ambiguo', 'email_ausente', 'email_invalido', 'email_diferente', 'email_compartilhado', 'cog_ja_vinculado')),
  status       text not null default 'aberto' check (status in ('aberto', 'aprovado', 'recusado')),
  criado_em    timestamptz not null default now(),
  resolvido_por uuid,
  resolvido_em timestamptz
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
  v_n integer; v_j record; v_motivo text; v_existente text;
begin
  if v_uid is null then return jsonb_build_object('status', 'nao_autenticado'); end if;
  select lower(trim(u.email)), u.email_confirmed_at into v_email, v_confirmado from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmado is null then return jsonb_build_object('status', 'email_nao_verificado'); end if;

  select c.cog into v_existente from public.contas_joiner c where c.user_id = v_uid;
  if v_existente is not null then return jsonb_build_object('status', 'ok'); end if;

  if v_cog = '' or length(v_cog) > 64 then return jsonb_build_object('status', 'pendente'); end if;

  select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_cog;
  if v_n = 0 then v_motivo := 'cog_inexistente';
  elsif v_n > 1 then v_motivo := 'cog_ambiguo';
  else
    select * into v_j from public.joiners j where lower(trim(j.cog)) = v_cog;
    if coalesce(trim(v_j.email), '') = '' then v_motivo := 'email_ausente';
    elsif lower(trim(v_j.email)) !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then v_motivo := 'email_invalido';
    elsif lower(trim(v_j.email)) <> v_email then v_motivo := 'email_diferente';
    elsif (select count(*) from public.joiners j2 where lower(trim(j2.email)) = v_email) > 1 then v_motivo := 'email_compartilhado';
    elsif exists (select 1 from public.contas_joiner c where lower(c.cog) = lower(trim(v_j.cog))) then v_motivo := 'cog_ja_vinculado';
    end if;
  end if;

  if v_motivo is null then
    begin
      insert into public.contas_joiner (user_id, cog, origem) values (v_uid, trim(v_j.cog), 'email_verificado');
      return jsonb_build_object('status', 'ok');
    exception when unique_violation then
      v_motivo := 'cog_ja_vinculado';
    end;
  end if;

  insert into public.vinculos_pendentes (user_id, cog_pedido, motivo) values (v_uid, left(v_cog, 64), v_motivo)
  on conflict (user_id) where status = 'aberto' do update set cog_pedido = excluded.cog_pedido, motivo = excluded.motivo, criado_em = now();
  return jsonb_build_object('status', 'pendente');
end $$;
revoke all on function public.ativar_minha_conta(text) from public, anon;
grant execute on function public.ativar_minha_conta(text) to authenticated, service_role;

-- ── 4) o COG da conta logada (base das policies de RLS das próximas etapas) ───────────────────
create function public.meu_cog()
returns text language sql stable security definer set search_path = '' as $$
  select c.cog from public.contas_joiner c where c.user_id = (select auth.uid())
$$;
revoke all on function public.meu_cog() from public, anon;
grant execute on function public.meu_cog() to authenticated, service_role;

-- ── 5) resolução administrativa ───────────────────────────────────────────────────────────────
create function public.admin_vinculos_pendentes()
returns table (id bigint, email_da_conta text, cog_pedido text, motivo text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'sem permissão'; end if;
  return query
    select p.id, u.email::text, p.cog_pedido, p.motivo, p.criado_em
      from public.vinculos_pendentes p join auth.users u on u.id = p.user_id
     where p.status = 'aberto' order by p.criado_em;
end $$;
revoke all on function public.admin_vinculos_pendentes() from public, anon;
grant execute on function public.admin_vinculos_pendentes() to authenticated, service_role;

create function public.admin_resolver_vinculo(p_id bigint, p_aprovar boolean, p_cog text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p record; v_cog text; v_exato text; v_n integer; v_j record; v_uid uuid := (select auth.uid());
begin
  if not (select public.is_admin()) then raise exception 'sem permissão'; end if;
  select * into v_p from public.vinculos_pendentes where id = p_id and status = 'aberto' for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if not p_aprovar then
    update public.vinculos_pendentes set status = 'recusado', resolvido_por = v_uid, resolvido_em = now() where id = p_id;
    return jsonb_build_object('status', 'recusado');
  end if;
  v_exato := trim(both from regexp_replace(coalesce(p_cog, v_p.cog_pedido), '^\s*@+', ''));
  v_cog := lower(v_exato);
  -- 1) COG escrito exatamente como está cadastrado (permite escolher entre "Ela" e "ela"); 2) senão, ignorando maiúsculas, se for único
  v_n := 0;
  if p_cog is not null then select count(*) into v_n from public.joiners j where trim(j.cog) = v_exato; end if;   -- o admin informou o COG: vale a grafia exata
  if v_n = 1 then
    select * into v_j from public.joiners j where trim(j.cog) = v_exato;
  else
    select count(*) into v_n from public.joiners j where lower(trim(j.cog)) = v_cog;
    if v_n <> 1 then raise exception 'o COG % corresponde a % joiners; informe o COG exato', v_exato, v_n; end if;
    select * into v_j from public.joiners j where lower(trim(j.cog)) = v_cog;
  end if;
  if exists (select 1 from public.contas_joiner c where lower(c.cog) = lower(trim(v_j.cog))) then raise exception 'o COG % já está vinculado a outra conta', v_exato; end if;
  if exists (select 1 from public.contas_joiner c where c.user_id = v_p.user_id) then raise exception 'esta conta já está vinculada'; end if;
  insert into public.contas_joiner (user_id, cog, origem) values (v_p.user_id, trim(v_j.cog), 'admin');
  update public.vinculos_pendentes set status = 'aprovado', resolvido_por = v_uid, resolvido_em = now() where id = p_id;
  return jsonb_build_object('status', 'aprovado');
end $$;
revoke all on function public.admin_resolver_vinculo(bigint, boolean, text) from public, anon;
grant execute on function public.admin_resolver_vinculo(bigint, boolean, text) to authenticated, service_role;

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
  select count(*) into n from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.meu_cog()'::regprocedure,
         'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, text)'::regprocedure)
     and (not p.prosecdef or p.proconfig is distinct from array['search_path=""']);
  if n > 0 then raise exception 'Função sem security definer / search_path vazio. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.oid in ('public.ativar_minha_conta(text)'::regprocedure, 'public.meu_cog()'::regprocedure,
         'public.admin_vinculos_pendentes()'::regprocedure, 'public.admin_resolver_vinculo(bigint, boolean, text)'::regprocedure)
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'anon pode executar funções de conta. Transação desfeita.'; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'J1' and objeto = 'impressão de joiners';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(coalesce(cog, '') || '|' || coalesce(email, ''), E'\n' order by cog, email), ''))
    into v_depois from public.joiners;
  if v_antes is distinct from v_depois then raise exception 'joiners mudou durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
