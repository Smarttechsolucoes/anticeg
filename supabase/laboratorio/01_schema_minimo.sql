-- LABORATÓRIO — esquema mínimo com as tabelas que o acesso das joiners e o J4 tocam, SÓ COM DADOS FICTÍCIOS.
-- Serve para (a) os testes automáticos locais (PGlite) e (b) um projeto Supabase de ENSAIO (gratuito), nunca para a produção.
-- As colunas são as reais do site (levantadas da API/código). Para um ensaio ainda mais fiel, importe o esquema real:
--   supabase db dump --schema public --project-ref <produção> > esquema_real.sql   e aplique no projeto de ensaio ANTES dos dados fictícios.
-- Atenção: rode este arquivo só num banco vazio de ensaio.
create table if not exists public.joiners (
  id bigint primary key, cog text not null, nome text, email text, twitter text, whatsapp text, foto_perfil text,
  last_seen timestamptz, bloqueado boolean default false, confirmado boolean default false, last_notified_at timestamptz, saldo_cashback numeric default 0,
  nome_site text, cep text, rua text, numero text, complemento text, bairro text, cidade text, estado text, nome_entrega text, cpf text, telefone text, recrutador text
);
create table if not exists public.masterlist (
  id bigint primary key, ceg text, cog text, nome text, nome_do_item text, valor_item numeric default 0, frete_inter numeric default 0, taxa_rf numeric default 0,
  status text, info_adicionais text, na_loja boolean default false, id_linha text, pago_item boolean default false, pago_frete boolean default false, pago_rf boolean default false,
  pag_item text, pag_frete text, pag_taxa text, venc_item date, venc_frete date, venc_rf date, venc_taxa date
);
create table if not exists public.pagamento_demandas (
  id bigint generated always as identity primary key, joiner_cog text, itens jsonb, valor_total numeric, comprovante_url text, obs text,
  status text default 'em_analise', created_at timestamptz default now(), cashback_aplicado numeric, motivo_rejeicao text
);
create table if not exists public.multas_pagas (
  id bigint generated always as identity primary key, joiner_cog text not null, masterlist_id bigint not null, campo text not null, dias_atraso int not null, valor_multa numeric not null, created_at timestamptz default now()
);
create table if not exists public.claims (
  id bigint generated always as identity primary key, joiner_cog text, joiner_nome text, masterlist_id bigint, ceg text, nome_do_item text, valor numeric, status text default 'pendente', vencimento date, created_at timestamptz default now()
);
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key, joiner_cog text, endpoint text, p256dh text, auth text
);
create table if not exists public.config (id bigint generated always as identity primary key, key text unique not null, value text);
create table if not exists public.cal_eventos (id bigint generated always as identity primary key, data date, titulo text);
