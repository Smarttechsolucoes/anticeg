-- WEVERSE BLACK FRIDAY — entrega do endereço SÓ para quem teve o pagamento CONFIRMADO (estrutura; NÃO contém nenhum dado do endereço).
-- Rode UMA vez no SQL Editor DEPOIS do pedidos_weverse_black_friday.sql. Tudo em uma transação.
--
-- O que este script faz:
--   1) tabela weverse_acesso (UMA linha, id = 1) com o conteúdo a mostrar. Fechada: RLS ligada, sem acesso do visitante nem de contas comuns; só a administração lê/edita.
--   2) função weverse_meu_acesso(): devolve o conteúdo SOMENTE se a conta (e-mail do login) tem um pedido com status 'confirmado' em pedidos_weverse_black_friday
--      (ou se é administração). Para qualquer outra pessoa devolve nulo. É a única porta de leitura.
--   3) bucket PRIVADO 'weverse-privado' no Storage + regra de leitura com a mesma condição (a imagem do print só abre para quem tem pedido confirmado).
-- O endereço e o upload do print NÃO ficam neste arquivo (o código do site é público): o conteúdo você insere pelo SQL separado e o print você sobe pelo painel do Storage.
-- Desfazer: drop function public.weverse_meu_acesso(); drop table public.weverse_acesso; drop policy weverse_ler_confirmados on storage.objects; (e apague o bucket no painel).
begin;

do $g$
begin
  if to_regclass('public.pedidos_weverse_black_friday') is null then raise exception 'Rode antes o pedidos_weverse_black_friday.sql. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'A função is_admin() não existe. Nada foi alterado.'; end if;
  if to_regclass('public.weverse_acesso') is not null or to_regprocedure('public.weverse_meu_acesso()') is not null then raise exception 'O acesso do WEVERSE já existe (este script já foi aplicado?). Nada foi alterado.'; end if;
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then raise exception 'O Storage não está disponível. Nada foi alterado.'; end if;
end $g$;

-- 1) o conteúdo (uma linha), fechado
create table public.weverse_acesso (
  id            int primary key default 1 check (id = 1),
  conteudo      jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.weverse_acesso enable row level security;
revoke all on table public.weverse_acesso from anon, authenticated, public;
grant select, insert, update, delete on table public.weverse_acesso to authenticated;
create policy admin_tudo on public.weverse_acesso for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 2) a única porta de leitura: pedido CONFIRMADO da própria conta (ou administração)
create function public.weverse_meu_acesso() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select public.is_admin()) or exists (
       select 1 from public.pedidos_weverse_black_friday p
        where p.status = 'confirmado'
          and lower(btrim(p.email)) = lower(btrim(coalesce((select auth.jwt()) ->> 'email', ''))))
  then
    return (select a.conteudo from public.weverse_acesso a where a.id = 1);
  end if;
  return null;
end $$;
revoke all on function public.weverse_meu_acesso() from public, anon;
grant execute on function public.weverse_meu_acesso() to authenticated;

-- 3) bucket privado + leitura só para quem tem pedido confirmado (ou administração)
insert into storage.buckets (id, name, public) values ('weverse-privado', 'weverse-privado', false) on conflict (id) do update set public = false;
create policy weverse_ler_confirmados on storage.objects for select to authenticated
  using (bucket_id = 'weverse-privado' and (
    (select public.is_admin()) or exists (
      select 1 from public.pedidos_weverse_black_friday p
       where p.status = 'confirmado'
         and lower(btrim(p.email)) = lower(btrim(coalesce((select auth.jwt()) ->> 'email', ''))))));

-- conferência: qualquer falha desfaz tudo
do $g$
begin
  if has_table_privilege('anon', 'public.weverse_acesso', 'SELECT') or has_function_privilege('anon', 'public.weverse_meu_acesso()', 'EXECUTE') then
    raise exception 'O visitante tem acesso ao conteúdo. Nada foi alterado.'; end if;
  if (select public from storage.buckets where id = 'weverse-privado') is distinct from false then raise exception 'O bucket não ficou privado. Nada foi alterado.'; end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.weverse_acesso'::regclass) then raise exception 'A segurança por linha não ficou ligada. Nada foi alterado.'; end if;
end $g$;

commit;

-- resultado (somente leitura): o esperado é 4 linhas "true"
select 'tabela fechada para visitante' as conferencia, (not has_table_privilege('anon', 'public.weverse_acesso', 'SELECT'))::text as resultado
union all select 'função fechada para visitante', (not has_function_privilege('anon', 'public.weverse_meu_acesso()', 'EXECUTE'))::text
union all select 'bucket weverse-privado é privado', (select (not public)::text from storage.buckets where id = 'weverse-privado')
union all select 'regra de leitura do bucket criada', (exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'weverse_ler_confirmados'))::text;
