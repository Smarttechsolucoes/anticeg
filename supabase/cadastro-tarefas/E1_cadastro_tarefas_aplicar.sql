-- E1 — TAREFAS DE CADASTRO (etapa 1): a joiner salva -> o banco confirma -> nasce UMA tarefa em Atualizações -> a fila leva nome/e-mail à aba Dados.
-- PREPARADO, NÃO APLICADO. Pré-requisitos já em produção: J1d, J4c1, J6. Uma transação; se algo falhar: "Nada foi alterado.".
-- O que muda (resumo): (1) tabela cadastro_tarefas (estado da PLANILHA separado do estado de LEITURA); (2) gatilho em joiners (nome e e-mail) que cria/atualiza a tarefa na MESMA transação da gravação;
-- (3) fila perfil_sync_pendente aceita tipo 'cadastro' e liga ao registro da tarefa; perfil_sync_marcar passa a atualizar a MESMA tarefa a cada tentativa; (4) salvar_meu_cadastro (nome cadastral) com exceção
-- ESTREITA no gatilho de proteção (só 'nome', só dentro da função); (5) pedido de alteração do login legado (sem sessão) que NUNCA altera o cadastro; (6) funções do painel.
-- NÃO muda: cog, itens, pagamentos, claims, vínculo da conta, e-mail confirmado pelo Auth (continua o único caminho de troca de e-mail da conta ativada). NÃO ativa agendador (arquivo à parte).
begin;
create schema if not exists emergencia;

do $$
begin
  if to_regclass('public.perfil_sync_pendente') is null or to_regclass('public.joiner_perfil_historico') is null or to_regclass('public.perfil_solicitacoes') is null then raise exception 'J6 não está aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('emergencia.papel_confiavel()') is null or to_regprocedure('emergencia.h_arroba(text)') is null then raise exception 'J1d não está aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.trg_joiners_protege_colunas()') is null then raise exception 'J4c1 não está aplicado. Nada foi alterado.'; end if;
  if to_regclass('public.cadastro_tarefas') is not null then raise exception 'E1 já foi aplicado. Nada foi alterado.'; end if;
  if pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure) !~ 'if \(to_jsonb\(new\) - permitidas\) is distinct from \(to_jsonb\(old\) - permitidas\) then' then raise exception 'O gatilho de proteção de colunas está diferente do esperado. Nada foi alterado.'; end if;
end $$;

-- cópia do estado anterior (para a reversão)
create table if not exists emergencia.c0b_estado_anterior (id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('E1', 'funcao trg_joiners_protege_colunas', pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure)),
  ('E1', 'funcao auth_email_depois', pg_get_functiondef('emergencia.auth_email_depois()'::regprocedure)),
  ('E1', 'funcao perfil_sync_marcar', pg_get_functiondef('public.perfil_sync_marcar(bigint, boolean, text)'::regprocedure));

-- 1) a fila aceita o tipo 'cadastro' e aponta para a tarefa; o pedido à administração aceita 'nome' e a marca "sem prova"
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.perfil_sync_pendente'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M' loop
    execute format('alter table public.perfil_sync_pendente drop constraint %I', c.conname);
  end loop;
  for c in select conname from pg_constraint where conrelid = 'public.perfil_solicitacoes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M' loop
    execute format('alter table public.perfil_solicitacoes drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.perfil_sync_pendente add constraint perfil_sync_pendente_tipo_check check (tipo in ('email', 'cadastro'));
alter table public.perfil_sync_pendente add column tarefa_id bigint;
alter table public.perfil_solicitacoes add constraint perfil_solicitacoes_tipo_check check (tipo in ('arroba', 'email', 'nome', 'outro', 'ativacao_sem_vinculo', 'ativacao_ajuda'));
alter table public.perfil_solicitacoes add column sem_prova boolean not null default false;

-- 2) a tarefa de cadastro
create table public.cadastro_tarefas (
  id bigint generated always as identity primary key,
  joiner_id bigint not null,
  tipo text not null check (tipo in ('alteracao', 'solicitacao')),
  txid bigint,                                    -- um salvamento (uma transação) = uma tarefa por tipo
  campos jsonb not null,                          -- {"nome": {"de": "...", "para": "..."}, "email": {...}} | {"nome": {"pedido": "..."}}
  origem text not null check (origem in ('site', 'conta_verificada', 'administracao_ou_servidor', 'solicitacao_conta', 'solicitacao_sem_prova')),
  planilha_status text not null default 'pendente' check (planilha_status in ('pendente', 'sincronizada', 'atencao', 'nao_se_aplica')),
  planilha_motivo text, planilha_tentativas integer not null default 0, planilha_ultimo_erro text, planilha_sincronizada_em timestamptz,
  atencao_desde timestamptz, atencao_vista_em timestamptz,
  lida_em timestamptz, lida_por uuid,
  resolvida_em timestamptz, resolvida_por uuid, nota text,
  fila_id bigint, solicitacao_id bigint,
  criado_em timestamptz not null default now()
);
create unique index cadastro_tarefas_por_gravacao on public.cadastro_tarefas (joiner_id, txid, tipo) where txid is not null;
create unique index cadastro_tarefas_por_solicitacao on public.cadastro_tarefas (solicitacao_id) where solicitacao_id is not null;
create index cadastro_tarefas_recentes on public.cadastro_tarefas (criado_em desc);
alter table public.cadastro_tarefas enable row level security;
revoke all on table public.cadastro_tarefas from public, anon, authenticated;
grant select, insert, update on table public.cadastro_tarefas to service_role;
-- só a administração lê (as funções do painel também checam; esta política protege o acesso direto)
grant select on table public.cadastro_tarefas to authenticated;
create policy cadastro_tarefas_admin on public.cadastro_tarefas for select to authenticated using ((select public.is_admin()));

-- regra de pendência (UM lugar só): ainda não lida OU falha da planilha que precisa de intervenção e ainda não vista
create function emergencia.tarefa_pendente(t public.cadastro_tarefas) returns boolean language sql immutable set search_path = '' as $$
  select t.resolvida_em is null and (t.lida_em is null or (t.planilha_status = 'atencao' and (t.atencao_vista_em is null or t.atencao_vista_em < t.atencao_desde)))
$$;
revoke all on function emergencia.tarefa_pendente(public.cadastro_tarefas) from public, anon, authenticated;

-- 3) gatilho: a tarefa nasce na mesma transação da gravação (todos os caminhos: site, conta verificada, administração). Só NOME e E-MAIL; a troca de @ fica de fora (etapa 2: alias) e entra por PEDIDO (item 4).
create function emergencia.joiners_tarefa_cadastro() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_origem text; v_uid uuid := (select auth.uid()); v_tx bigint := txid_current();
  v_campos jsonb := '{}'::jsonb; v_admin boolean := false; v_id bigint; v_fila bigint;
begin
  v_origem := case when coalesce(current_setting('anticeg.perfil_autorizado', true), '') = '1' then 'conta_verificada' when emergencia.papel_confiavel() then 'administracao_ou_servidor' else 'site' end;
  v_admin := v_uid is not null and (select public.is_admin());
  if new.nome is distinct from old.nome then v_campos := v_campos || jsonb_build_object('nome', jsonb_build_object('de', old.nome, 'para', new.nome)); end if;
  if lower(btrim(coalesce(new.email, ''))) is distinct from lower(btrim(coalesce(old.email, ''))) then v_campos := v_campos || jsonb_build_object('email', jsonb_build_object('de', old.email, 'para', new.email)); end if;
  if v_campos <> '{}'::jsonb then
    select t.id into v_id from public.cadastro_tarefas t where t.joiner_id = new.id and t.txid = v_tx and t.tipo = 'alteracao';
    if v_id is null then
      insert into public.cadastro_tarefas (joiner_id, tipo, txid, campos, origem, planilha_status, lida_em, lida_por)
      values (new.id, 'alteracao', v_tx, v_campos, v_origem, 'pendente', case when v_admin then now() end, case when v_admin then v_uid end) returning id into v_id;
      insert into public.perfil_sync_pendente (joiner_id, tipo, dados, tarefa_id) values (new.id, 'cadastro', jsonb_build_object('tarefa_id', v_id), v_id) returning id into v_fila;
      update public.cadastro_tarefas set fila_id = v_fila where id = v_id;
    else
      -- mais de uma atualização na mesma gravação: mantém o "de" do primeiro e acrescenta o "para" mais novo
      update public.cadastro_tarefas t set campos = (
        select jsonb_object_agg(k, case when t.campos ? k and v_campos ? k then jsonb_build_object('de', t.campos -> k -> 'de', 'para', v_campos -> k -> 'para') when v_campos ? k then v_campos -> k else t.campos -> k end)
          from (select jsonb_object_keys(t.campos || v_campos) as k) x) where t.id = v_id;
    end if;
  end if;
  return null;
end $$;
revoke all on function emergencia.joiners_tarefa_cadastro() from public, anon, authenticated;
create trigger joiners_tarefa_cadastro after update of nome, email on public.joiners for each row execute function emergencia.joiners_tarefa_cadastro();

-- o e-mail confirmado no Auth passa a gerar a tarefa pelo gatilho de joiners (não mais um item solto na fila)
create or replace function emergencia.auth_email_depois() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_j bigint;
begin
  if new.email is distinct from old.email and new.email_confirmed_at is not null then
    select c.joiner_id into v_j from public.contas_joiner c where c.user_id = new.id;
    if v_j is not null then
      perform set_config('anticeg.perfil_autorizado', '1', true);
      update public.joiners set email = lower(btrim(new.email)) where id = v_j and lower(btrim(coalesce(email, ''))) is distinct from lower(btrim(new.email));
      perform set_config('anticeg.perfil_autorizado', '', true);
    end if;
  end if;
  return null;
end $$;

-- 4) pedidos à administração também viram tarefa (conta logada ou login legado)
create function emergencia.solicitacao_vira_tarefa() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo in ('nome', 'arroba', 'email', 'outro') and new.joiner_id is not null then
    insert into public.cadastro_tarefas (joiner_id, tipo, campos, origem, planilha_status, solicitacao_id)
    values (new.joiner_id, 'solicitacao', jsonb_build_object(new.tipo, jsonb_build_object('pedido', new.valor_pedido, 'mensagem', new.mensagem)),
            case when new.sem_prova then 'solicitacao_sem_prova' else 'solicitacao_conta' end, 'nao_se_aplica', new.id)
    on conflict (solicitacao_id) where solicitacao_id is not null do nothing;
  end if;
  return null;
end $$;
revoke all on function emergencia.solicitacao_vira_tarefa() from public, anon, authenticated;
create trigger solicitacao_vira_tarefa after insert on public.perfil_solicitacoes for each row execute function emergencia.solicitacao_vira_tarefa();
create function emergencia.solicitacao_encerra_tarefa() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('resolvida', 'recusada') and old.status = 'aberta' then
    update public.cadastro_tarefas set resolvida_em = coalesce(resolvida_em, now()), resolvida_por = new.resolvido_por, nota = coalesce(nota, new.nota), lida_em = coalesce(lida_em, now()) where solicitacao_id = new.id;
  end if;
  return null;
end $$;
revoke all on function emergencia.solicitacao_encerra_tarefa() from public, anon, authenticated;
create trigger solicitacao_encerra_tarefa after update of status on public.perfil_solicitacoes for each row execute function emergencia.solicitacao_encerra_tarefa();

-- 5) fila: cada tentativa atualiza a MESMA tarefa
create function public.perfil_sync_marcar(p_id bigint, p_ok boolean, p_erro text, p_definitivo boolean) returns void language plpgsql security definer set search_path = '' as $$
declare v_t bigint; v_tent integer; v_def boolean := coalesce(p_definitivo, false) and not coalesce(p_ok, false); v_atencao boolean;
begin
  update public.perfil_sync_pendente set
         tentativas = case when v_def then greatest(tentativas + 1, 6) else tentativas + 1 end, tentado_em = now(),
         status = case when p_ok then 'enviado' else 'falhou' end, enviado_em = case when p_ok then now() else enviado_em end,
         ultimo_erro = case when p_ok then null else left(coalesce(p_erro, 'erro'), 300) end
   where id = p_id returning tarefa_id, tentativas into v_t, v_tent;
  if v_t is null then return; end if;
  v_atencao := not p_ok and (v_def or v_tent >= 6);
  update public.cadastro_tarefas t set
         planilha_tentativas = t.planilha_tentativas + 1,
         planilha_ultimo_erro = case when p_ok then null else left(coalesce(p_erro, 'erro'), 300) end,
         planilha_motivo = case when p_ok then null when v_atencao then left(btrim(split_part(coalesce(p_erro, 'erro'), ':', 1)), 80) else t.planilha_motivo end,
         planilha_sincronizada_em = case when p_ok then now() else t.planilha_sincronizada_em end,
         planilha_status = case when p_ok then 'sincronizada' when v_atencao then 'atencao' else 'pendente' end,
         atencao_desde = case when v_atencao and t.planilha_status <> 'atencao' then now() else t.atencao_desde end
   where t.id = v_t;
end $$;
create or replace function public.perfil_sync_marcar(p_id bigint, p_ok boolean, p_erro text) returns void language sql security definer set search_path = '' as $$
  select public.perfil_sync_marcar(p_id, p_ok, p_erro, false)
$$;
revoke all on function public.perfil_sync_marcar(bigint, boolean, text, boolean), public.perfil_sync_marcar(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.perfil_sync_marcar(bigint, boolean, text, boolean), public.perfil_sync_marcar(bigint, boolean, text) to service_role;

-- o que a função perfil-sync envia: o ESTADO atual do cadastro (nome/e-mail) e quais campos a tarefa trouxe; a versão é o número da tarefa (alteração antiga não sobrescreve a nova)
create function public.perfil_sync_estado(p_tarefa_id bigint) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id_site', j.id, 'twitter', j.twitter, 'nome', j.nome, 'email', lower(btrim(coalesce(j.email, ''))), 'versao', t.id,
         'campos', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(t.campos) k where k in ('nome', 'email')))
    from public.cadastro_tarefas t join public.joiners j on j.id = t.joiner_id where t.id = p_tarefa_id and t.tipo = 'alteracao'
$$;
revoke all on function public.perfil_sync_estado(bigint) from public, anon, authenticated;
grant execute on function public.perfil_sync_estado(bigint) to service_role;

-- 6) salvar o nome cadastral (conta ativada): o banco só diz "ok" depois de gravar, e devolve o valor gravado
create function public.salvar_meu_cadastro(p_nome text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_j bigint; v_concluido timestamptz; v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'); v_gravado text; v_tarefa bigint;
begin
  if v_uid is null then raise exception 'entre na sua conta'; end if;
  select c.joiner_id, c.perfil_concluido_em into v_j, v_concluido from public.contas_joiner c where c.user_id = v_uid;
  if v_j is null then raise exception 'esta conta ainda não está vinculada a um cadastro'; end if;
  if v_concluido is null then raise exception 'conclua o seu perfil antes de alterar o cadastro'; end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 80 or v_nome ~ '[<>\u0000-\u001f]' then raise exception 'nome inválido: use de 2 a 80 caracteres, sem < > nem caracteres de controle'; end if;
  perform set_config('anticeg.salvar_cadastro', '1', true);
  update public.joiners set nome = v_nome where id = v_j returning nome into v_gravado;
  perform set_config('anticeg.salvar_cadastro', '', true);
  if v_gravado is distinct from v_nome then raise exception 'não foi possível gravar; nada foi alterado'; end if;
  select t.id into v_tarefa from public.cadastro_tarefas t where t.joiner_id = v_j and t.txid = txid_current() and t.tipo = 'alteracao';
  return jsonb_build_object('ok', true, 'nome', v_gravado, 'alterou', v_tarefa is not null, 'tarefa_id', v_tarefa);
end $$;
revoke all on function public.salvar_meu_cadastro(text) from public, anon;
grant execute on function public.salvar_meu_cadastro(text) to authenticated, service_role;

-- exceção ESTREITA no gatilho de proteção: só a coluna 'nome' e só enquanto o sinalizador da função estiver ligado (vale apenas dentro da transação; mesmo precedente do debitar_cashback)
do $$
declare v_def text := pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure); v_novo text;
begin
  v_novo := replace(v_def, 'if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then',
    E'if (to_jsonb(new) - (case when coalesce(current_setting(''anticeg.salvar_cadastro'', true), '''') = ''1'' then array_append(permitidas, ''nome'') else permitidas end))\n     is distinct from (to_jsonb(old) - (case when coalesce(current_setting(''anticeg.salvar_cadastro'', true), '''') = ''1'' then array_append(permitidas, ''nome'') else permitidas end)) then');
  if v_novo = v_def then raise exception 'Não consegui acrescentar a exceção em trg_joiners_protege_colunas (texto inesperado). Nada foi alterado.'; end if;
  execute v_novo;
end $$;

-- 7) pedido do LOGIN LEGADO (sem sessão): nunca altera o cadastro; fica marcado "sem prova de identidade"; resposta neutra (não revela se o cadastro existe)
create function public.solicitar_alteracao_sem_login(p_cog text, p_campo text, p_valor text, p_mensagem text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cog text := lower(btrim(replace(coalesce(p_cog, ''), '@', ''))); v_valor text := left(btrim(coalesce(p_valor, '')), 120); v_msg text := left(btrim(coalesce(p_mensagem, '')), 500); v_j bigint;
begin
  if p_campo is null or p_campo not in ('nome', 'arroba', 'email') then raise exception 'tipo de pedido inválido'; end if;
  if char_length(v_cog) < 1 or char_length(v_cog) > 64 or v_cog ~ '[\s<>\u0000-\u001f]' then raise exception 'pedido inválido'; end if;
  if v_valor = '' or v_valor ~ '[<>\u0000-\u001f]' or v_msg ~ '[<>\u0000-\u001f]' then raise exception 'texto inválido'; end if;
  if (select count(*) from public.perfil_solicitacoes s where s.sem_prova and s.criado_em > now() - interval '1 hour') >= 60 then raise exception 'muitos pedidos agora; tente de novo mais tarde'; end if;
  select j.id into v_j from public.joiners j where lower(btrim(j.cog)) = v_cog;
  if v_j is not null and (select count(*) from public.perfil_solicitacoes s where s.joiner_id = v_j and s.sem_prova and s.status = 'aberta') < 3 then
    insert into public.perfil_solicitacoes (joiner_id, tipo, cog_informado, valor_pedido, mensagem, sem_prova) values (v_j, p_campo, v_cog, v_valor, nullif(v_msg, ''), true);
  end if;
  return jsonb_build_object('ok', true, 'status', 'solicitada');   -- sempre a mesma resposta
end $$;
revoke all on function public.solicitar_alteracao_sem_login(text, text, text, text) from public;
grant execute on function public.solicitar_alteracao_sem_login(text, text, text, text) to anon, authenticated, service_role;

-- 8) painel da administração (mesmo padrão do Report: lista, selo e leitura)
create function public.admin_cadastro_tarefas(p_limite integer default 200) returns table (
  id bigint, joiner_id bigint, cog text, tipo text, campos jsonb, origem text, planilha_status text, planilha_motivo text, planilha_tentativas integer, planilha_ultimo_erro text,
  planilha_sincronizada_em timestamptz, atencao_desde timestamptz, atencao_vista_em timestamptz, lida_em timestamptz, resolvida_em timestamptz, nota text, criado_em timestamptz, pendente boolean, tem_conta boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  return query
  select t.id, t.joiner_id, j.cog::text, t.tipo::text, t.campos, t.origem::text, t.planilha_status::text, t.planilha_motivo::text, t.planilha_tentativas, t.planilha_ultimo_erro::text,
         t.planilha_sincronizada_em, t.atencao_desde, t.atencao_vista_em, t.lida_em, t.resolvida_em, t.nota::text, t.criado_em, emergencia.tarefa_pendente(t),
         exists (select 1 from public.contas_joiner c where c.joiner_id = t.joiner_id)
    from public.cadastro_tarefas t left join public.joiners j on j.id = t.joiner_id
   order by emergencia.tarefa_pendente(t) desc, t.criado_em desc limit greatest(1, least(coalesce(p_limite, 200), 500));
end $$;
create function public.admin_cadastro_pendentes() returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  return (select count(*)::integer from public.cadastro_tarefas t where emergencia.tarefa_pendente(t));
end $$;
create function public.admin_cadastro_marcar_lida(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  update public.cadastro_tarefas set lida_em = coalesce(lida_em, now()), lida_por = coalesce(lida_por, (select auth.uid())) where id = p_id;
end $$;
create function public.admin_cadastro_marcar_atencao_vista(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  update public.cadastro_tarefas set atencao_vista_em = now(), lida_em = coalesce(lida_em, now()), lida_por = coalesce(lida_por, (select auth.uid())) where id = p_id and planilha_status = 'atencao';
end $$;
create function public.admin_cadastro_resolver(p_id bigint, p_nota text) returns void language plpgsql security definer set search_path = '' as $$
declare v_sol bigint;
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  update public.cadastro_tarefas set resolvida_em = coalesce(resolvida_em, now()), resolvida_por = (select auth.uid()), nota = left(btrim(coalesce(p_nota, '')), 500), lida_em = coalesce(lida_em, now())
   where id = p_id returning solicitacao_id into v_sol;
  if v_sol is not null then update public.perfil_solicitacoes set status = 'resolvida', nota = left(btrim(coalesce(p_nota, '')), 500), resolvido_por = (select auth.uid()), resolvido_em = now() where id = v_sol and status = 'aberta'; end if;
end $$;
create function public.admin_cadastro_reprocessar(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_fila bigint;
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  select fila_id into v_fila from public.cadastro_tarefas where id = p_id and tipo = 'alteracao';
  if v_fila is null then raise exception 'esta tarefa não tem envio para a planilha'; end if;
  update public.perfil_sync_pendente set status = 'pendente', tentativas = 0, ultimo_erro = null, tentado_em = null where id = v_fila;
  update public.cadastro_tarefas set planilha_status = 'pendente', planilha_ultimo_erro = null where id = p_id;
end $$;
revoke all on function public.admin_cadastro_tarefas(integer), public.admin_cadastro_pendentes(), public.admin_cadastro_marcar_lida(bigint), public.admin_cadastro_marcar_atencao_vista(bigint),
  public.admin_cadastro_resolver(bigint, text), public.admin_cadastro_reprocessar(bigint) from public, anon;
grant execute on function public.admin_cadastro_tarefas(integer), public.admin_cadastro_pendentes(), public.admin_cadastro_marcar_lida(bigint), public.admin_cadastro_marcar_atencao_vista(bigint),
  public.admin_cadastro_resolver(bigint, text), public.admin_cadastro_reprocessar(bigint) to authenticated, service_role;

-- 9) conferências antes do COMMIT
do $$
begin
  if has_table_privilege('anon', 'public.cadastro_tarefas', 'SELECT') or has_table_privilege('authenticated', 'public.cadastro_tarefas', 'INSERT') or has_table_privilege('authenticated', 'public.cadastro_tarefas', 'UPDATE') then raise exception 'cadastro_tarefas aberta demais. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.salvar_meu_cadastro(text)', 'EXECUTE') or has_function_privilege('anon', 'public.admin_cadastro_tarefas(integer)', 'EXECUTE') then raise exception 'função de conta ou de administração aberta ao visitante. Transação desfeita.'; end if;
  if has_function_privilege('authenticated', 'public.perfil_sync_marcar(bigint, boolean, text, boolean)', 'EXECUTE') or has_function_privilege('authenticated', 'public.perfil_sync_estado(bigint)', 'EXECUTE') then raise exception 'função da fila aberta à conta logada. Transação desfeita.'; end if;
  if not has_function_privilege('anon', 'public.solicitar_alteracao_sem_login(text, text, text, text)', 'EXECUTE') then raise exception 'pedido do login legado sem permissão. Transação desfeita.'; end if;
  if pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure) !~ 'anticeg.salvar_cadastro' then raise exception 'exceção do nome não entrou. Transação desfeita.'; end if;
  insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('E1', 'aplicada', 'sim');
end $$;
commit;
