-- J4c-4b — CLAIMS EM SETS PROTEGIDOS PELO BANCO: claim_eventos, claim_sets, claim_reservas
-- Hoje qualquer visitante lê (e altera) as reservas dos sets: COG, nome REAL e horário de cada claim. Pior: o NAVEGADOR da joiner decide sozinho quando um set fecha, abre o próximo e move
-- as reservas de OUTRAS joiners do standby para o set novo. Com a proteção por linha isso deixaria de funcionar (e, enquanto estivesse aberto, qualquer pessoa poderia fraudar o claim).
-- Depois deste passo:
--   claim_eventos / claim_sets : joiner com conta ATIVADA lê; escrever é só da administradora. Visitante: nada.
--   claim_reservas             : a joiner lê só as próprias; administradora tudo; ninguém além da administradora escreve direto. Visitante: nada.
--   claim_reservas_quadro (visão): o QUADRO dos sets que a tela mostra a todas as joiners ativadas: COG (nome público), membro, status; o nome REAL só aparece nas vagas da administradora.
--   claim_enviar(evento, pedidos) : a joiner faz o claim. O servidor aplica as regras (conta ativada, não bloqueada, evento aberto, limite por joiner, vaga livre no set aberto ou standby,
--                                   OT8 exclusivo) sob uma trava por evento (duas pessoas nunca pegam a mesma vaga) e devolve o resultado.
--   claim_organizar(evento)       : fecha sets completos, abre o próximo set e promove o standby (a mesma regra que o navegador aplicava); idempotente e segura de chamar por qualquer joiner ativada.
-- Nada de dado é alterado/apagado. As permissões do visitante saem e NENHUMA é copiada para a conta logada.
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar (que chama claim_enviar/claim_organizar) e depois do J1, J4-0 e J4a. O site de hoje depende do acesso de visitante.
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
declare n integer; t text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4c-4b') then raise exception 'J4c-4b já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null or to_regprocedure('public.meu_joiner_id()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
  if not exists (select 1 from public.admin_roles) then raise exception 'Não há administradora cadastrada. Nada foi alterado.'; end if;
  foreach t in array array['claim_eventos', 'claim_sets', 'claim_reservas', 'joiners'] loop
    if to_regclass('public.' || t) is null then raise exception 'A tabela % não existe. Nada foi alterado.', t; end if;
  end loop;
  select count(*) into n from pg_attribute where attrelid = 'public.claim_eventos'::regclass and not attisdropped and attname in ('id', 'status', 'abertura', 'membros', 'limite_por_joiner', 'sem_novos_sets');
  if n <> 6 then raise exception 'claim_eventos sem as colunas esperadas (achei % de 6). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.claim_sets'::regclass and not attisdropped and attname in ('id', 'evento_id', 'numero', 'status', 'closed_at');
  if n <> 5 then raise exception 'claim_sets sem as colunas esperadas (achei % de 5). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.claim_reservas'::regclass and not attisdropped and attname in ('id', 'evento_id', 'set_id', 'joiner_cog', 'joiner_nome', 'membro', 'status', 'is_admin', 'created_at');
  if n <> 9 then raise exception 'claim_reservas sem as colunas esperadas (achei % de 9). Nada foi alterado.', n; end if;
  select count(*) into n from pg_attribute where attrelid = 'public.joiners'::regclass and not attisdropped and attname in ('id', 'nome', 'bloqueado');
  if n <> 3 then raise exception 'joiners sem as colunas esperadas. Nada foi alterado.'; end if;
  if to_regclass('public.claim_reservas_quadro') is not null or to_regprocedure('public.claim_enviar(bigint,jsonb)') is not null or to_regprocedure('public.claim_organizar(bigint)') is not null then raise exception 'Objetos do J4c-4b já existem. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR (policies para recriar exatamente, permissões, RLS e impressão dos dados)
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4b', 'policy ' || tablename || ' / ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'public' and tablename in ('claim_eventos', 'claim_sets', 'claim_reservas');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4b', 'acl ' || c.relname, coalesce(c.relacl::text, '(padrão do dono)') from pg_class c
 where c.oid in ('public.claim_eventos'::regclass, 'public.claim_sets'::regclass, 'public.claim_reservas'::regclass);
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J4c-4b', 'rls ' || c.relname, case when c.relrowsecurity then 'ligado' else 'desligado' end from pg_class c
 where c.oid in ('public.claim_eventos'::regclass, 'public.claim_sets'::regclass, 'public.claim_reservas'::regclass);
do $$
declare t text; v text;
begin
  foreach t in array array['claim_eventos', 'claim_sets', 'claim_reservas'] loop
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id::text), '''')) from public.%I', t) into v;
    insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J4c-4b', 'impressão ' || t, v);
  end loop;
end $$;

-- 1) RLS ligado e fora TODAS as policies antigas
alter table public.claim_eventos enable row level security;
alter table public.claim_sets enable row level security;
alter table public.claim_reservas enable row level security;
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('claim_eventos', 'claim_sets', 'claim_reservas') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) visitante: nenhuma permissão. Conta logada: leitura pelas policies; ESCRITA só da administradora (a joiner escreve pelas funções abaixo).
revoke all on table public.claim_eventos, public.claim_sets, public.claim_reservas from anon, public;
grant select, insert, update, delete on table public.claim_eventos, public.claim_sets, public.claim_reservas to authenticated;

create policy admin_tudo on public.claim_eventos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ativadas_leem on public.claim_eventos for select to authenticated using ((select public.meu_cog()) is not null);
create policy admin_tudo on public.claim_sets for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ativadas_leem on public.claim_sets for select to authenticated using ((select public.meu_cog()) is not null);
create policy admin_tudo on public.claim_reservas for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy joiner_le_proprias on public.claim_reservas for select to authenticated using (public.cog_e_da_conta(joiner_cog));

-- 3) o QUADRO dos sets (o que a tela mostra a todas): COG público, membro, status. Nome real só nas vagas da administradora. Só para conta ativada ou administradora.
create view public.claim_reservas_quadro as
  select r.id, r.evento_id, r.set_id, r.joiner_cog, case when r.is_admin then r.joiner_nome end as joiner_nome, r.membro, r.status, r.is_admin, r.created_at
    from public.claim_reservas r
   where (select public.meu_cog()) is not null or (select public.is_admin());
revoke all on public.claim_reservas_quadro from public, anon, authenticated;
grant select on public.claim_reservas_quadro to authenticated, service_role;

-- 4) funções de claim (SECURITY DEFINER, search_path vazio; a identidade vem só do login, nunca do que o navegador envia)
create function public._claim_membros(p_membros jsonb) returns text[] language sql immutable set search_path = '' as $$
  select case when p_membros is not null and jsonb_typeof(p_membros) = 'array' and jsonb_array_length(p_membros) > 0
              then array(select jsonb_array_elements_text(p_membros))
              else array['Bang Chan','Lee Know','Changbin','Hyunjin','Han','Felix','Seungmin','I.N'] end
$$;
revoke all on function public._claim_membros(jsonb) from public, anon, authenticated;

-- fecha sets completos, abre o próximo set e promove o standby (mesma regra que o navegador aplicava). Já deve estar sob a trava do evento.
create function public._claim_organizar_interno(p_evento bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev record; v_membros text[]; v_fechados integer := 0; v_abertos integer := 0; v_i integer := 0; s record; v_novo bigint; v_prox integer; v_n integer; v_sb record; v_promov text[];
begin
  select * into ev from public.claim_eventos where id = p_evento;
  if not found or ev.status <> 'ativo' then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  v_membros := public._claim_membros(to_jsonb(ev.membros));
  loop
    v_i := v_i + 1; exit when v_i > 30;
    for s in select id from public.claim_sets where evento_id = p_evento and status = 'aberto' order by numero loop
      if not exists (select 1 from unnest(v_membros) m where not exists (select 1 from public.claim_reservas r where r.set_id = s.id and r.membro = m and r.status <> 'cancelado')) then
        update public.claim_sets set status = 'fechado', closed_at = now() where id = s.id; v_fechados := v_fechados + 1;
      end if;
    end loop;
    exit when coalesce(ev.sem_novos_sets, false);
    exit when ev.abertura is not null and ev.abertura > now();
    exit when exists (select 1 from public.claim_sets where evento_id = p_evento and status = 'aberto');
    exit when not exists (select 1 from public.claim_reservas where evento_id = p_evento and set_id is null and status <> 'cancelado');
    select count(*) into v_n from public.claim_sets where evento_id = p_evento and status <> 'cancelado';
    exit when v_n >= 10;
    select coalesce(max(numero), 0) + 1 into v_prox from public.claim_sets where evento_id = p_evento;
    insert into public.claim_sets (evento_id, numero, status) values (p_evento, v_prox, 'aberto') returning id into v_novo;
    v_abertos := v_abertos + 1; v_promov := '{}';
    for v_sb in select id, membro from public.claim_reservas where evento_id = p_evento and set_id is null and status <> 'cancelado' order by created_at, id loop
      continue when v_sb.membro = any (v_promov);
      continue when not (v_sb.membro = any (v_membros));
      update public.claim_reservas set set_id = v_novo, status = 'pendente' where id = v_sb.id;
      v_promov := v_promov || v_sb.membro;
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'sets_fechados', v_fechados, 'sets_abertos', v_abertos);
end $$;
revoke all on function public._claim_organizar_interno(bigint) from public, anon, authenticated;

create function public.claim_organizar(p_evento bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select public.meu_cog()) is null and not (select public.is_admin()) then return jsonb_build_object('ok', false, 'motivo', 'sem_conta'); end if;
  perform pg_advisory_xact_lock(hashtext('claim_evento:' || p_evento::text));
  return public._claim_organizar_interno(p_evento);
end $$;
revoke all on function public.claim_organizar(bigint) from public, anon;
grant execute on function public.claim_organizar(bigint) to authenticated, service_role;

-- p_pedidos: objeto {"Bang Chan": 2, "Lee Know": 1}. Devolve {ok, gravados, standby[], falhas[], ot8} ou {ok:false, motivo}.
create function public.claim_enviar(p_evento bigint, p_pedidos jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cog text := (select public.meu_cog()); v_jid bigint := (select public.meu_joiner_id()); v_nome text; v_bloq boolean;
  ev record; v_membros text[]; v_ehitem boolean; v_limite integer; v_ot8 boolean; v_semnovos boolean;
  v_ped jsonb := '{}'::jsonb; k text; q integer; v_ja integer; v_perm integer; v_add integer; s record; v_set bigint; v_prox integer;
  v_gravados integer := 0; v_standby text[] := '{}'; v_falhas text[] := '{}'; v_semvaga boolean := false; m text; i integer;
  v_sk8 text[] := array['Bang Chan','Lee Know','Changbin','Hyunjin','Han','Felix','Seungmin','I.N'];
begin
  if v_cog is null or v_jid is null then return jsonb_build_object('ok', false, 'motivo', 'sem_conta'); end if;
  if p_pedidos is null or jsonb_typeof(p_pedidos) <> 'object' then return jsonb_build_object('ok', false, 'motivo', 'pedido_invalido'); end if;
  select coalesce(nullif(nome, ''), v_cog), coalesce(bloqueado, false) into v_nome, v_bloq from public.joiners where id = v_jid;
  if v_bloq then return jsonb_build_object('ok', false, 'motivo', 'bloqueada'); end if;
  perform pg_advisory_xact_lock(hashtext('claim_evento:' || p_evento::text));
  select * into ev from public.claim_eventos where id = p_evento;
  if not found or ev.status <> 'ativo' or (ev.abertura is not null and ev.abertura > now()) then return jsonb_build_object('ok', false, 'motivo', 'evento_fechado'); end if;
  v_membros := public._claim_membros(to_jsonb(ev.membros));
  v_ehitem := exists (select 1 from unnest(v_membros) mm where not (mm = any (v_sk8)));
  v_limite := coalesce(ev.limite_por_joiner, 2147483647); v_semnovos := coalesce(ev.sem_novos_sets, false);
  -- só membros que existem no evento, quantidades inteiras de 1 a 50
  for k in select jsonb_object_keys(p_pedidos) loop
    continue when not (k = any (v_membros));
    begin q := (p_pedidos ->> k)::integer; exception when others then q := 0; end;
    if q > 0 then v_ped := v_ped || jsonb_build_object(k, least(q, 50)); end if;
  end loop;
  if v_ped = '{}'::jsonb then return jsonb_build_object('ok', false, 'motivo', 'pedido_vazio'); end if;
  v_ot8 := not v_ehitem and not exists (select 1 from unnest(v_membros) mm where coalesce((v_ped ->> mm)::integer, 0) < 1);

  if v_ot8 then
    if v_semnovos then return jsonb_build_object('ok', false, 'motivo', 'sem_novos_sets'); end if;
    if exists (select 1 from public.claim_reservas r where r.evento_id = p_evento and r.status <> 'cancelado' and public.cog_e_da_conta(r.joiner_cog)) then return jsonb_build_object('ok', false, 'motivo', 'ja_tem_claims'); end if;
    select coalesce(max(numero), 0) + 1 into v_prox from public.claim_sets where evento_id = p_evento;
    insert into public.claim_sets (evento_id, numero, status) values (p_evento, v_prox, 'aberto') returning id into v_set;
    foreach m in array v_membros loop
      insert into public.claim_reservas (evento_id, set_id, joiner_cog, joiner_nome, membro, status) values (p_evento, v_set, v_cog, v_nome, m, 'pendente');
    end loop;
    update public.claim_sets set status = 'fechado', closed_at = now() where id = v_set;
    perform public._claim_organizar_interno(p_evento);
    return jsonb_build_object('ok', true, 'ot8', true, 'gravados', array_length(v_membros, 1), 'standby', '[]'::jsonb, 'falhas', '[]'::jsonb);
  end if;

  for k, q in select key, value::integer from jsonb_each_text(v_ped) loop
    select count(*) into v_ja from public.claim_reservas r where r.evento_id = p_evento and r.membro = k and r.status <> 'cancelado' and public.cog_e_da_conta(r.joiner_cog);
    v_perm := least(q, greatest(0, v_limite - v_ja));
    if v_perm = 0 then v_falhas := v_falhas || k; continue; end if;
    v_add := 0;
    for s in select id from public.claim_sets where evento_id = p_evento and status = 'aberto' order by numero loop
      exit when v_add >= v_perm;
      continue when exists (select 1 from public.claim_reservas r where r.set_id = s.id and r.membro = k and r.status <> 'cancelado');
      begin
        insert into public.claim_reservas (evento_id, set_id, joiner_cog, joiner_nome, membro, status) values (p_evento, s.id, v_cog, v_nome, k, 'pendente');
        v_add := v_add + 1; v_gravados := v_gravados + 1;
      exception when unique_violation then null;
      end;
    end loop;
    if v_semnovos then v_semvaga := v_semvaga or v_add < v_perm; continue; end if;
    for i in 1..(v_perm - v_add) loop
      insert into public.claim_reservas (evento_id, set_id, joiner_cog, joiner_nome, membro, status) values (p_evento, null, v_cog, v_nome, k, 'standby');
      v_gravados := v_gravados + 1; v_standby := v_standby || k;
    end loop;
  end loop;
  if v_gravados = 0 then return jsonb_build_object('ok', false, 'motivo', case when v_semvaga then 'sem_vaga' else 'ja_tem' end, 'falhas', to_jsonb(v_falhas)); end if;
  perform public._claim_organizar_interno(p_evento);
  return jsonb_build_object('ok', true, 'ot8', false, 'gravados', v_gravados, 'standby', to_jsonb(v_standby), 'falhas', to_jsonb(v_falhas));
end $$;
revoke all on function public.claim_enviar(bigint, jsonb) from public, anon;
grant execute on function public.claim_enviar(bigint, jsonb) to authenticated, service_role;

-- 5) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_a text; v_d text; t text;
begin
  select count(*) into n from (values ('public.claim_eventos'), ('public.claim_sets'), ('public.claim_reservas')) x(nome)
   where has_table_privilege('anon', x.nome, 'SELECT') or has_table_privilege('anon', x.nome, 'INSERT') or has_table_privilege('anon', x.nome, 'UPDATE') or has_table_privilege('anon', x.nome, 'DELETE')
      or has_any_column_privilege('anon', x.nome, 'SELECT') or has_any_column_privilege('anon', x.nome, 'UPDATE') or has_any_column_privilege('anon', x.nome, 'INSERT');
  if n > 0 then raise exception 'O visitante ainda tem permissão em alguma das 3 tabelas. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.claim_reservas_quadro', 'SELECT') then raise exception 'O visitante lê o quadro dos sets. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('claim_eventos', 'claim_sets', 'claim_reservas') and ('anon' = any(roles) or 'public' = any(roles));
  if n > 0 then raise exception 'Sobrou policy para visitante ou PUBLIC. Transação desfeita.'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('claim_eventos', 'claim_sets', 'claim_reservas');
  if n <> 6 then raise exception 'Esperava 6 policies novas e há %. Transação desfeita.', n; end if;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'claim_reservas_quadro' and column_name ~* '(email|cpf|whatsapp)';
  if n > 0 then raise exception 'O quadro dos sets expõe dado pessoal. Transação desfeita.'; end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('claim_enviar', 'claim_organizar', '_claim_organizar_interno') and p.prosecdef and p.proconfig = array['search_path=""'];
  if n <> 3 then raise exception 'As funções de claim não estão todas com security definer e search_path vazio. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.claim_enviar(bigint,jsonb)', 'EXECUTE') or has_function_privilege('anon', 'public.claim_organizar(bigint)', 'EXECUTE') then raise exception 'O visitante executa as funções de claim. Transação desfeita.'; end if;
  for t in select unnest(array['claim_eventos', 'claim_sets', 'claim_reservas']) loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J4c-4b' and objeto = 'impressão ' || t;
    execute format('select ''linhas='' || count(*) || '' md5='' || md5(coalesce(string_agg(id::text || coalesce(status, ''''), '','' order by id::text), '''')) from public.%I', t) into v_d;
    if v_a is distinct from v_d then raise exception 'Os dados de % mudaram durante o script. Transação desfeita.', t; end if;
  end loop;
end $$;

commit;
