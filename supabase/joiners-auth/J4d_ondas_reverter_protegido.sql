-- J4d — REVERSÃO PROTEGIDA: volta ativar_minha_conta e entrar_com_arroba às versões do J1/J4a (sem conferir a liberação) e remove as tabelas de ondas.
-- ATENÇÃO: depois disto a ativação fica FECHADA para todo usuário logado (só o servidor executa ativar_minha_conta, como após o J1c), e o pedido de código deixa de funcionar até reaplicar o J4d. Nenhuma conta nem senha é alterada.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER CONTROLE DE ONDAS
begin
  if confirmacao is distinct from 'AUTORIZO REMOVER CONTROLE DE ONDAS' then raise exception 'Reversão NÃO executada: falta a confirmação por escrito.'; end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J4d') then raise exception 'Não há registro do J4d.'; end if;
end $$;

do $$
declare r record;
begin
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'J4d' and objeto like 'funcao %' loop execute r.detalhe; end loop;
  -- volta ao estado do J1c: a ativação fica FECHADA para usuário logado (só o servidor executa); nada fica aberto sem a conferência das ondas
  revoke all on function public.ativar_minha_conta(text) from public, anon, authenticated;
  grant execute on function public.ativar_minha_conta(text) to service_role;
  drop function if exists public.ativacao_liberada(bigint);
  drop table if exists public.ativacao_ondas;
  drop table if exists public.ativacao_estado;
  delete from public.tentativas_acesso where tipo = 'ativacao';
  alter table public.tentativas_acesso drop constraint if exists tentativas_acesso_tipo_check;
  alter table public.tentativas_acesso add constraint tentativas_acesso_tipo_check check (tipo in ('login', 'recuperar'));
end $$;

update emergencia.c0b_estado_anterior set etapa = 'J4d-revertido' where etapa = 'J4d';
do $$ begin raise notice 'Reversão do J4d feita: ativação sem ondas.'; end $$;

commit;
