# Monta os ensaios (rollback) do JOINERS1 a partir dos arquivos de aplicar/reverter/testes. Nada é executado aqui.
import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "envio")
ler = lambda n: open(os.path.join(D, n), encoding="utf-8").read()
def corpo(txt):
    t = txt.strip(); assert t.endswith("commit;")
    return t[t.index("begin;") + len("begin;"):-len("commit;")]
env1 = corpo(ler("ENV1_acesso_aplicar.sql")); j1 = corpo(ler("JOINERS1_aplicar.sql")); rev = corpo(ler("JOINERS1_reverter.sql"))
open(os.path.join(D, "JOINERS1_ensaio_rollback.sql"), "w", encoding="utf-8").write(
    "-- ENSAIO (rollback) do JOINERS1: aplica ENV1 + JOINERS1 numa transação, testa com papéis reais e termina em exceção. Nada permanece.\nbegin;\n" + env1 + "\n" + j1 + "\n" + ler("JOINERS1_testes_rollback.part.sql"))
priv = "select md5(coalesce(string_agg(grantee || privilege_type || column_name, '|' order by grantee, privilege_type, column_name), '')) h from information_schema.column_privileges where table_schema = 'public' and table_name = 'joiners' and grantee in ('anon','authenticated','public')"
open(os.path.join(D, "JOINERS1_reversao_ensaio_rollback.sql"), "w", encoding="utf-8").write(
    "-- ENSAIO (rollback) da REVERSÃO do JOINERS1: aplica ENV1 + JOINERS1, reverte só o JOINERS1 e prova que os privilégios voltam idênticos ao original.\nbegin;\n"
    "create temp table _priv_antes on commit drop as " + priv + ";\n" + env1 + "\n" + j1 + "\n" + rev +
    "\ndo $$ begin\n  if (" + priv + ") is distinct from (select h from _priv_antes) then raise exception 'REVERSAO JOINERS1: privilegios diferentes do original'; end if;\n"
    "  raise exception 'JOINERS1_REVERSAO_OK: apos aplicar e reverter, os privilegios de coluna e tabela de joiners ficam IDENTICOS ao original (rollback: nada permanece)';\nend $$;\n")
print("JOINERS1: ensaios montados")
