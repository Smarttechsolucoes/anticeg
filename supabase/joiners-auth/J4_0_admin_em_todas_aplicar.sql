-- J4-0 — A ADMINISTRADORA PASSA A TER ACESSO PRÓPRIO (is_admin()) EM TODAS AS TABELAS DO SITE QUE JÁ TÊM RLS
-- ADITIVO e seguro: cria, em cada tabela, uma policy "admin_tudo" só para o papel authenticated, valendo apenas para is_admin() (conta cadastrada em admin_roles).
-- Não remove nem muda nenhuma policy existente, não liga RLS em tabela que hoje está sem RLS (isso bloquearia o site) e não amplia o acesso de ninguém além das administradoras.
-- Por que existe: quando o site passar a usar UM cliente logado para tudo (lançamento), a administradora deixa de ser "visitante" e precisa de acesso próprio.
-- Tabelas sem RLS ficam listadas no registro (estado anterior) para serem tratadas nos lotes do J4.
-- NENHUM privilégio é concedido: as travas deliberadas do C0 (UPDATE/DELETE retirados em pagamento_demandas e multas_pagas, colunas travadas da masterlist) continuam valendo também para a administradora.
-- A policy só decide quais LINHAS a administradora pode alcançar com os privilégios que o papel authenticated já tem.
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
declare
  tabelas text[] := array['masterlist','joiners','item_fotos','claim_reservas','claim_sets','envio_solicitacoes','formulario_pedidos','claims','joiner_storage','reports',
    'claim_eventos','envio_rounds','repassos','pushes','envio_requests','pagamento_demandas','feedbacks','lojinha_repasses','pedidos_revista','notifications','ceg_config',
    'push_reads','pedidos_popup','links_uteis','estoque_compras','joiner_conferencias','push_subscriptions','mercari_pedidos','pedidos_skzoo_rio','joiner_updates','rastreios',
    'estoque_itens','grupos_envio','pre_cadastros','pedidos_bazaar_in','pedidos_lightstick','sugestoes_tabela','multas_pagas','confirmacoes','pedidos_popcorn_sleeve',
    'pedidos_singba','cal_eventos','tabela_precos','antiv_badges','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch'];
  t text; reg regclass; criadas text[] := '{}'; sem_rls text[] := '{}'; ausentes text[] := '{}'; ja text[] := '{}';
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4-0') then
    raise exception 'J4-0 já foi aplicada: o registro já existe e não será sobrescrito.';
  end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe (A1/A2 não aplicados). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há nenhuma administradora em admin_roles. Nada foi alterado.'; end if;

  foreach t in array tabelas loop
    reg := to_regclass('public.' || quote_ident(t));
    if reg is null then ausentes := ausentes || t; continue; end if;
    if not (select relrowsecurity from pg_class where oid = reg) then sem_rls := sem_rls || t; continue; end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'admin_tudo') then ja := ja || t; continue; end if;
    execute format('create policy admin_tudo on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    criadas := criadas || t;
  end loop;

  insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
    ('J4-0', 'policies admin_tudo criadas', array_to_string(criadas, ',')),
    ('J4-0', 'tabelas SEM RLS (não tocadas; tratar nos lotes do J4)', array_to_string(sem_rls, ',')),
    ('J4-0', 'tabelas que não existem (ignoradas)', array_to_string(ausentes, ',')),
    ('J4-0', 'tabelas que já tinham admin_tudo', array_to_string(ja, ','));
end $$;

do $$
declare n integer;
begin
  -- toda policy admin_tudo criada vale só para authenticated e só com is_admin()
  select count(*) into n from pg_policies
   where schemaname = 'public' and policyname = 'admin_tudo'
     and not (roles = array['authenticated']::name[] and qual ilike '%is_admin%' and with_check ilike '%is_admin%');
  if n > 0 then raise exception 'Alguma policy admin_tudo ficou diferente do esperado. Transação desfeita.'; end if;
end $$;

commit;
