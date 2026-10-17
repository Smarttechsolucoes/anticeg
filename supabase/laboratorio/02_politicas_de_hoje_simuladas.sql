-- LABORATÓRIO — reproduz o estado de HOJE das permissões (todas abertas ao visitante), para ensaiar a transição do J4.
-- Só para banco de ensaio. Na produção essas regras já existem; este arquivo NÃO deve ser rodado lá.
alter table public.joiners enable row level security;
alter table public.masterlist enable row level security;
alter table public.pagamento_demandas enable row level security;
alter table public.multas_pagas enable row level security;
alter table public.claims enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.cal_eventos enable row level security;
create policy anon_all on public.joiners for all to anon using (true) with check (true);
create policy anon_all on public.masterlist for all to anon using (true) with check (true);
create policy "joiner insert pagamento_demandas" on public.pagamento_demandas for insert to public with check (status = 'em_analise' and motivo_rejeicao is null);
create policy "joiner select pagamento_demandas" on public.pagamento_demandas for select to public using (true);
create policy multas_pagas_select_all on public.multas_pagas for select using (true);
create policy anon_all on public.claims for all to anon using (true) with check (true);
create policy anon_all on public.push_subscriptions for all to anon using (true) with check (true);
create policy leitura on public.cal_eventos for select to public using (true);
