-- C0-B7 (EMERGÊNCIA) — o envio de comprovante falhava com "permission denied for table masterlist"
-- Causa: o gatilho trg_confirmar_pagamento (em pagamento_demandas) chama fn_confirmar_pagamento(), que mexe na masterlist com a permissão de
-- QUEM ENVIA (a joiner). Desde o B1 (pago_* travado) essa gravação é negada e derruba o envio inteiro.
-- Correção mínima: DESLIGAR só esse gatilho. Nada é apagado: função, gatilho e dados continuam; a reversão é um comando.
-- A marcação de "pago" na masterlist segue pelo caminho seguro: site -> Apps Script (confirmar) -> planilha -> sync (service_role).
-- Tudo em uma transação com registro e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;

create table if not exists emergencia.c0b_estado_anterior (
  id            bigint generated always as identity primary key,
  registrado_em timestamptz not null default now(),
  etapa         text not null,
  objeto        text not null,
  detalhe       text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; v_estado "char";
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B7') then
    raise exception 'C0-B7 já foi aplicada: o estado anterior já está registrado e não será sobrescrito.';
  end if;
  if to_regclass('public.pagamento_demandas') is null then raise exception 'public.pagamento_demandas não existe. Nada foi alterado.'; end if;
  select count(*) into n from pg_trigger t
   where t.tgrelid = 'public.pagamento_demandas'::regclass and t.tgname = 'trg_confirmar_pagamento' and not t.tgisinternal
     and t.tgfoid = 'public.fn_confirmar_pagamento'::regproc;
  if n <> 1 then raise exception 'O gatilho trg_confirmar_pagamento (função fn_confirmar_pagamento) não foi encontrado como esperado. Nada foi alterado.'; end if;
  select t.tgenabled into v_estado from pg_trigger t where t.tgrelid = 'public.pagamento_demandas'::regclass and t.tgname = 'trg_confirmar_pagamento';
  if v_estado <> 'O' then raise exception 'O gatilho não está habilitado normalmente (estado %). Nada foi alterado.', v_estado; end if;
end $$;

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B7', 'gatilho trg_confirmar_pagamento', pg_get_triggerdef(t.oid) || ' | tgenabled=' || t.tgenabled::text
from pg_trigger t where t.tgrelid = 'public.pagamento_demandas'::regclass and t.tgname = 'trg_confirmar_pagamento';

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B7', 'função fn_confirmar_pagamento (definição)', pg_get_functiondef('public.fn_confirmar_pagamento'::regproc);

insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'B7', 'impressão de pagamento_demandas',
       'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(status, 'null'), E'\n' order by id), ''))
from public.pagamento_demandas;

alter table public.pagamento_demandas disable trigger trg_confirmar_pagamento;

do $$
declare n integer; v_antes text; v_depois text;
begin
  select count(*) into n from pg_trigger t
   where t.tgrelid = 'public.pagamento_demandas'::regclass and t.tgname = 'trg_confirmar_pagamento' and t.tgenabled = 'D';
  if n <> 1 then raise exception 'O gatilho não ficou desligado. Transação desfeita.'; end if;
  -- função e gatilho continuam existindo (nada apagado)
  if to_regprocedure('public.fn_confirmar_pagamento()') is null then raise exception 'A função fn_confirmar_pagamento sumiu. Transação desfeita.'; end if;
  -- os outros gatilhos continuam como estavam
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and not t.tgisinternal and t.tgenabled <> 'O' and t.tgname <> 'trg_confirmar_pagamento';
  if n > 0 then raise exception 'Outro gatilho está desabilitado (% encontrado(s)). Transação desfeita.', n; end if;
  select detalhe into v_antes from emergencia.c0b_estado_anterior where etapa = 'B7' and objeto = 'impressão de pagamento_demandas';
  select 'linhas=' || count(*) || ' md5=' || md5(coalesce(string_agg(id::text || '|' || coalesce(status, 'null'), E'\n' order by id), ''))
    into v_depois from public.pagamento_demandas;
  if v_antes is distinct from v_depois then raise exception 'pagamento_demandas mudou durante o script (% -> %). Transação desfeita.', v_antes, v_depois; end if;
end $$;

commit;
