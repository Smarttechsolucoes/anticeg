-- J22 — ATIVAÇÃO AUTOMÁTICA COMPLETA (decisão da administradora em 12/11/2026, para reduzir o retrabalho de ativação).
-- O QUE FAZ: cria UMA função, chamada só pelo servidor (service_role) depois que a pessoa provou, por código, que controla o e-mail da conta:
--   * e-mail do cadastro = e-mail verificado  -> liga a conta ao cadastro;
--   * cadastro SEM e-mail (ou com e-mail inválido) -> grava o e-mail verificado no cadastro e liga a conta;
--   * pessoa quer OUTRO e-mail (cadastro com e-mail válido e só dela) -> grava o e-mail novo verificado e liga a conta (o servidor avisa o e-mail antigo).
-- O QUE NÃO FAZ (continua indo para a administração / "ajuda"): @ inexistente ou repetido, cadastro bloqueado, cadastro que já tem conta, conta que já está ligada a outro cadastro,
--   e-mail do cadastro dividido com outro cadastro (conflito: não move nem cria outro), e-mail novo que já pertence a OUTRO cadastro, ativação ainda não liberada.
-- NÃO grava nada em vinculo_confirmacoes: a ligação automática NÃO é "identidade confirmada pela administradora". Cada ligação fica em contas_auditoria e pode ser desfeita com admin_desvincular_conta.
-- RISCO ACEITO PELA ADMINISTRADORA (pedido explícito de 12/11): quem sabe o @ de um cadastro sem e-mail, ou de um cadastro com e-mail só dele, e controla um e-mail verificado, consegue ligar a conta a ele.
-- ANTES DE APLICAR, rode (só leitura) e confira se as ações usadas abaixo são aceitas pelas restrições existentes:
--   select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where contype = 'c' and conrelid in ('public.contas_auditoria'::regclass, 'public.contas_joiner'::regclass);
-- Desfazer: J22_ativacao_automatica_reverter.sql (apaga só a função nova; nenhuma tabela ou dado é tocado por este arquivo).
begin;
create or replace function public.ativar_conta_automatica(p_user_id uuid, p_cog text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_cog text := lower(trim(both from regexp_replace(coalesce(p_cog, ''), '^\s*@+', '')));
  v_email text; v_conf timestamptz; v_n integer; v_j record; v_antigo text; v_valido boolean; v_trocou boolean := false;
begin
  select lower(btrim(u.email)), u.email_confirmed_at into v_email, v_conf from auth.users u where u.id = p_user_id;
  if v_email is null or v_conf is null then return jsonb_build_object('status', 'email_nao_verificado'); end if;
  if exists (select 1 from public.contas_joiner c where c.user_id = p_user_id) then return jsonb_build_object('status', 'ok'); end if;
  if v_cog = '' or length(v_cog) > 64 then return jsonb_build_object('status', 'pendente', 'motivo', 'cog_invalido'); end if;

  select count(*) into v_n from public.joiners j where public.norm_arroba(j.cog) = public.norm_arroba(v_cog);
  if v_n <> 1 then return jsonb_build_object('status', 'pendente', 'motivo', case when v_n = 0 then 'cog_inexistente' else 'cog_ambiguo' end); end if;
  select * into v_j from public.joiners j where public.norm_arroba(j.cog) = public.norm_arroba(v_cog) for update;

  if coalesce(v_j.bloqueado, false) then return jsonb_build_object('status', 'pendente', 'motivo', 'bloqueado'); end if;
  if exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then return jsonb_build_object('status', 'pendente', 'motivo', 'cog_ja_vinculado'); end if;
  if not public.ativacao_liberada(v_j.id) then return jsonb_build_object('status', 'aguardando_liberacao'); end if;

  v_antigo := lower(btrim(coalesce(v_j.email, '')));
  v_valido := v_antigo ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$';
  -- e-mail do cadastro dividido com outro cadastro: conflito (a administradora decide; nada é movido nem criado)
  if v_valido and (select count(*) from public.joiners k where lower(btrim(coalesce(k.email, ''))) = v_antigo) > 1 then return jsonb_build_object('status', 'pendente', 'motivo', 'email_compartilhado'); end if;

  if not (v_valido and v_antigo = v_email) then
    -- e-mail ausente, inválido ou DIFERENTE: o verificado passa a ser o do cadastro, desde que não seja de outro cadastro
    if exists (select 1 from public.joiners k where k.id <> v_j.id and lower(btrim(coalesce(k.email, ''))) = v_email) then return jsonb_build_object('status', 'pendente', 'motivo', 'email_de_outro_cadastro'); end if;
    update public.joiners set email = v_email where id = v_j.id;
    v_trocou := true;
  end if;

  begin
    insert into public.contas_joiner (user_id, joiner_id, origem) values (p_user_id, v_j.id, 'email_verificado');
  exception when unique_violation then
    return jsonb_build_object('status', 'pendente', 'motivo', 'cog_ja_vinculado');
  end;
  update public.vinculos_pendentes set status = 'aprovado', resolvido_em = now() where user_id = p_user_id and status = 'aberto';
  insert into public.contas_auditoria (acao, joiner_id, detalhe) values ('ativacao_automatica', v_j.id,
    jsonb_build_object('user_id', p_user_id, 'email_trocado', v_trocou, 'tinha_email_valido', v_valido, 'dominio_antigo', case when v_valido then split_part(v_antigo, '@', 2) else null end, 'dominio_novo', split_part(v_email, '@', 2), 'nao_e_identidade_confirmada', true));
  return jsonb_build_object('status', 'ok', 'email_trocado', v_trocou, 'email_antigo', case when v_trocou and v_valido then v_antigo else null end);
end $function$;

revoke all on function public.ativar_conta_automatica(uuid, text) from public, anon, authenticated;
grant execute on function public.ativar_conta_automatica(uuid, text) to service_role;
do $$ begin
  if has_function_privilege('anon', 'public.ativar_conta_automatica(uuid,text)', 'EXECUTE') or has_function_privilege('authenticated', 'public.ativar_conta_automatica(uuid,text)', 'EXECUTE') then
    raise exception 'ativar_conta_automatica ficou aberta ao visitante/logado. Transação desfeita.'; end if;
end $$;
commit;
