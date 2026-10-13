-- C0-B4 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE a vulnerabilidade)
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
-- Devolve o UPDATE por coluna a anon/authenticated SOMENTE nas 7 colunas do B4 (as pago_* do B1 continuam travadas).
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR VENCIMENTOS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR VENCIMENTOS' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto permitiria que qualquer pessoa altere vencimentos (e, com isso, multas).';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B4') then
    raise exception 'Não há estado anterior do B4 registrado.';
  end if;
end $$;

grant update (pag_item, pag_frete, pag_taxa, venc_item, venc_frete, venc_rf, venc_taxa) on public.masterlist to anon, authenticated;

-- permite refazer o B4 depois (o registro do estado antigo é arquivado, não apagado)
update emergencia.c0b_estado_anterior set etapa = 'B4-revertido' where etapa = 'B4';

do $$ begin raise notice 'Reversão do B4 feita: pag_* e venc_* voltaram a ser editáveis pela API.'; end $$;

commit;
