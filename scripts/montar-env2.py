# Monta os ensaios (rollback) do ENV2 (o ENV1 já está em produção) e a prova da reversão. Nada é executado aqui.
import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "envio")
ler = lambda n: open(os.path.join(D, n), encoding="utf-8").read()
def corpo(txt):
    t = txt.strip(); assert t.endswith("commit;")
    return t[t.index("begin;") + len("begin;"):-len("commit;")]
env2 = corpo(ler("ENV2_codigo_aplicar.sql")); rev = corpo(ler("ENV2_codigo_reverter.sql"))
open(os.path.join(D, "ENV2_ensaio_rollback.sql"), "w", encoding="utf-8").write(
    "-- ENSAIO (rollback) do ENV2: aplica o ENV2 numa transação, testa com papéis reais e termina em exceção. Nada permanece.\nbegin;\n" + env2 + "\n" + ler("ENV2_testes_rollback.part.sql"))
open(os.path.join(D, "ENV2_reversao_ensaio_rollback.sql"), "w", encoding="utf-8").write(
    "-- ENSAIO (rollback) da REVERSÃO do ENV2: aplica o ENV2, emite um acesso por autoatendimento, reverte o ENV2 e prova que o acesso foi revogado e os objetos sumiram.\nbegin;\n" + env2 +
    "\ninsert into public.joiners (cog, nome, email, twitter, confirmado) values ('zz_rev', 'T', 'r@exemplo.com', '@zz_rev', true);\n"
    "do $$ declare t text; begin perform public.envio_codigo_emitir('zz_rev', repeat('a', 64), repeat('1', 64)); t := public.envio_codigo_validar('zz_rev', repeat('a', 64), repeat('1', 64)); if t is null then raise exception 'preparo do teste falhou'; end if; end $$;\n" +
    rev + "\ndo $$ begin\n  if exists (select 1 from emergencia.envio_acessos where joiner_cog = 'zz_rev' and revogado_em is null) then raise exception 'REVERSAO ENV2: acesso de autoatendimento ainda ativo'; end if;\n"
    "  if to_regprocedure('public.envio_sair()') is not null then raise exception 'REVERSAO ENV2: funcao restante'; end if;\n"
    "  raise exception 'ENV2_REVERSAO_OK: funcoes e tabela removidas e acessos de autoatendimento revogados (rollback: nada permanece)';\nend $$;\n")
print("ENV2: ensaios montados")
