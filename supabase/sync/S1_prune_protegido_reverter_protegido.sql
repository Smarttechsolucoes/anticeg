-- S1 — REVERSÃO PROTEGIDA. Só roda com a frase abaixo digitada (troque o texto vazio entre aspas).
-- Remove a função, o gatilho e a função auxiliar. O arquivo masterlist_exclusoes só é apagado se estiver vazio ou com a frase ampliada.
-- ATENÇÃO: depois de reverter, o sync antigo (que apaga direto) volta a ser perigoso: só reverta junto com o script antigo.
begin;
do $$
declare
  confirmacao text := '';
  n bigint;
begin
  if confirmacao <> 'AUTORIZO REMOVER A PROTECAO DO SYNC' and confirmacao <> 'AUTORIZO REMOVER A PROTECAO DO SYNC E O ARQUIVO' then
    raise exception 'Falta a confirmação. Nada foi alterado.';
  end if;
  select count(*) into n from public.masterlist_exclusoes;
  if n > 0 and confirmacao <> 'AUTORIZO REMOVER A PROTECAO DO SYNC E O ARQUIVO' then
    raise exception 'Há % linhas arquivadas (restauráveis). Para apagá-las use a frase terminada em "E O ARQUIVO". Nada foi alterado.', n;
  end if;
  drop trigger if exists trg_masterlist_protege_claims on public.masterlist;
  drop function if exists public.trg_masterlist_protege_claims();
  drop function if exists public.prune_masterlist(bigint[], integer, integer);
  drop function if exists public.masterlist_motivos_protecao(bigint);
  drop table if exists public.masterlist_exclusoes;
  delete from emergencia.c0b_estado_anterior where etapa = 'S1';
end $$;
commit;
select 'S1 revertido' as resultado;
