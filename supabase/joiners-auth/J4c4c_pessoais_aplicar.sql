-- J4c-4c — DADOS PESSOAIS RESTANTES PROTEGIDOS PELO BANCO: feedbacks, notifications, pushes, push_reads, joiner_storage, joiner_conferencias, joiner_updates, envio_rounds, envio_requests, confirmacoes
-- Hoje qualquer visitante lê (e altera) o que a joiner escreveu à administração (feedbacks), as notificações e avisos pessoais, as fotos do storage de cada uma, conferências,
-- fila de envio (quem está em cada rodada) e pedidos de troca de @. Depois deste passo:
--   feedbacks           : a joiner lê e CRIA os próprios (sem resposta da administração) e só consegue gravar a RÉPLICA ao feedback; resposta e status são da administradora.
--   notifications       : a joiner lê as próprias e só marca como lida; quem cria é a administradora/o servidor.
--   pushes              : avisos GERAIS (sem destinatário) continuam legíveis a todos; avisos PESSOAIS só para a dona (que pode apagar o próprio depois de lido); escrever é da administradora.
--   push_reads          : a joiner lê e registra só as próprias leituras.
--   joiner_storage      : a joiner lê as próprias fotos e só consegue DESATIVAR a própria (ativo=false); a administradora cadastra e gerencia.
--   joiner_conferencias : a joiner lê as próprias, cria a própria (sem confirmação) e só consegue gravar a CONFIRMAÇÃO.
--   joiner_updates      : a joiner só registra o aviso de que atualizou o perfil; quem lê é a administradora.
--   envio_rounds        : joiner com conta ATIVADA lê as rodadas (número e situação). Criar/fechar rodada: só a administradora ou envio_entrar_round().
--   envio_requests      : a joiner lê só a própria entrada na fila; entrar na fila é por envio_entrar_round() (o servidor escolhe a rodada e a posição, sob trava).
--   confirmacoes        : a joiner só registra o pedido de troca de @; quem lê é a administradora.
-- Visitante: nada nestas tabelas (exceto os avisos gerais). Nada de dado é alterado/apagado. NENHUMA permissão de visitante é copiada para a conta logada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (que chama envio_entrar_round) e depois do J1, J4-0 e J4a. O site de hoje depende do acesso de visitante.
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
declare n integer; t text; esperadas jsonb := jsonb_build_object(
  'feedbacks', array['id', 'joiner_cog', 'resposta', 'status', 'resposta_joiner', 'resposta_joiner_at'],
  'notifications', array['id', 'joiner_cog', 'read_at'],
  'pushes', array['id', 'joiner_cog', 'active'],
  'push_reads', array['id', 'joiner_cog', 'push_id'],
  'joiner_storage', array['id', 'joiner_cog', 'ativo'],
  'joiner_conferencias', array['id', 'joiner_cog', 'confirmada_em'],
  'joiner_updates', array['id', 'joiner_cog', 'lido'],
  'envio_rounds', array['id', 'numero', 'status', 'created_at'],
  'envio_requests', array['id', 'joiner_cog', 'round_id', 'posicao_no_round', 'status', 'itens_manuais'],
  'confirmacoes', array['id', 'joiner_cog', 'visto']);
  cols text[];
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4c') then raise exception 'J4c-4c já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  for t in select jsonb_object_keys(esperadas) loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
    select array_agg(x) into cols from jsonb_array_elements_text(esperadas -> t) x;
    select count(*) into n from pg_attribute where attrelid = ('public.' || t)::regclass and not attisdropped and attname = any (cols);
    if n <> array_length(cols, 1) then raise exception '% sem as colunas esperadas (achei % de %). Nada foi alterado.', t, n, array_length(cols, 1); end if;
  end loop;
  if to_regprocedure('public.envio_entrar_round(text)') is not null then raise exception 'envio_entrar_round já existe. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR (policies para recriar exatamente, permissões, RLS e impressão dos dados)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4c', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4c', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.oid = any (array['public.feedbacks'::regclass, 'public.notifications'::regclass, 'public.pushes'::regclass, 'public.push_reads'::regclass, 'public.joiner_storage'::regclass, 'public.joiner_conferencias'::regclass, 'public.joiner_updates'::regclass, 'public.envio_rounds'::regclass, 'public.envio_requests'::regclass, 'public.confirmacoes'::regclass]);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4c', 'rls ' || c.relname, case when c.relrowsecurity then 'ligado' else 'desligado' end from pg_class c
 where c.oid = any (array['public.feedbacks'::regclass, 'public.notifications'::regclass, 'public.pushes'::regclass, 'public.push_reads'::regclass, 'public.joiner_storage'::regclass, 'public.joiner_conferencias'::regclass, 'public.joiner_updates'::regclass, 'public.envio_rounds'::regclass, 'public.envio_requests'::regclass, 'public.confirmacoes'::regclass]);
do $$
declare t text; v text;
begin
  foreach t in array array['feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes'] loop
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status_txt, ''''), '','' order by id::text), '''')) from (select id, ''x'' as status_txt from public.%I) q', t) into v;
    insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4c-4c', 'impressão ' || t, v);
  end loop;
end $$;

-- 1) RLS ligado e fora TODAS as policies antigas
do $$
declare t text; r record;
begin
  foreach t in array array['feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop execute format('drop policy %I on public.%I', r.policyname, t); end loop;
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy admin_tudo on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;
grant select on table public.pushes to anon;   -- só os avisos GERAIS, pela policy abaixo

-- 2) policies
create policy joiner_le_proprios on public.feedbacks for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_cria_proprio on public.feedbacks for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and resposta is null and coalesce(status, 'pendente') = 'pendente' and resposta_joiner is null);
create policy joiner_replica_proprio on public.feedbacks for update to authenticated
  using (public.cog_e_da_conta(joiner_cog)) with check (public.cog_e_da_conta(joiner_cog));

create policy joiner_le_proprias on public.notifications for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_marca_lida on public.notifications for update to authenticated
  using (public.cog_e_da_conta(joiner_cog)) with check (public.cog_e_da_conta(joiner_cog));

create policy avisos_gerais on public.pushes for select to anon, authenticated using (joiner_cog is null);
create policy joiner_le_pessoais on public.pushes for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_apaga_pessoal on public.pushes for delete to authenticated using (public.cog_e_da_conta(joiner_cog));

create policy joiner_le_proprias on public.push_reads for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_cria_propria on public.push_reads for insert to authenticated with check (public.cog_e_da_conta(joiner_cog));

create policy joiner_le_proprios on public.joiner_storage for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_desativa_proprio on public.joiner_storage for update to authenticated
  using (public.cog_e_da_conta(joiner_cog)) with check (public.cog_e_da_conta(joiner_cog));

create policy joiner_le_proprias on public.joiner_conferencias for select to authenticated using (public.cog_e_da_conta(joiner_cog));
create policy joiner_cria_propria on public.joiner_conferencias for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and confirmada_em is null);
create policy joiner_confirma_propria on public.joiner_conferencias for update to authenticated
  using (public.cog_e_da_conta(joiner_cog)) with check (public.cog_e_da_conta(joiner_cog));

create policy joiner_cria_proprio on public.joiner_updates for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and coalesce(lido, false) = false);

create policy ativadas_leem on public.envio_rounds for select to authenticated using ((select public.meu_cog()) is not null);
create policy joiner_le_proprias on public.envio_requests for select to authenticated using (public.cog_e_da_conta(joiner_cog));

create policy joiner_cria_proprio on public.confirmacoes for insert to authenticated
  with check (public.cog_e_da_conta(joiner_cog) and coalesce(visto, false) = false);

-- 3) gatilhos de campos (para quem NÃO é administradora; o servidor, sem auth.uid(), segue livre)
create function public.trg_j4c4c_protege() returns trigger language plpgsql security definer set search_path = '' as $$
declare livres text[];
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  livres := case tg_table_name
    when 'feedbacks' then array['resposta_joiner', 'resposta_joiner_at']
    when 'notifications' then array['read_at']
    when 'joiner_storage' then array['ativo']
    when 'joiner_conferencias' then array['confirmada_em']
    else array[]::text[] end;
  if (to_jsonb(new) - livres) is distinct from (to_jsonb(old) - livres) then
    raise exception 'Alteração não permitida neste registro.' using errcode = '42501';
  end if;
  if tg_table_name = 'joiner_storage' and coalesce((to_jsonb(new) ->> 'ativo')::boolean, false) is distinct from false then
    raise exception 'Alteração não permitida: a joiner só pode desativar a própria foto.' using errcode = '42501';
  end if;
  if tg_table_name = 'joiner_conferencias' and (to_jsonb(old) ->> 'confirmada_em') is not null then
    raise exception 'Alteração não permitida: a conferência já foi confirmada.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.trg_j4c4c_protege() from public, anon, authenticated;
create trigger trg_j4c4c_protege before update on public.feedbacks for each row execute function public.trg_j4c4c_protege();
create trigger trg_j4c4c_protege before update on public.notifications for each row execute function public.trg_j4c4c_protege();
create trigger trg_j4c4c_protege before update on public.joiner_storage for each row execute function public.trg_j4c4c_protege();
create trigger trg_j4c4c_protege before update on public.joiner_conferencias for each row execute function public.trg_j4c4c_protege();

-- 4) entrar na fila de envio (o servidor escolhe a rodada e a posição, sob trava; o navegador não cria nem fecha rodadas)
create function public.envio_entrar_round(p_itens text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cog text := (select public.meu_cog()); v_round record; v_id bigint; v_pos integer; v_num integer; v_req record;
begin
  if v_cog is null then return jsonb_build_object('ok', false, 'motivo', 'sem_conta'); end if;
  perform pg_advisory_xact_lock(hashtext('envio_rounds'));
  select id, numero into v_round from public.envio_rounds where status = 'aberto' order by created_at, id limit 1;
  if found then
    select * into v_req from public.envio_requests where round_id = v_round.id and public.cog_e_da_conta(joiner_cog) limit 1;
    if found then
      return jsonb_build_object('ok', true, 'repetido', true, 'request', to_jsonb(v_req) || jsonb_build_object('envio_rounds', (select to_jsonb(r) from public.envio_rounds r where r.id = v_round.id)));
    end if;
    select count(*) + 1 into v_pos from public.envio_requests where round_id = v_round.id;
    v_id := v_round.id;
    if v_pos >= 7 then update public.envio_rounds set status = 'fechado' where id = v_id; end if;
  else
    select coalesce(max(numero), 0) + 1 into v_num from public.envio_rounds;
    insert into public.envio_rounds (numero, status) values (v_num, 'aberto') returning id into v_id;
    v_pos := 1;
  end if;
  insert into public.envio_requests (joiner_cog, round_id, posicao_no_round, status, itens_manuais)
  values (v_cog, v_id, v_pos, 'aguardando', nullif(trim(coalesce(p_itens, '')), '')) returning * into v_req;
  return jsonb_build_object('ok', true, 'request', to_jsonb(v_req) || jsonb_build_object('envio_rounds', (select to_jsonb(r) from public.envio_rounds r where r.id = v_id)));
end $$;
revoke all on function public.envio_entrar_round(text) from public, anon;
grant execute on function public.envio_entrar_round(text) to authenticated, service_role;

-- 5) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from unnest(array['feedbacks', 'notifications', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes']) x(nome)
   where has_table_privilege('anon', 'public.' || x.nome, 'SELECT') or has_table_privilege('anon', 'public.' || x.nome, 'INSERT') or has_table_privilege('anon', 'public.' || x.nome, 'UPDATE') or has_table_privilege('anon', 'public.' || x.nome, 'DELETE')
      or has_any_column_privilege('anon', 'public.' || x.nome, 'SELECT') or has_any_column_privilege('anon', 'public.' || x.nome, 'UPDATE') or has_any_column_privilege('anon', 'public.' || x.nome, 'INSERT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em alguma tabela do lote. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.pushes', 'INSERT') or has_table_privilege('anon', 'public.pushes', 'UPDATE') or has_table_privilege('anon', 'public.pushes', 'DELETE') then raise exception 'O visitante escreve em pushes. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes') and ('anon' = any(roles) or 'public' = any(roles));
  if n <> 1 then raise exception 'Esperava exatamente 1 policy para visitante (avisos gerais) e há %. Transação desfeita.', n; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes');
  if n <> 29 then raise exception 'Esperava 29 policies novas e há %. Transação desfeita.', n; end if;
  if not exists (select 1 from pg_proc p where p.oid = 'public.envio_entrar_round(text)'::regprocedure and p.prosecdef and p.proconfig = array['search_path=""']) or has_function_privilege('anon', 'public.envio_entrar_round(text)', 'EXECUTE') then raise exception 'envio_entrar_round sem security definer/search_path vazio ou aberta ao visitante. Transação desfeita.'; end if;
  foreach t in array array['feedbacks', 'notifications', 'pushes', 'push_reads', 'joiner_storage', 'joiner_conferencias', 'joiner_updates', 'envio_rounds', 'envio_requests', 'confirmacoes'] loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-4c' and objeto = 'impressão ' || t;
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status_txt, ''''), '','' order by id::text), '''')) from (select id, ''x'' as status_txt from public.%I) q', t) into v_d;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
