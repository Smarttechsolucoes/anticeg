// API SIMULADA (nada é enviado pela rede) para testar os scripts de verificação do lançamento. Carregue com: node --import ./scripts/lancamento/_api-simulada.mjs <script>
// Padrão: simula o banco já PROTEGIDO. MOCK_MODO=aberta simula o banco de HOJE (o visitante lê tudo). MOCK_SIGNUP_OFF=1 simula o cadastro de usuários do Auth desligado.
const ABERTA = process.env.MOCK_MODO === "aberta";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const tok = cog => `${b64({ alg: "HS256" })}.${b64({ role: "authenticated", marca: cog })}.x`;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const auth = String((init.headers || {}).Authorization || "").replace("Bearer ", "");
  const marca = (() => { try { return JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString()).marca; } catch { return null; } })();
  const resp = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.pathname.endsWith("/auth/v1/settings")) return resp(200, { external: { email: true, google: false }, disable_signup: process.env.MOCK_SIGNUP_OFF === "1", mailer_autoconfirm: false });
  if (u.pathname.includes("/functions/v1/login-joiner")) return resp(200, { access_token: tok(JSON.parse(init.body).cog) });
  if (u.pathname.includes("/storage/v1/object/public")) return resp(400, { error: "Bucket not found" });
  if (u.pathname.includes("/storage/v1/object/list")) return resp(401, { message: "permission denied" });
  if (u.pathname.startsWith("/storage/v1/object/") && init.method === "POST") return resp(403, { message: "row-level security" });
  if (u.pathname.includes("/rpc/")) {
    const fn = u.pathname.split("/").pop();
    if (!marca) return resp(401, { message: "permission denied for function", code: "42501" });
    if (fn === "meu_cog") return resp(200, marca);
    if (fn === "ceg_resumo") return resp(200, [{ ceg: "SKZOO" }]);
    if (fn === "ceg_itens") return resp(200, [{ id: 1, cog: "x", nome: "X", nome_do_item: "i", status: "s" }]);
    if (fn === "comprovante_assinavel") return resp(200, false);
    return resp(200, null);
  }
  if (u.pathname.includes("/rest/v1/")) {
    const t = u.pathname.split("/").pop();
    if (!marca && ABERTA && t !== "config") return resp(200, [{ cog: "ana", joiner_cog: "ana", email: "ana@exemplo.com", cpf: "000" }]);
    if (!marca) return t === "joiners_publico" ? resp(200, [{ cog: "x", nome_site: "X" }]) : t === "config" ? resp(200, []) : resp(401, { message: "permission denied for table " + t, code: "42501" });
    if (u.searchParams.get("cog") || u.searchParams.get("joiner_cog")) return resp(200, []);
    if (t === "claim_reservas_quadro") return resp(200, [{ joiner_nome: null, is_admin: false }]);
    const col = (u.searchParams.get("select") || "id").split(",")[0];
    return resp(200, [{ [col]: marca }]);
  }
  return resp(404, {});
};
