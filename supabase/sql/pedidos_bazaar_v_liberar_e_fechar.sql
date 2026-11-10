-- BAZAAR V — conserta o erro "Não foi possível registrar o pedido" e fecha a tabela como as outras lojas.
-- Rode UMA vez no SQL Editor do Supabase. Tudo em uma transação: se qualquer conferência falhar, aparece "Nada foi alterado." e nada muda.
--
-- Por que dava erro: a função pedido_loja_criar() só aceita as tabelas da lista dela (v_lojas) e a pedidos_bazaar_v não estava nela ("loja_invalida").
-- O que este script faz:
--   1) acrescenta 'pedidos_bazaar_v' à lista da função — o resto da função é IDÊNTICO à versão de produção conferida em 10/11/2026
--      (por isso ele recusa rodar se a função no banco for diferente daquela: não sobrescreve uma versão mais nova);
--   2) fecha a tabela como as demais lojas: tira as regras abertas ao público (select_todos, update_todos, insert_publico),
--      tira todo acesso do visitante e deixa só a administradora (tudo) e a própria pessoa (ler os seus pedidos, pelo e-mail da conta).
--      O pedido continua sendo criado pela função, que valida tudo no servidor.
-- Nenhuma linha de nenhuma tabela é alterada ou apagada.
begin;

create temp table bz_antes on commit drop as
  select p.proacl::text as acl, p.prosecdef as definer, p.proconfig::text as config
    from pg_proc p where p.oid = to_regprocedure('public.pedido_loja_criar(text,jsonb)');

do $g$
declare def text;
begin
  if to_regclass('public.pedidos_bazaar_v') is null then raise exception 'A tabela pedidos_bazaar_v não existe. Nada foi alterado.'; end if;
  if to_regprocedure('public.pedido_loja_criar(text,jsonb)') is null then raise exception 'A função pedido_loja_criar não existe. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'A função is_admin() não existe. Nada foi alterado.'; end if;
  def := pg_get_functiondef('public.pedido_loja_criar(text,jsonb)'::regprocedure);
  if position('pedidos_bazaar_v' in def) > 0 then raise exception 'A função já tem a pedidos_bazaar_v (este script já foi aplicado?). Nada foi alterado.'; end if;
  if position($q$'pedidos_murce_itens','pedidos_dazed_han']$q$ in def) = 0 or position('login_necessario' in def) = 0 then
    raise exception 'A função pedido_loja_criar no banco não é a versão conferida em 10/11/2026. Nada foi alterado.';
  end if;
end $g$;

-- 1) a função (idêntica à de produção, com mais uma tabela na lista)
CREATE OR REPLACE FUNCTION public.pedido_loja_criar(p_tabela text, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lojas text[] := array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_esquire_hyunjin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','pedidos_dicon_origin','pedidos_promo_murce_50','pedidos_murce_itens','pedidos_dazed_han','pedidos_bazaar_v'];
  v_dados jsonb; v_cols text; v_id text; v_n integer;
begin
  -- D2: comprar (e enviar comprovante) exige conta ATIVADA e vinculada a um cadastro; visitante e conta sem vínculo não criam pedido
  if (select public.meu_cog()) is null and not (select public.is_admin()) then return jsonb_build_object('ok', false, 'motivo', 'login_necessario'); end if;
  if p_tabela is null or not (p_tabela = any (v_lojas)) or to_regclass('public.' || p_tabela) is null then return jsonb_build_object('ok', false, 'motivo', 'loja_invalida'); end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or pg_column_size(p_dados) > 30000 then return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos'); end if;
  v_dados := p_dados - 'created_at' - 'updated_at';
  -- o cliente só escolhe o id quando ele é um UUID (SmolMerch gera o número no navegador); nas demais o id é do servidor
  if coalesce((select data_type from information_schema.columns where table_schema = 'public' and table_name = p_tabela and column_name = 'id'), '') <> 'uuid' then v_dados := v_dados - 'id'; end if;
  if lower(coalesce(v_dados ->> 'status', '')) in ('confirmado', 'cancelado', 'pago', 'enviado', 'entregue', 'recusado', 'rejeitado') then return jsonb_build_object('ok', false, 'motivo', 'status_invalido'); end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_tabela and column_name = 'created_at') then
    execute format('select count(*) from public.%I where created_at > now() - interval ''1 hour''', p_tabela) into v_n;
    if v_n >= 200 then return jsonb_build_object('ok', false, 'motivo', 'tente_mais_tarde'); end if;
  end if;
  select string_agg(quote_ident(k), ', ') into v_cols from jsonb_object_keys(v_dados) k
   where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_tabela and c.column_name = k and coalesce(c.is_generated, 'NEVER') = 'NEVER');
  if v_cols is null then return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos'); end if;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning id::text', p_tabela, v_cols, v_cols, p_tabela) using v_dados into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
end $function$;

-- 2) a tabela
alter table public.pedidos_bazaar_v enable row level security;
do $g$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'pedidos_bazaar_v' loop
    execute format('drop policy %I on public.pedidos_bazaar_v', r.policyname);
  end loop;
end $g$;
revoke all on table public.pedidos_bazaar_v from anon, public;
grant select, insert, update, delete on table public.pedidos_bazaar_v to authenticated;
create policy admin_tudo on public.pedidos_bazaar_v for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy le_proprios_por_email on public.pedidos_bazaar_v for select to authenticated
  using (lower(trim(email)) = lower(trim(coalesce((select auth.jwt()) ->> 'email', ''))));

-- 3) conferência: qualquer falha desfaz tudo
do $g$
declare n integer; a record; def text;
begin
  def := pg_get_functiondef('public.pedido_loja_criar(text,jsonb)'::regprocedure);
  if position($q$'pedidos_dazed_han','pedidos_bazaar_v']$q$ in def) = 0 or position('login_necessario' in def) = 0 then raise exception 'A função não ficou como esperado. Nada foi alterado.'; end if;
  select * into a from bz_antes;
  if (select p.proacl::text from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure) is distinct from a.acl
     or (select p.prosecdef from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure) is distinct from a.definer
     or (select p.proconfig::text from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure) is distinct from a.config then
    raise exception 'As permissões ou a configuração da função mudaram. Nada foi alterado.';
  end if;
  if has_table_privilege('anon', 'public.pedidos_bazaar_v', 'SELECT') or has_table_privilege('anon', 'public.pedidos_bazaar_v', 'INSERT')
     or has_table_privilege('anon', 'public.pedidos_bazaar_v', 'UPDATE') or has_table_privilege('anon', 'public.pedidos_bazaar_v', 'DELETE') then
    raise exception 'O visitante ainda tem permissão na tabela. Nada foi alterado.';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.pedidos_bazaar_v'::regclass) then raise exception 'A segurança por linha não ficou ligada. Nada foi alterado.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'pedidos_bazaar_v' and policyname in ('admin_tudo', 'le_proprios_por_email');
  if n <> 2 or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pedidos_bazaar_v') <> 2 then raise exception 'As regras da tabela não ficaram como esperado. Nada foi alterado.'; end if;
end $g$;

commit;

-- resultado (somente leitura): o esperado é 3 linhas "true" e a contagem de pedidos que já estavam na tabela (deve ser 0)
select 'função aceita pedidos_bazaar_v' as conferencia, (position('pedidos_bazaar_v' in pg_get_functiondef('public.pedido_loja_criar(text,jsonb)'::regprocedure)) > 0)::text as resultado
union all select 'visitante sem acesso à tabela', (not has_table_privilege('anon', 'public.pedidos_bazaar_v', 'SELECT') and not has_table_privilege('anon', 'public.pedidos_bazaar_v', 'INSERT'))::text
union all select 'regras da tabela (admin_tudo + le_proprios_por_email)', ((select count(*) from pg_policies where schemaname = 'public' and tablename = 'pedidos_bazaar_v') = 2)::text
union all select 'pedidos na tabela (esperado 0)', (select count(*) from public.pedidos_bazaar_v)::text;
