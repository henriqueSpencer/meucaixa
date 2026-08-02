// GET /api/history/{ticker}?range=2y&interval=1mo
// Proxy do histórico de fechamento do Yahoo (mesma fonte do DIVYVAL). O MeuCaixa é estático +
// Supabase, mas roda no Cloudflare Pages, que suporta esta Function serverless. Necessária porque
// o Yahoo bloqueia CORS (não dá pra chamar do navegador) e a brapi passou a cobrar token pra
// histórico. Só leitura de preço público; cache no edge (caches.default) por 6h.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function jsonRes(obj, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}

export async function onRequestGet(context) {
  const tk = String(context.params.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!tk) return jsonRes({ ticker: tk, series: [], erro: "ticker vazio" }, 400);
  const url = new URL(context.request.url);
  const range = (url.searchParams.get("range") || "2y").replace(/[^a-z0-9]/gi, "");
  const interval = (url.searchParams.get("interval") || "1mo").replace(/[^a-z0-9]/gi, "");

  let cache = null;
  const cacheKey = new Request(`https://meucaixa.internal/hist/${tk}/${range}/${interval}`);
  try {
    cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json().then((j) => jsonRes(j, 200, 21600));
  } catch (_) {}

  const sym = tk.endsWith(".SA") ? tk : tk + ".SA";
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${interval}`,
      { headers: { "User-Agent": UA } }
    );
    if (!r.ok) return jsonRes({ ticker: tk, series: [], erro: "yahoo " + r.status }, 502);
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const ts = res?.timestamp || [];
    const cl = res?.indicators?.quote?.[0]?.close || [];
    // série [ym, close] — mensal usa o fechamento do mês; ignora buracos (null)
    const byMonth = {};
    for (let i = 0; i < ts.length; i++) {
      if (cl[i] == null) continue;
      const ym = new Date(ts[i] * 1000).toISOString().slice(0, 7);
      byMonth[ym] = Math.round(cl[i] * 100) / 100; // último do mês vence
    }
    const series = Object.keys(byMonth).sort().map((ym) => [ym, byMonth[ym]]);
    const payload = { ticker: tk, series };
    if (cache && series.length) {
      const body = new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json", "cache-control": "max-age=21600" },
      });
      context.waitUntil(cache.put(cacheKey, body));
    }
    return jsonRes(payload, 200, series.length ? 21600 : 0);
  } catch (e) {
    return jsonRes({ ticker: tk, series: [], erro: String(e).slice(0, 120) }, 502);
  }
}
