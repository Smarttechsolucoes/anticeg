# Novo aviso do formulário de Envio Nacional (storage desatualizado) e solicitação sem exigir item fotografado. Uso único sobre src/App.jsx.
import os, re
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "App.jsx")
s = open(P, encoding="utf-8").read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)
# texto do aviso: substitui a frase e o quadro "fotografados no storage"
ini = s.index("                O formulário de envios está aberto.\n")
fim = s.index("              </div>\n            </div>\n\n            {/* conteúdo — bloqueado antes do unlock */}")
novo = '''                A fim de não atrasar o envio de <strong>OUTUBRO</strong>, estou liberando o formulário com o storage <strong>DESATUALIZADO</strong>. Caso você tenha itens em mãos e a foto não esteja cadastrada, você pode solicitar o envio normalmente. Será anexada uma foto de todos os itens disponíveis na casa da GOM na hora do pagamento do frete.
              </div>
              <div style={{ marginTop:9, fontSize:12, color:"rgba(245,240,232,.65)", lineHeight:1.6 }}>
                Peço desculpa pelo transtorno.
'''
s = s[:ini] + novo + s[fim:]
# sem foto cadastrada também pode solicitar
rep('    if (storageSelecionados.size === 0) missing.push("itens selecionados");\n', '')
open(P, "w", encoding="utf-8").write(s)
print("aviso atualizado; solicitação sem item fotografado liberada")
