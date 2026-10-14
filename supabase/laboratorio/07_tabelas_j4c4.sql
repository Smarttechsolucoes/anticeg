-- LABORATÓRIO — tabelas do J4c-4 (Mercari, lojinha, repasses, claims em sets, e o resto do site), só dados fictícios.
-- As colunas foram levantadas do código do site (consultas e inserts); a produção pode ter colunas extras (os scripts J4c-4 só exigem as listadas nas travas).
-- Estado "de HOJE": 9 tabelas com RLS desligado (como no diagnóstico da contenção) e as demais com policy aberta ao visitante.
-- Rode DEPOIS do 06_lojas_publicas.sql, só em banco de ensaio vazio (PGlite local).
create table if not exists public.mercari_pedidos (
  id bigint generated always as identity primary key, joiner_cog text, joiner_nome text, joiner_whatsapp text, itens jsonb, valor_jpy_total numeric, valor_brl_total numeric,
  taxa_cambio numeric, comprovante_url text, metodo_pagamento text, id_transacao text, status text default 'pendente', created_at timestamptz default now()
);
create table if not exists public.lojinha_repasses (
  id bigint generated always as identity primary key, joiner_cog text, joiner_nome text, masterlist_id bigint, nome_card text, ceg text, valor numeric, prazo text, foto_url text,
  whatsapp text, status text default 'disponivel', reservado_para text, created_at timestamptz default now()
);
create table if not exists public.repassos (
  id bigint generated always as identity primary key, joiner_cog text, joiner_nome text, joiner_twitter text, novo_dono_cog text, novo_dono_nome text, novo_dono_twitter text,
  item_id bigint, ceg text, nome_do_item text, item_status text, item_quitado boolean default false, custos_pagos jsonb, valor_pendente_descricao text, valor_acordado numeric,
  comprovacao_url text, obs text, status text default 'pendente', created_at timestamptz default now()
);
create table if not exists public.claim_eventos (
  id bigint generated always as identity primary key, nome text, valor numeric, prazo text, abertura timestamptz, status text default 'ativo', membros jsonb, sets_iniciais int,
  limite_por_joiner int, foto_url text, sem_novos_sets boolean not null default false, created_at timestamptz default now()
);
create table if not exists public.claim_sets (
  id bigint generated always as identity primary key, evento_id bigint not null, numero int not null, status text default 'aberto', closed_at timestamptz, created_at timestamptz default now(),
  constraint claim_sets_evento_numero_key unique (evento_id, numero)
);
create table if not exists public.claim_reservas (
  id bigint generated always as identity primary key, evento_id bigint not null, set_id bigint, joiner_cog text, joiner_nome text, membro text not null, status text default 'pendente',
  is_admin boolean default false, created_at timestamptz default now()
);
create unique index if not exists claim_reservas_set_membro_ativo on public.claim_reservas (set_id, membro) where set_id is not null and status <> 'cancelado';
create table if not exists public.feedbacks (
  id bigint generated always as identity primary key, joiner_cog text, joiner_nome text, tipo text, message text, resposta text, status text default 'pendente',
  resposta_joiner text, resposta_joiner_at timestamptz, created_at timestamptz default now()
);
create table if not exists public.notifications (
  id bigint generated always as identity primary key, joiner_cog text, message text, type text, read_at timestamptz, created_at timestamptz default now()
);
create table if not exists public.pushes (
  id bigint generated always as identity primary key, title text, message text, url text, active boolean default true, joiner_cog text, created_at timestamptz default now()
);
create table if not exists public.push_reads (
  id bigint generated always as identity primary key, push_id bigint, joiner_cog text, created_at timestamptz default now()
);
create table if not exists public.joiner_storage (
  id bigint generated always as identity primary key, joiner_cog text, foto_url text, descricao text, ativo boolean default true, created_at timestamptz default now()
);
create table if not exists public.joiner_conferencias (
  id bigint generated always as identity primary key, joiner_cog text, prazo_dias int, iniciada_em timestamptz default now(), confirmada_em timestamptz
);
create table if not exists public.joiner_updates (
  id bigint generated always as identity primary key, joiner_cog text, campos jsonb, lido boolean default false, created_at timestamptz default now()
);
create table if not exists public.envio_rounds (
  id bigint generated always as identity primary key, numero int not null, status text default 'aberto', created_at timestamptz default now()
);
create table if not exists public.envio_requests (
  id bigint generated always as identity primary key, joiner_cog text, round_id bigint, posicao_no_round int, status text default 'aguardando', solicitado_em timestamptz default now(), itens_manuais text
);
create table if not exists public.confirmacoes (
  id bigint generated always as identity primary key, joiner_cog text, joiner_nome text, twitter_novo text, visto boolean default false, created_at timestamptz default now()
);
create table if not exists public.rastreios (
  id bigint generated always as identity primary key, codigo text, descricao text, criado_em timestamptz default now()
);
create table if not exists public.estoque_itens (
  id bigint generated always as identity primary key, nome text, saldo_inicial numeric default 0, link_loja text, categoria text, uso_por_pedido numeric default 0, durabilidade_dias int
);
create table if not exists public.estoque_compras (
  id bigint generated always as identity primary key, item_id bigint, data_compra date, quantidade numeric, valor_total numeric, data_chegada date
);
create table if not exists public.ceg_config (
  ceg text primary key, whatsapp_link text
);
create table if not exists public.item_fotos (
  id bigint generated always as identity primary key, ceg text, nome_do_item text, foto_url text, ordem int default 0, descricao text, config jsonb
);
create table if not exists public.links_uteis (
  id bigint generated always as identity primary key, titulo text, url text, ordem int default 0
);
create table if not exists public.tabela_precos (
  id bigint generated always as identity primary key, sheet text, categoria text, item text, preco text, ordem_cat int default 0, ordem_item int default 0, updated_at timestamptz default now()
);
create table if not exists public.sugestoes_tabela (
  id bigint generated always as identity primary key, tabela_preco_id bigint, sheet text, categoria text, item text, preco_atual text, preco_sugerido text, status text default 'pendente', created_at timestamptz default now()
);
create table if not exists public.antiv_badges (
  id bigint generated always as identity primary key, joiner_cog text, badge_slug text
);

-- "hoje": RLS ligado com policy aberta ao visitante, exceto 9 tabelas sem RLS (diagnóstico da contenção) e as 3 com RLS sem policy (leitura vazia)
do $$
declare t text;
begin
  foreach t in array array['mercari_pedidos','lojinha_repasses','repassos','claim_eventos','claim_sets','claim_reservas','feedbacks','notifications','pushes','push_reads','joiner_updates','confirmacoes','links_uteis','cal_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy anon_all on public.%I for all to anon using (true) with check (true)', t);
    end if;
  end loop;
  foreach t in array array['tabela_precos','sugestoes_tabela','antiv_badges'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
-- as travas de colunas da masterlist e de pagamentos (C0) continuam valendo: este arquivo só dá privilégio nas tabelas novas
revoke update on public.masterlist from anon, authenticated;
grant update (ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, info_adicionais, na_loja, id_linha) on public.masterlist to anon, authenticated;
revoke update, delete on public.pagamento_demandas from anon, authenticated;
revoke insert, update, delete on public.multas_pagas from anon, authenticated;

-- dados fictícios (cogs ana, bia e gabi já existem no 03_dados_ficticios.sql)
insert into public.mercari_pedidos (joiner_cog, joiner_nome, itens, valor_jpy_total, valor_brl_total, comprovante_url, status) values
  ('ana', 'Ana Fictícia', '[{"nome":"Photocard A","valor_jpy":1000}]', 1000, 40, 'https://exemplo.com/mercari-comprovantes/ana_1.jpg', 'pendente'),
  ('bia', 'Bia Fictícia', '[{"nome":"Photocard B","valor_jpy":2000}]', 2000, 80, 'https://exemplo.com/mercari-comprovantes/bia_1.jpg', 'aprovado');
insert into public.lojinha_repasses (joiner_cog, joiner_nome, nome_card, ceg, valor, whatsapp, status, reservado_para) values
  ('ana', 'Ana Fictícia', 'Item da Ana', 'SKZOO', 50, '11900000001', 'disponivel', null),
  ('bia', 'Bia Fictícia', 'Item da Bia', 'SKZOO', 60, '11900000002', 'disponivel', null),
  ('bia', 'Bia Fictícia', 'Item reservado p/ Ana', 'SKZOO', 70, '11900000002', 'reservado', 'ana'),
  ('gabi', 'Gabi Fictícia', 'Item vendido da Gabi', 'SKZOO', 80, '11900000003', 'vendido', null);
insert into public.repassos (joiner_cog, joiner_nome, novo_dono_cog, novo_dono_nome, nome_do_item, ceg, status, valor_acordado) values
  ('ana', 'Ana Fictícia', 'bia', 'Bia Fictícia', 'Photocard X', 'SKZOO', 'pendente', 30),
  ('gabi', 'Gabi Fictícia', 'ana', 'Ana Fictícia', 'Photocard Y', 'SKZOO', 'aprovado', 40);
insert into public.claim_eventos (nome, valor, abertura, status, membros, limite_por_joiner) values
  ('Evento Fictício', 100, now() - interval '1 day', 'ativo', '["Bang Chan","Lee Know","Changbin"]', 2),
  ('Evento Encerrado', 100, now() - interval '30 days', 'encerrado', '["Bang Chan","Lee Know"]', 2);
insert into public.claim_sets (evento_id, numero, status) values (1, 1, 'aberto'), (2, 1, 'fechado');
insert into public.claim_reservas (evento_id, set_id, joiner_cog, joiner_nome, membro, status, is_admin) values
  (1, 1, 'ana', 'Ana Fictícia Nome Real', 'Bang Chan', 'pendente', false),
  (1, 1, 'nandaverseo_c', 'GOM', 'Lee Know', 'aprovado', true),
  (1, null, 'bia', 'Bia Fictícia Nome Real', 'Changbin', 'standby', false);
insert into public.feedbacks (joiner_cog, joiner_nome, tipo, message, status) values ('ana', 'Ana Fictícia', 'sugestao', 'Feedback da Ana', 'pendente'), ('bia', 'Bia Fictícia', 'elogio', 'Feedback da Bia', 'pendente');
insert into public.notifications (joiner_cog, message, type) values ('ana', 'Aviso para a Ana', 'teste'), ('bia', 'Aviso para a Bia', 'teste');
insert into public.pushes (message, active, joiner_cog) values ('Aviso geral', true, null), ('Aviso só da Ana', true, 'ana'), ('Aviso só da Bia', true, 'bia');
insert into public.push_reads (push_id, joiner_cog) values (1, 'ana');
insert into public.joiner_storage (joiner_cog, foto_url, descricao) values ('ana', 'https://exemplo.com/s1.jpg', 'item da ana'), ('bia', 'https://exemplo.com/s2.jpg', 'item da bia');
insert into public.joiner_conferencias (joiner_cog, prazo_dias) values ('ana', 5);
insert into public.joiner_updates (joiner_cog, campos) values ('ana', '["endereco"]');
insert into public.envio_rounds (numero, status) values (1, 'aberto');
insert into public.envio_requests (joiner_cog, round_id, posicao_no_round, status) values ('ana', 1, 1, 'aguardando'), ('bia', 1, 2, 'aguardando');
insert into public.confirmacoes (joiner_cog, joiner_nome, twitter_novo) values ('ana', 'Ana Fictícia', '@ana_nova');
insert into public.rastreios (codigo, descricao) values ('BR000000001', 'rastreio fictício');
insert into public.estoque_itens (nome, saldo_inicial) values ('Sleeve fictício', 10);
insert into public.estoque_compras (item_id, data_compra, quantidade, valor_total) values (1, current_date, 5, 50);
insert into public.ceg_config (ceg, whatsapp_link) values ('SKZOO', 'https://chat.whatsapp.com/EXEMPLO');
insert into public.item_fotos (ceg, nome_do_item, foto_url, ordem) values ('SKZOO', 'Capa', 'https://exemplo.com/capa.jpg', -1);
insert into public.links_uteis (titulo, url) values ('Link fictício', 'https://exemplo.com');
insert into public.tabela_precos (sheet, categoria, item, preco) values ('Album', 'Fisicos', 'Album fictício', 'R$ 100');
insert into public.sugestoes_tabela (tabela_preco_id, sheet, categoria, item, preco_atual, preco_sugerido, status) values (1, 'Album', 'Fisicos', 'Album fictício', 'R$ 100', 'R$ 110', 'pendente');
insert into public.antiv_badges (joiner_cog, badge_slug) values ('ana', 'veterana'), ('bia', 'novata');
