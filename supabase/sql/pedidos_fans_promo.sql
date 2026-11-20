-- Pedidos do formulário FANS PROMO (/fans-promo) — itens da loja de fãs, pagamento imediato (PIX ou cartão).
-- Rode UMA vez no SQL Editor do Supabase ANTES de abrir o formulário.
-- Tudo em uma transação: se qualquer conferência falhar, aparece "Nada foi alterado." e nada muda.
--
-- O que este script faz:
--   1) cria a tabela pedidos_fans_promo JÁ FECHADA, como as demais lojas: sem nenhuma regra aberta ao público, sem acesso do visitante;
--      só a administradora (tudo) e a própria pessoa (ler os seus pedidos, pelo e-mail da conta);
--   2) acrescenta 'pedidos_fans_promo' à lista de lojas da função pedido_loja_criar(). A função é reescrita A PARTIR DA DEFINIÇÃO QUE ESTÁ NO BANCO
--      (só entra o nome da tabela no começo da lista), então uma versão mais nova da função é preservada; se a função for diferente do esperado, o script recusa rodar.
-- Sem o passo 2 o site responderia "Não foi possível registrar o pedido" (a função só aceita as tabelas da lista dela).
-- Este form não tem aba "Ao vivo" nem limite de estoque, então NÃO precisa de visão pública.
-- Nenhuma linha de nenhuma outra tabela é alterada ou apagada.
-- Cada pedido guarda os itens em `itens` (jsonb): [{ id, produto, opcao, preco, qtd }]. O id é gerado pelo formulário (uuid).
begin;

create temp table fp_antes on commit drop as
  select p.proacl::text as acl, p.prosecdef as definer, p.proconfig::text as config, pg_get_functiondef(p.oid) as def
    from pg_proc p where p.oid = to_regprocedure('public.pedido_loja_criar(text,jsonb)');

do $g$
declare v_def text;
begin
  if to_regprocedure('public.pedido_loja_criar(text,jsonb)') is null then raise exception 'A função pedido_loja_criar não existe. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'A função is_admin() não existe. Nada foi alterado.'; end if;
  if to_regclass('public.pedidos_fans_promo') is not null then
    raise exception 'A tabela do FANS PROMO já existe (este script já foi aplicado?). Nada foi alterado.';
  end if;
  select m.def into v_def from fp_antes m;
  if position('pedidos_fans_promo' in v_def) > 0 then raise exception 'A função já tem a pedidos_fans_promo. Nada foi alterado.'; end if;
  if position($q$v_lojas text[] := array[$q$ in v_def) = 0 or position('login_necessario' in v_def) = 0 then
    raise exception 'A função pedido_loja_criar no banco não tem o formato esperado (lista v_lojas). Nada foi alterado.';
  end if;
end $g$;

-- 1) a tabela, fechada desde o nascimento
create table public.pedidos_fans_promo (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  email           text not null,
  social          text,
  itens           jsonb not null default '[]'::jsonb,
  qtd_total       int not null default 0,
  valor_total     numeric not null default 0,
  forma_pagamento text,                                    -- pix | cartao
  comprovante_url text,
  status          text not null default 'aguardando',      -- aguardando (PIX) | cartao | confirmado | cancelado
  created_at      timestamptz not null default now()
);

alter table public.pedidos_fans_promo enable row level security;
revoke all on table public.pedidos_fans_promo from anon, public;
grant select, insert, update, delete on table public.pedidos_fans_promo to authenticated;
create policy admin_tudo on public.pedidos_fans_promo for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy le_proprios_por_email on public.pedidos_fans_promo for select to authenticated
  using (lower(trim(email)) = lower(trim(coalesce((select auth.jwt()) ->> 'email', ''))));

-- 2) a função: a definição atual do banco, com a tabela nova no começo da lista
do $g$
declare v_def text; v_novo text;
begin
  select m.def into v_def from fp_antes m;
  v_novo := replace(v_def, $q$v_lojas text[] := array[$q$, $q$v_lojas text[] := array['pedidos_fans_promo',$q$);
  if v_novo = v_def then raise exception 'Não consegui acrescentar a tabela à função. Nada foi alterado.'; end if;
  execute v_novo;
end $g$;

-- 3) conferência: qualquer falha desfaz tudo
do $g$
declare a record; depois text;
begin
  select * into a from fp_antes;
  depois := pg_get_functiondef('public.pedido_loja_criar(text,jsonb)'::regprocedure);
  -- a função nova é a antiga + o nome da tabela, e mais nada
  if replace(depois, $q$'pedidos_fans_promo',$q$, '') is distinct from a.def or position($q$array['pedidos_fans_promo',$q$ in depois) = 0 then
    raise exception 'A função não ficou como esperado. Nada foi alterado.';
  end if;
  if (select p.proacl::text from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure) is distinct from a.acl
     or (select p.prosecdef from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure) is distinct from a.definer
     or (select p.proconfig::text from pg_proc p where p.oid = 'public.pedido_loja_criar(text,jsonb)'::regprocedure) is distinct from a.config then
    raise exception 'As permissões ou a configuração da função mudaram. Nada foi alterado.';
  end if;
  if has_table_privilege('anon', 'public.pedidos_fans_promo', 'SELECT') or has_table_privilege('anon', 'public.pedidos_fans_promo', 'INSERT')
     or has_table_privilege('anon', 'public.pedidos_fans_promo', 'UPDATE') or has_table_privilege('anon', 'public.pedidos_fans_promo', 'DELETE') then
    raise exception 'O visitante tem permissão na tabela. Nada foi alterado.';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.pedidos_fans_promo'::regclass) then raise exception 'A segurança por linha não ficou ligada. Nada foi alterado.'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pedidos_fans_promo') <> 2
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pedidos_fans_promo' and policyname in ('admin_tudo', 'le_proprios_por_email')) <> 2 then
    raise exception 'As regras da tabela não ficaram como esperado. Nada foi alterado.';
  end if;
end $g$;

commit;

-- resultado (somente leitura): o esperado é 3 linhas "true" e 0 pedidos
select 'função aceita pedidos_fans_promo' as conferencia, (position('pedidos_fans_promo' in pg_get_functiondef('public.pedido_loja_criar(text,jsonb)'::regprocedure)) > 0)::text as resultado
union all select 'visitante sem acesso à tabela', (not has_table_privilege('anon', 'public.pedidos_fans_promo', 'SELECT') and not has_table_privilege('anon', 'public.pedidos_fans_promo', 'INSERT'))::text
union all select 'regras da tabela (admin_tudo + le_proprios_por_email)', ((select count(*) from pg_policies where schemaname = 'public' and tablename = 'pedidos_fans_promo') = 2)::text
union all select 'pedidos na tabela (esperado 0)', (select count(*) from public.pedidos_fans_promo)::text;
