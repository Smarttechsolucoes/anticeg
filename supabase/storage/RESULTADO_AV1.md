# Resultado do AV1 — aplicado em produção em 17/10/2026 (15:27 UTC)

**Antes (conferido imediatamente antes):** bucket público sem limite nem tipo; 206 fotos, todas `<pasta>/avatar.jpg`, JPEG, nenhuma acima de 256 KB (hash dos nomes `10dc76b8…`, hash de tamanhos/atualização `4fd34c3a…`); 18 policies em `storage.objects` (hash `aea8961d…`), 8 delas de avatars; 193 joiners com `foto_perfil` apontando para o bucket; sem sync em andamento; permissões e dados idênticos ao fim da Fase A.
**Aplicação:** `AV1_avatars_endurecer_aplicar.sql` (transação única, com 4 sondas funcionais desfeitas dentro dela) sem erro.
**Verificador (7 linhas):** bucket `true | 262144 | {image/jpeg}`; 4 policies novas; 0 policies de escrita sem o filtro de caminho; 0 policies antigas de avatars; fotos antes = depois (`quantidade=206 md5=10dc76b8…` nos dois lados); AV1 registrado; `allow upload` exclui avatars e anti-store.
**Depois:** 14 policies (as 8 de avatars saíram e entraram 4; as outras 10 são idênticas); hash dos nomes **e** dos tamanhos/atualizações das fotos **idênticos**; permissões de tabelas/funções e impressão dos dados **idênticas**.
**Sondas (desfeitas):** visitante insere `<pasta>/avatar.jpg` → permitido (caminho do site); `invasor.html`, subpasta `a/b/avatar.jpg` → negados; conta logada insere `foto.png` → negado; visitante lista fotos → permitido (leitura pública). **12 de 12 fotos de perfil amostradas abriram pela URL pública gravada** (HTTP 200, `image/jpeg`).
**Limite:** sem login ainda é possível trocar/apagar a foto de OUTRA joiner pelo caminho dela; fecha no J5 (só a dona do COG ou a administradora).
**Reversão:** `AV1_avatars_endurecer_reverter_protegido.sql` (frase `AUTORIZO REABRIR AVATARS`; devolve as 8 policies e o bucket como estavam).
