-- J4c-3 — LOJAS PÚBLICAS E FORMULÁRIOS: pedidos_* e formulario_pedidos
-- Hoje qualquer visitante lê (e altera) TODOS os pedidos das lojas (nome, e-mail, @, contato, comprovante, valor, status — inclusive marcar pedido como "confirmado").
-- Depois deste passo:
--   pedidos_* (revista, popup, wmag, wmag_leeknow, smolmerch, bazaar_in, lightstick, popcorn_sleeve, singba, skzoo_rio):
--       o visitante NÃO lê nem altera nada. Para comprar, a loja chama pedido_loja_criar(): o servidor valida a tabela, descarta campos que o cliente não pode escolher
--       (id numérico, created_at) e RECUSA pedido que já nasça confirmado/pago/cancelado; devolve só o número do pedido. Trava de 200 pedidos por hora por loja.
--       Quem está logada vê só os próprios pedidos (pelo e-mail verificado da conta, ou pelo COG exato da conta). Administradora: tudo.
--   formulario_pedidos (Wave Maker, Run It, Paper Tales, Odd Fresh, Promo 13): só joiner logada cria o próprio (nasce 'pendente') e lê os próprios; administradora tudo.
--       Estoque e fila continuam funcionando por uma VISÃO pública (formulario_pedidos_publico): evento, modalidade, status, data e só "Qtd: N" — nunca nome, e-mail, @ ou observações livres.
-- Nada de dado é alterado/apagado. As permissões do visitante saem e NENHUMA é copiada para a conta logada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (VITE_JOINERS_AUTH ligado) e depois do J1, J4-0 e J4a. O site de hoje depende do acesso de visitante.
-- Fora deste lote (ainda abertos, lote seguinte): mercari_pedidos (a página estática mercari-embed usa a API aberta), lojinha_repasses e demais tabelas.
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
declare n integer; t text; lojas text[] := array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio'];
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-3') then raise exception 'J4c-3 já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null or to_regprocedure('public.meu_cog()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regclass('public.formulario_pedidos') is null then raise exception 'A tabela formulario_pedidos não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.formulario_pedidos'::regclass and not attisdropped and attname in ('id', 'evento', 'joiner_cog', 'modalidade', 'observacoes', 'status', 'created_at');
  if n <> 7 then raise exception 'formulario_pedidos sem as colunas esperadas (achei % de 7). Nada foi alterado.', n; end if;
  n := 0;
  foreach t in array lojas loop
    if to_regclass('public.' || t) is not null then
      n := n + 1;
      if not exists (select 1 from pg_attribute where attrelid = ('public.' || t)::regclass and attname = 'status' and not attisdropped) then raise exception 'A tabela % não tem a coluna status. Nada foi alterado.', t; end if;
    end if;
  end loop;
  if n = 0 then raise exception 'Nenhuma tabela de loja encontrada. Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
  if to_regclass('public.formulario_pedidos_publico') is not null then raise exception 'formulario_pedidos_publico já existe. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR (policies para recriar exatamente, permissões e impressão dos dados) de TODAS as tabelas do lote que existem
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-3', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-3', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relname in ('pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos');
do $$
declare t text; v text;
begin
  foreach t in array array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id::text), '''')) from public.%I', t) into v;
      insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4c-3', 'impressão ' || t, v);
    end if;
  end loop;
end $$;

-- 1) as lojas: RLS ligado, políticas antigas fora, visitante sem nenhuma permissão; conta logada só pelas policies
do $$
declare t text; r record; cols text[];
begin
  foreach t in array array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop execute format('drop policy %I on public.%I', r.policyname, t); end loop;
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy admin_tudo on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    select array_agg(attname::text) into cols from pg_attribute where attrelid = ('public.' || t)::regclass and not attisdropped and attname in ('email', 'cog', 'joiner_cog');
    if 'email' = any(coalesce(cols, '{}')) then
      execute format('create policy le_proprios_por_email on public.%I for select to authenticated using (lower(trim(email)) = lower(trim(coalesce((select auth.jwt()) ->> ''email'', ''''))))', t);
    end if;
    if 'cog' = any(coalesce(cols, '{}')) then
      execute format('create policy le_proprios_por_cog on public.%I for select to authenticated using (public.cog_e_da_conta(cog))', t);
    end if;
    if 'joiner_cog' = any(coalesce(cols, '{}')) then
      execute format('create policy le_proprios_por_joiner_cog on public.%I for select to authenticated using (public.cog_e_da_conta(joiner_cog))', t);
    end if;
  end loop;
end $$;

-- 2) formulários das joiners
alter table public.formulario_pedidos enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'formulario_pedidos' loop execute format('drop policy %I on public.formulario_pedidos', r.policyname); end loop;
end $$;
revoke all on table public.formulario_pedidos from anon, public;
grant select, insert, update, delete on table public.formulario_pedidos to authenticated;
create policy admin_tudo on public.formulario_pedidos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprios on public.formulario_pedidos for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_cria_proprio on public.formulario_pedidos for insert to authenticated with check (public.cog_e_da_conta(joiner_cog) and status = 'pendente');

-- visão pública de estoque e fila: nenhum dado pessoal ('observacoes' só devolve o trecho "Qtd: N")
create view public.formulario_pedidos_publico as
  select f.id, f.evento, f.modalidade, f.status, f.created_at,
         coalesce('Qtd: ' || (regexp_match(f.observacoes, 'Qtd:\s*(\d+)'))[1], '') as observacoes
    from public.formulario_pedidos f;
revoke all on public.formulario_pedidos_publico from public, anon, authenticated;
grant select on public.formulario_pedidos_publico to anon, authenticated, service_role;

-- 3) criação de pedido pelas lojas (SÓ conta ativada ou administradora): validada no servidor
create function public.pedido_loja_criar(p_tabela text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lojas text[] := array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio'];
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
end $$;
revoke all on function public.pedido_loja_criar(text, jsonb) from public, anon;
grant execute on function public.pedido_loja_criar(text, jsonb) to authenticated, service_role;   -- visitante não executa (D2)

-- 4) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare t text; n integer; v_a text; v_d text;
begin
  foreach t in array array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_dazed_seungmin','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT') or has_table_privilege('anon', 'public.' || t, 'INSERT') or has_table_privilege('anon', 'public.' || t, 'UPDATE') or has_table_privilege('anon', 'public.' || t, 'DELETE')
       or has_any_column_privilege('anon', 'public.' || t, 'SELECT') or has_any_column_privilege('anon', 'public.' || t, 'INSERT') or has_any_column_privilege('anon', 'public.' || t, 'UPDATE') then
      raise exception 'O visitante ainda tem permissão em %. Transação desfeita.', t;
    end if;
    select count(*) into n from pg_policies where schemaname = 'public' and tablename = t and ('anon' = any(roles) or 'public' = any(roles));
    if n > 0 then raise exception 'Sobrou policy para visitante em %. Transação desfeita.', t; end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'admin_tudo') then raise exception 'Falta admin_tudo em %. Transação desfeita.', t; end if;
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-3' and objeto = 'impressão ' || t;
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id::text), '''')) from public.%I', t) into v_d;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'formulario_pedidos_publico' and column_name ~* '(email|nome|cog|cpf|whats)';
  if n > 0 then raise exception 'A visão pública do formulário expõe coluna pessoal. Transação desfeita.'; end if;
  if not exists (select 1 from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure and p.prosecdef and p.proconfig = array['search_path=""']) then raise exception 'pedido_loja_criar sem security definer/search_path vazio. Transação desfeita.'; end if;
end $$;

commit;
