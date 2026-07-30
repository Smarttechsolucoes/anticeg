const SF_BASE = "https://api.superfrete.com";

const ALLOWED = {
  calculator: "/api/v0/calculator",
  cart:       "/api/v0/cart",
  checkout:   "/api/v0/checkout",
  generate:   "/api/v0/orders/generate",
  orders:     "/api/v0/orders",
  tracking:   "/api/v0/tracking",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const endpoint = req.query.endpoint;
  const path = ALLOWED[endpoint];
  if (!path) return res.status(400).json({ error: "endpoint inválido" });

  const key = process.env.SUPERFRETE_KEY;
  if (!key) return res.status(500).json({ error: "SUPERFRETE_KEY não configurada" });

  try {
    const sfRes = await fetch(`${SF_BASE}${path}`, {
      method: req.method === "GET" ? "GET" : "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "ANTICEG (nandadomarketing@gmail.com)",
      },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    const rawText = await sfRes.text();
    let data;
    try { data = JSON.parse(rawText); } catch (_) { data = { error: rawText }; }
    res.status(sfRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
