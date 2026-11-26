-- E1 — CONFERÊNCIA ANTES DE APLICAR (SOMENTE LEITURA). Rode no SQL Editor do Supabase e me mande o resultado: ele diz se o banco de produção está como o E1 espera
-- (J1d, J4c1 e J6 aplicados; E1 ainda NÃO aplicado) para não reaplicar nada. Não altera nada, não mostra dado pessoal.
select 'tabela ' || t.nome as item, (to_regclass('public.' || t.nome) is not null)::text as valor, 'esperado true' as nota
from (values ('perfil_sync_pendente'), ('joiner_perfil_historico'), ('perfil_solicitacoes'), ('contas_joiner')) t(nome)
union all select 'coluna contas_joiner.perfil_concluido_em', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contas_joiner' and column_name = 'perfil_concluido_em')::text, 'esperado true'
union all select 'função ' || f.assin, (to_regprocedure(f.assin) is not null)::text, f.nota
from (values ('emergencia.papel_confiavel()', 'esperado true'), ('emergencia.h_arroba(text)', 'esperado true'), ('public.trg_joiners_protege_colunas()', 'esperado true'),
             ('emergencia.auth_email_depois()', 'esperado true'), ('public.perfil_sync_proximos(integer)', 'esperado true'), ('public.perfil_sync_marcar(bigint,boolean,text)', 'esperado true'),
             ('public.solicitar_correcao_perfil(text,text,text)', 'esperado true'), ('public.perfil_sync_estado(bigint)', 'esperado FALSE (é do E1)'),
             ('public.salvar_meu_cadastro(text)', 'esperado FALSE (é do E1)'), ('public.solicitar_alteracao_sem_login(text,text,text,text)', 'esperado FALSE (é do E1)')) f(assin, nota)
union all select 'gatilho em joiners: ' || g.nome, exists (select 1 from pg_trigger where tgrelid = 'public.joiners'::regclass and tgname = g.nome and not tgisinternal)::text, g.nota
from (values ('trg_joiners_protege_colunas', 'esperado true'), ('joiners_historico', 'esperado true'), ('joiners_antes_trocar_identidade', 'esperado true'), ('joiners_tarefa_cadastro', 'esperado FALSE (é do E1)')) g(nome, nota)
union all select 'gatilho em auth.users: anticeg_auth_email_depois', exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'anticeg_auth_email_depois')::text, 'esperado true'
union all select 'tabela cadastro_tarefas (E1)', (to_regclass('public.cadastro_tarefas') is not null)::text, 'esperado FALSE (E1 ainda não aplicado)'
union all select 'trava de colunas tem o texto que o E1 troca',
       (pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure) ~ 'if \(to_jsonb\(new\) - permitidas\) is distinct from \(to_jsonb\(old\) - permitidas\) then')::text, 'esperado true'
where to_regprocedure('public.trg_joiners_protege_colunas()') is not null
union all select 'trava de colunas já tem a exceção do E1', (pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure) ~ 'anticeg.salvar_cadastro')::text, 'esperado FALSE'
where to_regprocedure('public.trg_joiners_protege_colunas()') is not null
union all select 'restrição de tipo em perfil_sync_pendente', coalesce((select string_agg(pg_get_constraintdef(oid), ' ; ') from pg_constraint where conrelid = 'public.perfil_sync_pendente'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M'), '-'), 'esperado: tipo in (email)'
where to_regclass('public.perfil_sync_pendente') is not null
union all select 'restrição de tipo em perfil_solicitacoes', coalesce((select string_agg(pg_get_constraintdef(oid), ' ; ') from pg_constraint where conrelid = 'public.perfil_solicitacoes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M'), '-'), 'esperado: arroba, email, outro, ativacao_*'
where to_regclass('public.perfil_solicitacoes') is not null
union all select 'fila perfil_sync_pendente: ' || coalesce(p.tipo, '?') || ' / ' || coalesce(p.status, '?'), count(*)::text, 'só contagem' from public.perfil_sync_pendente p group by p.tipo, p.status
union all select 'extensões pg_cron / pg_net', (select string_agg(extname, ',') from pg_extension where extname in ('pg_cron', 'pg_net')), 'só para o agendador por banco (plano B); o agendador do Apps Script não precisa'
order by 1;
