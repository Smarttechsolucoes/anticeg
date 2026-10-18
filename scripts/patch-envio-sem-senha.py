# Tira a senha do formulário de Envio Nacional: o formulário passa a abrir sempre (sem "ACESSAR"). Uso único sobre src/App.jsx.
import os, re
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "App.jsx")
s = open(P, encoding="utf-8").read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)
# caixa de senha (2 lugares)
achou = re.findall(r'<div style=\{\{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" \}\}>\s*<div style=\{\{ display:"flex", gap:6 \}\}>\s*<input type="password" placeholder="senha".*?\{senhaErr && <div [^>]*>senha incorreta</div>\}\s*</div>', s, re.S)
assert len(achou) == 2, len(achou)
s = re.sub(r'<div style=\{\{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" \}\}>\s*<div style=\{\{ display:"flex", gap:6 \}\}>\s*<input type="password" placeholder="senha".*?\{senhaErr && <div [^>]*>senha incorreta</div>\}\s*</div>', "", s, flags=re.S)
assert "ILOVE2MIN" not in s
rep('  const [unlocked,    setUnlocked]    = useState(false);\n  const [senha,       setSenha]       = useState("");\n  const [senhaErr,    setSenhaErr]    = useState(false);\n', '')
rep('const efetivamenteUnlocked = unlocked || isAutoUnlocked || roundAberto;', 'const efetivamenteUnlocked = true;   // formulário sempre aberto (sem senha)')
rep('O formulário de envios está aberto até <strong>19 de agosto (quarta-feira)</strong>.', 'O formulário de envios está aberto.')
open(P, "w", encoding="utf-8").write(s)
print("senha removida; formulário sempre aberto")
