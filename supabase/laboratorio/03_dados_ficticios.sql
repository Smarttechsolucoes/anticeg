-- LABORATÓRIO — dados FICTÍCIOS que cobrem os casos reais do cadastro (e-mail ausente, inválido, repetido, COG com maiúscula...).
-- Todos os e-mails usam o domínio de exemplo "exemplo.com"; nada aqui é de gente real.
insert into public.joiners (id, cog, nome, nome_site, email, twitter, whatsapp, cep, rua, numero, bairro, cidade, estado, cpf, saldo_cashback, recrutador) values
  (1,  'ana',      'Ana Fictícia',   'Ana',    'ana@exemplo.com',        '@ana',    '11900000001', '01000-000', 'Rua Falsa',   '10', 'Centro', 'São Paulo', 'SP', '000.000.000-01', 12.5, null),
  (2,  'bia',      'Bia Fictícia',   'Bia',    'bia.antiga@exemplo.com', '@bia',    '11900000002', '02000-000', 'Rua Teste',   '20', 'Centro', 'São Paulo', 'SP', '000.000.000-02', 0,    'ana'),
  (3,  'cris',     'Cris Fictícia',  'Cris',   null,                     '@cris',   '11900000003', '03000-000', 'Rua Mock',    '30', 'Centro', 'Santos',    'SP', '000.000.000-03', 0,    null),
  (4,  'duda',     'Duda Fictícia',  'Duda',   'duda-sem-arroba',        '@duda',   '11900000004', '04000-000', 'Rua Nada',    '40', 'Centro', 'Campinas',  'SP', '000.000.000-04', 0,    null),
  (5,  'casal1',   'Casal Um',       'Casal1', 'casal@exemplo.com',      '@casal1', '11900000005', '05000-000', 'Rua Dupla',   '50', 'Centro', 'Niterói',   'RJ', '000.000.000-05', 0,    null),
  (6,  'casal2',   'Casal Dois',     'Casal2', 'CASAL@exemplo.com',      '@casal2', '11900000006', '05000-000', 'Rua Dupla',   '50', 'Centro', 'Niterói',   'RJ', '000.000.000-06', 0,    null),
  (7,  'Ela',      'Ela Maiúscula',  'Ela',    'ela@exemplo.com',        '@Ela',    '11900000007', '07000-000', 'Rua Caixa',   '70', 'Centro', 'Recife',    'PE', '000.000.000-07', 0,    null),
  (8,  'ela',      'Ela Minúscula',  'Ela Dois','ela2@exemplo.com',      '@ela',    '11900000008', '08000-000', 'Rua Caixa',   '80', 'Centro', 'Recife',    'PE', '000.000.000-08', 0,    null),
  (9,  'gabi',     'Gabi Fictícia',  'Gabi',   'gabi@exemplo.com',       '@gabi',   '11900000009', '09000-000', 'Rua Gabi',    '90', 'Centro', 'Natal',     'RN', '000.000.000-09', 0,    null),
  (10, 'fabi',     'Fabi Fictícia',  'Fabi',   'fabi@exemplo.com',       '@fabi',   '11900000010', '10000-000', 'Rua Fabi',   '100', 'Centro', 'Natal',     'RN', '000.000.000-10', 3,    null),
  (255010, 'bloq', 'Bloqueada Fict', 'Bloq',   'bloq@exemplo.com',       '@bloq',   '11900000011', '11000-000', 'Rua Bloq',   '110', 'Centro', 'Belém',     'PA', '000.000.000-11', 0,    null);
update public.joiners set bloqueado = true where id = 255010;

insert into public.masterlist (id, ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, na_loja, pago_item, venc_item) values
  (1,  'SKZOO', 'ana',        'Ana Fictícia', 'Photocard A',  50, 10, 0, 'A Caminho',  false, false, current_date - 5),
  (2,  'SKZOO', 'ana',        'Ana Fictícia', 'Photocard B',  30, 0,  0, 'Comprado',   false, true,  current_date - 40),
  (3,  'SKZOO', 'bia',        'Bia Fictícia', 'Photocard C',  45, 0,  5, 'Comprado',   false, false, current_date + 5),
  (4,  'CLAIM', 'disponivel', 'disponivel',   'Set Fictício · Membro 1', 20, 0, 0, 'Comprado', true, false, null),
  (5,  'CLAIM', 'disponivel', 'disponivel',   'Set Fictício · Membro 2', 20, 0, 0, 'Comprado', true, false, null),
  (6,  'SKZOO', 'Ela',        'Ela Maiúscula','Photocard D',  60, 0,  0, 'Comprado',   false, false, current_date + 9);

insert into public.pagamento_demandas (joiner_cog, itens, valor_total, comprovante_url, obs, status) values
  ('ana', '[{"id":1,"nome_do_item":"Photocard A","ceg":"SKZOO","valor_item":50}]', 50, 'https://exemplo.invalid/comprovantes/ana/1.png', null, 'pago'),
  ('bia', '[{"id":3,"nome_do_item":"Photocard C","ceg":"SKZOO","valor_item":45}]', 45, 'https://exemplo.invalid/comprovantes/bia/1.png', 'Código da transação: FICTICIO123', 'em_analise');
insert into public.multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa) values ('ana', 2, 'item', 3, 3), ('bia', 3, 'item', 1, 1);
insert into public.claims (joiner_cog, joiner_nome, masterlist_id, ceg, nome_do_item, valor, status) values ('ana', 'Ana Fictícia', 4, 'CLAIM', 'Set Fictício · Membro 1', 20, 'aprovado');
insert into public.push_subscriptions (joiner_cog, endpoint, p256dh, auth) values ('ana', 'https://fcm.googleapis.com/fcm/send/ficticio-ana', 'p256dh-ficticio', 'auth-ficticio'), ('bia', 'https://fcm.googleapis.com/fcm/send/ficticio-bia', 'p256dh-ficticio', 'auth-ficticio');
insert into public.config (key, value) values ('manutencao', 'false'), ('aviso_masterlist', 'Aviso fictício'), ('admin_pin', '000000');
insert into public.cal_eventos (data, titulo) values (current_date + 7, 'Evento fictício');
