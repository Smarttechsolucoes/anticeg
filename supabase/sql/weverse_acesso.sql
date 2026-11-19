-- WEVERSE BLACK FRIDAY — entrega do endereço logo após o PEDIDO (estrutura; NÃO contém nenhum dado do endereço).
-- Rode no SQL Editor DEPOIS do pedidos_weverse_black_friday.sql. Pode rodar de novo sem problema (atualiza a função). Tudo em uma transação.
--
-- Regra: a função weverse_meu_acesso() devolve o conteúdo (endereço, telefone, print) para a conta que TEM um pedido do WEVERSE que NÃO esteja cancelado
-- (aguardando ou confirmado), ou para a administração. Para qualquer outra pessoa — visitante, conta sem pedido, pedido cancelado — devolve nulo.
-- O conteúdo NÃO está no código do site (que é público): fica na tabela weverse_acesso (fechada) e só sai por esta função.
-- Junto vai `pedido_confirmado` (true/false), para a tela dizer se o pagamento já foi conferido. Se um pedido for cancelado depois (comprovante inválido),
-- a pessoa deixa de receber o conteúdo nas próximas vezes que abrir a página.
-- Desfazer: drop function public.weverse_meu_acesso(); drop table public.weverse_acesso;
begin;

do $g$
begin
  if to_regclass('public.pedidos_weverse_black_friday') is null then raise exception 'Rode antes o pedidos_weverse_black_friday.sql. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'A função is_admin() não existe. Nada foi alterado.'; end if;
end $g$;

-- o conteúdo (uma linha), fechado
create table if not exists public.weverse_acesso (
  id            int primary key default 1 check (id = 1),
  conteudo      jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.weverse_acesso enable row level security;
revoke all on table public.weverse_acesso from anon, authenticated, public;
grant select, insert, update, delete on table public.weverse_acesso to authenticated;
drop policy if exists admin_tudo on public.weverse_acesso;
create policy admin_tudo on public.weverse_acesso for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- a única porta de leitura: pedido do WEVERSE não cancelado, da própria conta (ou administração)
create or replace function public.weverse_meu_acesso() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_email text := lower(btrim(coalesce((select auth.jwt()) ->> 'email', ''))); v_adm boolean := (select public.is_admin()); v_ativo boolean; v_conf boolean;
begin
  select coalesce(bool_or(p.status <> 'cancelado'), false), coalesce(bool_or(p.status = 'confirmado'), false)
    into v_ativo, v_conf
    from public.pedidos_weverse_black_friday p
   where v_email <> '' and lower(btrim(p.email)) = v_email;
  if not (v_adm or v_ativo) then return null; end if;
  return (select a.conteudo || jsonb_build_object('pedido_confirmado', v_conf or v_adm) from public.weverse_acesso a where a.id = 1);
end $$;
revoke all on function public.weverse_meu_acesso() from public, anon;
grant execute on function public.weverse_meu_acesso() to authenticated;

-- se a versão anterior deste script criou a regra do bucket (não é mais usada), remove
do $g$
begin
  if to_regclass('storage.objects') is not null then execute 'drop policy if exists weverse_ler_confirmados on storage.objects'; end if;
end $g$;

-- conferência: qualquer falha desfaz tudo
do $g$
begin
  if has_table_privilege('anon', 'public.weverse_acesso', 'SELECT') or has_function_privilege('anon', 'public.weverse_meu_acesso()', 'EXECUTE') then
    raise exception 'O visitante tem acesso ao conteúdo. Nada foi alterado.'; end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.weverse_acesso'::regclass) then raise exception 'A segurança por linha não ficou ligada. Nada foi alterado.'; end if;
end $g$;

commit;

-- resultado (somente leitura): o esperado é 3 linhas "true"
select 'tabela fechada para visitante' as conferencia, (not has_table_privilege('anon', 'public.weverse_acesso', 'SELECT'))::text as resultado
union all select 'função fechada para visitante', (not has_function_privilege('anon', 'public.weverse_meu_acesso()', 'EXECUTE'))::text
union all select 'função usa pedido não cancelado', (position('<> ''cancelado''' in pg_get_functiondef('public.weverse_meu_acesso()'::regprocedure)) > 0)::text;
