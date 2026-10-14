-- LABORATÓRIO — reproduz as travas da contenção C0 (B1 a B4) que já existem na produção, para o ensaio partir do MESMO estado de hoje.
-- Só para banco de ensaio. Rode depois do 04_tabelas_j4c.sql.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
-- masterlist: pago_*, pag_*, venc_* só o servidor altera (B1/B4); o resto segue editável como hoje
revoke update on public.masterlist from anon, authenticated;
grant update (ceg, cog, nome, nome_do_item, valor_item, frete_inter, taxa_rf, status, info_adicionais, na_loja, id_linha) on public.masterlist to anon, authenticated;
-- pagamento_demandas (B2) e multas_pagas (B3): só o servidor/gatilho escreve
revoke update, delete on public.pagamento_demandas from anon, authenticated;
revoke insert, update, delete on public.multas_pagas from anon, authenticated;
