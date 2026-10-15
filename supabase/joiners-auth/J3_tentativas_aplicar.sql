-- J3 — CONTROLE DE TENTATIVAS DE LOGIN E DE RECUPERAÇÃO DE SENHA (proteção contra força bruta e abuso)
-- ADITIVO: cria uma tabela nova que só o servidor (service_role, usado pelas funções login-joiner e recuperar-senha-joiner) lê e grava.
-- Visitante e joiner não têm acesso nenhum. Tudo em uma transação com registro e verificação antes do COMMIT.
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
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J3') then
    raise exception 'J3 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regclass('public.tentativas_acesso') is not null then raise exception 'public.tentativas_acesso já existe: revise antes. Nada foi alterado.'; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then raise exception 'O papel service_role não existe. Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J3', 'public.tentativas_acesso', 'não existia (criada pelo J3)');

create table public.tentativas_acesso (
  id        bigint generated always as identity primary key,
  tipo      text not null check (tipo in ('login', 'recuperar')),
  chave     text not null check (length(chave) between 1 and 200),   -- ex.: "cog:ana" ou "ip:203.0.113.5"
  criado_em timestamptz not null default now()
);
create index tentativas_acesso_busca on public.tentativas_acesso (tipo, chave, criado_em desc);
create index tentativas_acesso_tempo on public.tentativas_acesso (criado_em);
alter table public.tentativas_acesso enable row level security;
revoke all on table public.tentativas_acesso from public, anon, authenticated;
grant select, insert, update, delete on table public.tentativas_acesso to service_role;
-- permissão restrita à sequência da coluna IDENTITY desta tabela (nome real obtido do catálogo), e a nenhuma outra
do $$
declare v_seq text := pg_get_serial_sequence('public.tentativas_acesso', 'id');
begin
  if v_seq is null then raise exception 'Sequência da coluna id de tentativas_acesso não encontrada. Transação desfeita.'; end if;
  execute format('grant usage, select on sequence %s to service_role', v_seq);
end $$;

do $$
declare n integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.tentativas_acesso'::regclass) then raise exception 'RLS desligado. Transação desfeita.'; end if;
  select count(*) into n from (values ('anon'), ('authenticated')) r(rolname)
   where has_table_privilege(r.rolname, 'public.tentativas_acesso', 'SELECT') or has_table_privilege(r.rolname, 'public.tentativas_acesso', 'INSERT')
      or has_table_privilege(r.rolname, 'public.tentativas_acesso', 'UPDATE') or has_table_privilege(r.rolname, 'public.tentativas_acesso', 'DELETE');
  if n > 0 then raise exception 'anon/authenticated têm acesso a tentativas_acesso. Transação desfeita.'; end if;
  if has_sequence_privilege('anon', pg_get_serial_sequence('public.tentativas_acesso', 'id'), 'USAGE') or has_sequence_privilege('authenticated', pg_get_serial_sequence('public.tentativas_acesso', 'id'), 'USAGE') then
    raise exception 'anon/authenticated têm acesso à sequência de tentativas_acesso. Transação desfeita.';
  end if;
  if not has_sequence_privilege('service_role', pg_get_serial_sequence('public.tentativas_acesso', 'id'), 'USAGE') then raise exception 'service_role sem permissão na sequência. Transação desfeita.'; end if;
  if not (has_table_privilege('service_role', 'public.tentativas_acesso', 'INSERT') and has_table_privilege('service_role', 'public.tentativas_acesso', 'SELECT') and has_table_privilege('service_role', 'public.tentativas_acesso', 'DELETE')) then
    raise exception 'service_role sem permissão. Transação desfeita.';
  end if;
end $$;

commit;
