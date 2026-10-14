-- LABORATÓRIO — tabelas das lojas públicas e formulários (colunas principais das reais), com as políticas ABERTAS de hoje e dados FICTÍCIOS.
-- Só para banco de ensaio. Rode depois do 05_travas_c0_simuladas.sql.
create table if not exists public.pedidos_revista (id bigint generated always as identity primary key, nome text not null, email text not null, social text, versao_regular int default 0, versao_guys int default 0, qtd_total int default 0, valor_total numeric default 0, forma_pagamento text, comprovante_url text, status text not null default 'aguardando', created_at timestamptz not null default now());
create table if not exists public.pedidos_popup (id bigint generated always as identity primary key, claim text, nome text not null, email text not null, social text, week text, itens jsonb default '[]', status text not null default 'pendente', created_at timestamptz not null default now());
create table if not exists public.pedidos_wmag (id bigint generated always as identity primary key, nome text not null, email text not null, social text, capa_a int default 0, capa_b int default 0, capa_c int default 0, qtd_total int default 0, valor_total numeric default 0, forma_pagamento text, comprovante_url text, status text not null default 'aguardando', created_at timestamptz not null default now());
create table if not exists public.pedidos_wmag_leeknow (like public.pedidos_wmag including all);
create table if not exists public.pedidos_smolmerch (id uuid primary key default gen_random_uuid(), nome text not null, email text not null, social text, itens jsonb not null default '[]', qtd_total int not null default 0, valor_total numeric not null default 0, forma_pagamento text, comprovante_url text, status text not null default 'aguardando', created_at timestamptz not null default now());
create table if not exists public.pedidos_bazaar_in (id bigint generated always as identity primary key, nome text not null, email text not null, social text, capa_a int default 0, capa_b int default 0, capa_c int default 0, caixa_f int default 0, caixa_g int default 0, qtd_total int default 0, valor_total numeric default 0, forma_pagamento text, comprovante_url text, status text not null default 'aguardando', membros_grupo jsonb, created_at timestamptz not null default now());
create table if not exists public.pedidos_lightstick (id bigint generated always as identity primary key, nome text not null, contato text not null, joiner_cog text, metodo_pagamento text, comprovante_url text, status text not null default 'aguardando', created_at timestamptz not null default now());
create table if not exists public.pedidos_popcorn_sleeve (id bigint generated always as identity primary key, nome text not null, contato text not null, joiner_cog text, comprovante_url text, status text not null default 'aguardando', metodo_pagamento text, quantidade int, valor_total numeric, created_at timestamptz not null default now());
create table if not exists public.pedidos_singba (id bigint generated always as identity primary key, nome text not null, contato text not null, joiner_cog text, comprovante_url text, status text not null default 'aguardando', metodo_pagamento text not null default 'pix', itens jsonb not null default '[]', quantidade int not null default 0, valor_total numeric, created_at timestamptz not null default now());
create table if not exists public.pedidos_skzoo_rio (id bigint generated always as identity primary key, cog text, nome text, itens jsonb, envio text, pagamento text, total_reais numeric, status text default 'pendente', created_at timestamptz not null default now());
create table if not exists public.formulario_pedidos (id bigint generated always as identity primary key, evento text not null, joiner_cog text, joiner_nome text, joiner_email text, modalidade text, observacoes text, status text not null default 'pendente', created_at timestamptz not null default now());
do $$
declare t text;
begin
  foreach t in array array['pedidos_revista','pedidos_popup','pedidos_wmag','pedidos_wmag_leeknow','pedidos_smolmerch','pedidos_bazaar_in','pedidos_lightstick','pedidos_popcorn_sleeve','pedidos_singba','pedidos_skzoo_rio','formulario_pedidos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy anon_all on public.%I for all to anon using (true) with check (true)', t);   -- como hoje: aberto ao visitante
    execute format('grant all on table public.%I to anon, authenticated, service_role', t);                    -- só estas tabelas (não mexe nas travas C0 da masterlist)
  end loop;
end $$;
-- dados fictícios
insert into public.pedidos_revista (nome, email, qtd_total, valor_total, status) values ('Cliente Um', 'cliente1@exemplo.com', 1, 100, 'aguardando'), ('Ana Fictícia', 'ana@exemplo.com', 2, 200, 'confirmado');
insert into public.pedidos_popup (nome, email, week, status) values ('Cliente Dois', 'cliente2@exemplo.com', '01', 'pendente'), ('Ana Fictícia', 'ana@exemplo.com', '02', 'pendente');
insert into public.pedidos_smolmerch (nome, email, qtd_total, valor_total, status) values ('Cliente Três', 'cliente3@exemplo.com', 1, 50, 'aguardando');
insert into public.pedidos_lightstick (nome, contato, joiner_cog, status) values ('Ana Fictícia', 'ana@exemplo.com', 'ana', 'aguardando'), ('Bia Fictícia', 'bia@exemplo.com', 'bia', 'aguardando'), ('Ela M', 'ela1@exemplo.com', 'Ela', 'aguardando'), ('ela m', 'ela2@exemplo.com', 'ela', 'aguardando');
insert into public.pedidos_skzoo_rio (cog, nome, total_reais, status) values ('ana', 'Ana Fictícia', 80, 'pendente'), ('bia', 'Bia Fictícia', 90, 'pendente');
insert into public.formulario_pedidos (evento, joiner_cog, joiner_nome, joiner_email, modalidade, observacoes, status) values
  ('WAVE MAKER - SG JAPAN 2027', 'ana', 'Ana Fictícia', 'ana@exemplo.com', 'Retirada', 'Qtd: 2 · endereço secreto da ana', 'pendente'),
  ('WAVE MAKER - SG JAPAN 2027', 'bia', 'Bia Fictícia', 'bia@exemplo.com', 'Envio', 'Qtd: 1', 'confirmado'),
  ('WAVE MAKER - SG JAPAN 2027', 'Ela', 'Ela M', 'ela1@exemplo.com', 'Envio', 'Qtd: 3', 'pendente'),
  ('WAVE MAKER - SG JAPAN 2027', 'ela', 'ela m', 'ela2@exemplo.com', 'Envio', 'Qtd: 4', 'pendente');
