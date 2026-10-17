-- R1 — PRÉ-CHECAGEM DAS SUPOSIÇÕES SOBRE O AMBIENTE REAL (SOMENTE LEITURA; um SELECT; não altera nada; só nomes, contagens e true/false, nenhum dado de joiner).
-- Rode ANTES do R1_admin_pagamentos_aplicar.sql. Os testes locais (PGlite) não são o Supabase: aqui se confere, no banco real, o que o R1 e o teste de permissões ASSUMEM.
select 1 as ordem, 'papel que executa este script (esperado: postgres no SQL Editor)' as item, current_user::text as valor, 'informativo; o aplicar fixa o dono das funções como postgres' as esperado
union all select 2, 'este papel pode trocar para anon (SET ROLE) — o teste de permissões precisa', pg_has_role(current_user, 'anon', 'member')::text, 'true'
union all select 3, 'este papel pode trocar para authenticated (SET ROLE)', pg_has_role(current_user, 'authenticated', 'member')::text, 'true'
union all select 4, 'auth.uid() lê request.jwt.claim.sub ou request.jwt.claims (o teste define os dois)',
       coalesce((select (pg_get_functiondef(p.oid) ~* 'request\.jwt\.claim')::text from pg_proc p where p.pronamespace = 'auth'::regnamespace and p.proname = 'uid' limit 1), 'auth.uid não existe'), 'true'
union all select 5, 'is_admin() é security definer e consulta admin_roles',
       coalesce((select (p.prosecdef and pg_get_functiondef(p.oid) ~* 'admin_roles')::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'is_admin' limit 1), 'is_admin não existe'), 'true'
union all select 6, 'dono de public.pagamento_demandas', (select pg_get_userbyid(relowner)::text from pg_class where oid = 'public.pagamento_demandas'::regclass), 'postgres'
union all select 7, 'dono de public.masterlist', (select pg_get_userbyid(relowner)::text from pg_class where oid = 'public.masterlist'::regclass), 'postgres'
union all select 8, 'postgres consegue ATUALIZAR masterlist.pago_item / pago_frete / pago_rf (as funções gravam como dono)',
       (has_column_privilege('postgres', 'public.masterlist', 'pago_item', 'UPDATE') and has_column_privilege('postgres', 'public.masterlist', 'pago_frete', 'UPDATE') and has_column_privilege('postgres', 'public.masterlist', 'pago_rf', 'UPDATE'))::text, 'true'
union all select 9, 'postgres consegue ATUALIZAR pagamento_demandas.status e motivo_rejeicao',
       (has_column_privilege('postgres', 'public.pagamento_demandas', 'status', 'UPDATE') and has_column_privilege('postgres', 'public.pagamento_demandas', 'motivo_rejeicao', 'UPDATE'))::text, 'true'
union all select 10, 'tipo de pagamento_demandas.itens (o aplicar exige jsonb)', (select format_type(atttypid, atttypmod) from pg_attribute where attrelid = 'public.pagamento_demandas'::regclass and attname = 'itens' and not attisdropped), 'jsonb'
union all select 11, 'demandas cujo itens NÃO é uma lista (esperado 0; só contagem)', coalesce((select count(*)::text from public.pagamento_demandas where jsonb_typeof(itens::jsonb) is distinct from 'array'), '?'), '0'
union all select 12, 'CHECK constraints de pagamento_demandas (confira se aceitam pago, em_analise e rejeitado)',
       coalesce((select string_agg(pg_get_constraintdef(oid), ' ; ') from pg_constraint where conrelid = 'public.pagamento_demandas'::regclass and contype = 'c'), '(nenhum)'), 'nenhum, ou que inclua os 3 status'
union all select 13, 'gatilhos LIGADOS em masterlist / pagamento_demandas / multas_pagas',
       coalesce((select string_agg(c.relname || '.' || t.tgname, ', ' order by c.relname, t.tgname) from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal and t.tgenabled <> 'D' and t.tgrelid in ('public.masterlist'::regclass, 'public.pagamento_demandas'::regclass, 'public.multas_pagas'::regclass)), '(nenhum)'), 'só masterlist.trg_registrar_multa_paga'
union all select 14, 'corpo do gatilho de multa sem HTTP/NOTIFY/dblink/pg_net',
       coalesce((select (pg_get_functiondef(p.oid) !~* '(net\.|http_|pg_notify|\mnotify\M|dblink|pg_net|supabase_functions)')::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'registrar_multa_paga' limit 1), 'função não existe'), 'true'
union all select 15, 'regras (RULE) nas tabelas tocadas', (select count(*)::text from pg_rewrite r where r.ev_class in ('public.masterlist'::regclass, 'public.pagamento_demandas'::regclass, 'public.multas_pagas'::regclass) and r.rulename <> '_RETURN'), '0'
union all select 16, 'privilégios padrão (ACL) para novas funções em public (informativo: é por isso que o aplicar faz REVOKE explícito)',
       coalesce((select string_agg(defaclacl::text, ' ; ') from pg_default_acl where defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'), '(nenhum)'), 'informativo'
union all select 17, 'administradoras em admin_roles', (select count(*)::text from public.admin_roles), '2 ou mais'
order by 1;
