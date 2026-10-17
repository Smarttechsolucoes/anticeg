-- N1 — CONTROLE DE ENVIOS DE E-MAIL: cada e-mail de notificação é registrado (evento + registro) para nunca sair duas vezes e para limitar abusos.
-- ADITIVO: cria uma tabela nova que só o servidor (service_role, usado pela função email-evento) lê e grava. Visitante e joiner não têm acesso nenhum.
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
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'N1') then
    raise exception 'N1 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regclass('public.emails_enviados') is not null then raise exception 'public.emails_enviados já existe: revise antes. Nada foi alterado.'; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then raise exception 'O papel service_role não existe. Nada foi alterado.'; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('N1', 'public.emails_enviados', 'não existia (criada pelo N1)');

create table public.emails_enviados (
  id           bigint generated always as identity primary key,
  evento       text not null check (length(evento) between 1 and 60),
  referencia   text not null check (length(referencia) between 1 and 200),
  destinatario text not null check (length(destinatario) between 3 and 254),
  criado_em    timestamptz not null default now()
);
create unique index emails_enviados_unico on public.emails_enviados (evento, referencia);
create index emails_enviados_destinatario_tempo on public.emails_enviados (destinatario, criado_em desc);
create index emails_enviados_tempo on public.emails_enviados (criado_em desc);
alter table public.emails_enviados enable row level security;
revoke all on table public.emails_enviados from public, anon, authenticated;
grant select, insert, update, delete on table public.emails_enviados to service_role;
grant usage, select on all sequences in schema public to service_role;

do $$
declare n integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.emails_enviados'::regclass) then raise exception 'RLS desligado. Transação desfeita.'; end if;
  select count(*) into n from (values ('anon'), ('authenticated')) r(rolname)
   where has_table_privilege(r.rolname, 'public.emails_enviados', 'SELECT') or has_table_privilege(r.rolname, 'public.emails_enviados', 'INSERT')
      or has_table_privilege(r.rolname, 'public.emails_enviados', 'UPDATE') or has_table_privilege(r.rolname, 'public.emails_enviados', 'DELETE');
  if n > 0 then raise exception 'anon/authenticated têm acesso a emails_enviados. Transação desfeita.'; end if;
  if not (has_table_privilege('service_role', 'public.emails_enviados', 'INSERT') and has_table_privilege('service_role', 'public.emails_enviados', 'SELECT') and has_table_privilege('service_role', 'public.emails_enviados', 'DELETE')) then
    raise exception 'service_role sem permissão. Transação desfeita.';
  end if;
end $$;

commit;
