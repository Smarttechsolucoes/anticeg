-- R2 — QUEM RESPONDEU: registra o nome de quem respondeu report / confirmou ou recusou pagamento.
-- Rode no SQL Editor do Supabase (producao) ANTES de publicar o site desta mudanca. Uma transacao: se algo falhar, nada muda.
-- O nome vem da CONTA de login de cada admin (admin_roles.nome), gravado pelo servidor: ninguem escolhe nem finge ser outra pessoa.
-- Depois de aplicar, rode R2_nomes_admins.sql (cadastra o nome de cada conta) e R2_responsavel_verificar.sql.
-- Reversao: R2_responsavel_reverter.sql.
begin;

do $$
begin
  if to_regclass('public.admin_roles') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'admin_roles / is_admin() nao existem (A1 nao aplicado). Nada foi alterado.';
  end if;
  if to_regclass('public.reports') is null or to_regclass('public.pagamento_demandas') is null then
    raise exception 'reports / pagamento_demandas nao existem. Nada foi alterado.';
  end if;
  if to_regprocedure('public.admin_nome()') is not null or to_regprocedure('public.admin_responder_report(text,text,text)') is not null then
    raise exception 'R2 ja foi aplicado (funcoes ja existem). Nada foi alterado.';
  end if;
end $$;

alter table public.admin_roles        add column if not exists nome text;
alter table public.reports            add column if not exists respondido_por text;
alter table public.reports            add column if not exists respondido_em  timestamptz;
alter table public.pagamento_demandas add column if not exists analisado_por  text;
alter table public.pagamento_demandas add column if not exists analisado_em   timestamptz;

-- Nome da conta admin logada (so para admin; nulo para qualquer outra pessoa ou conta sem nome cadastrado)
create function public.admin_nome() returns text
language sql stable security definer set search_path = '' as $$
  select nullif(trim(r.nome), '') from public.admin_roles r where r.user_id = auth.uid() and public.is_admin()
$$;
revoke all on function public.admin_nome() from public, anon;
grant execute on function public.admin_nome() to authenticated;

-- Responder / resolver report registrando QUEM fez. p_status nulo = nao muda o status.
create function public.admin_responder_report(p_report_id text, p_resposta text, p_status text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_em timestamptz := now(); v_n integer;
begin
  if not public.is_admin() then
    raise exception 'Somente administradoras.' using errcode = '42501';
  end if;
  v_nome := public.admin_nome();
  if v_nome is null then
    raise exception 'Esta conta de admin ainda nao tem nome cadastrado (rode R2_nomes_admins.sql).' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('pendente', 'resolvido') then
    raise exception 'Status invalido: %', p_status using errcode = '22023';
  end if;
  update public.reports
     set resposta = nullif(p_resposta, ''), status = coalesce(p_status, status), respondido_por = v_nome, respondido_em = v_em
   where id::text = p_report_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'Report % nao encontrado.', p_report_id using errcode = 'P0002';
  end if;
  return jsonb_build_object('respondido_por', v_nome, 'respondido_em', v_em);
end $$;
revoke all on function public.admin_responder_report(text, text, text) from public, anon;
grant execute on function public.admin_responder_report(text, text, text) to authenticated;

-- Pagamentos: quem confirmou/recusou e gravado por gatilho (a funcao admin_definir_status_pagamento nao e alterada).
-- Quem nao e admin nao consegue gravar nem alterar esses campos (nem na criacao, nem por UPDATE direto).
create function public.trg_pagamento_demandas_responsavel() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if tg_op = 'INSERT' then
    new.analisado_por := null; new.analisado_em := null;
    return new;
  end if;
  v_nome := public.admin_nome();
  if v_nome is not null and new.status is distinct from old.status then
    if new.status in ('pago', 'rejeitado') then
      new.analisado_por := v_nome; new.analisado_em := now();
    else
      new.analisado_por := null; new.analisado_em := null;
    end if;
  else
    new.analisado_por := old.analisado_por; new.analisado_em := old.analisado_em;
  end if;
  return new;
end $$;
revoke all on function public.trg_pagamento_demandas_responsavel() from public, anon, authenticated;
create trigger trg_pagamento_demandas_responsavel before insert or update on public.pagamento_demandas
  for each row execute function public.trg_pagamento_demandas_responsavel();

-- Reports: so a funcao admin_responder_report (admin logada) grava respondido_por/respondido_em.
create function public.trg_reports_responsavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.respondido_por := null; new.respondido_em := null;
  elsif not public.is_admin() then
    new.respondido_por := old.respondido_por; new.respondido_em := old.respondido_em;
  end if;
  return new;
end $$;
revoke all on function public.trg_reports_responsavel() from public, anon, authenticated;
create trigger trg_reports_responsavel before insert or update on public.reports
  for each row execute function public.trg_reports_responsavel();

commit;
