/* =========================================================================
   Meu Caixa — protótipo de app de finanças (HTML/CSS/JS puro, sem build)
   Estrutura:
     1. Tokens de cor
     2. Dados de exemplo (contas, transações, extrato p/ conciliação, categorias)
     3. Helpers (formatação, ícones SVG)
     4. Componentes de UI (badge, valor monetário, KPI)
     5. Gráficos desenhados em SVG (barras, rosca, área)
     6. Telas (views) — cada aba é uma função que devolve HTML
     7. Modal "nova transação" — campos mudam conforme o tipo
     8. Estado + renderização + eventos
   Tudo é mock. A "sugestão" da conciliação aqui é fixa; num app real
   viria de regras/histórico/ML sobre a descrição do extrato.
   ========================================================================= */

/* ---------- 1. tokens ---------- */
const C = {
  receita: "#10B981",
  despesa: "#F43F5E",
  transfer: "#3B82F6",
  reembolso: "#8B5CF6",
  patrimonio: "#F59E0B",
  brand: "#0D9488",
};
const donutPalette = ["#0D9488", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#14B8A6", "#6366F1", "#EC4899"];

/* dados reais do Orçamento Fácil (dados.js) — cai nos mocks se ausente */
const OF = (typeof window !== "undefined" && window.OF_DATA) ? window.OF_DATA : null;
const REF_LABEL = OF ? OF.refMonthLabel : "Julho";

/* ---------- 2. dados ---------- */
const accounts = OF ? OF.accounts : [
  { id: "cc", nome: "Conta Corrente", sub: "Nubank", tipo: "banco", saldo: 8450, grupo: "fin" },
  { id: "pp", nome: "Poupança", sub: "Caixa", tipo: "banco", saldo: 22300, grupo: "fin" },
  { id: "cred", nome: "Cartão de Crédito", sub: "Fatura em aberto", tipo: "cartao", saldo: -3180, grupo: "fin" },
  { id: "cart", nome: "Carteira", sub: "Dinheiro", tipo: "dinheiro", saldo: 320, grupo: "fin" },
  { id: "inv", nome: "Investimentos", sub: "Tesouro & CDB", tipo: "invest", saldo: 45700, grupo: "fin" },
  { id: "carro", nome: "Carro — Honda City", sub: "Alocação de patrimônio", tipo: "patrimonio", saldo: 78000, grupo: "pat", alocado: 82000, custo: -4000 },
];

const monthly = OF ? OF.monthly : [
  { mes: "Fev", receita: 14200, despesa: 9800 },
  { mes: "Mar", receita: 15100, despesa: 10400 },
  { mes: "Abr", receita: 13800, despesa: 11200 },
  { mes: "Mai", receita: 16500, despesa: 9600 },
  { mes: "Jun", receita: 15300, despesa: 12100 },
  { mes: "Jul", receita: 15800, despesa: 8900 },
];

const patrimonioSerie = OF ? OF.patrimonioSerie : [
  { mes: "Fev", valor: 132000 },
  { mes: "Mar", valor: 136500 },
  { mes: "Abr", valor: 138000 },
  { mes: "Mai", valor: 143800 },
  { mes: "Jun", valor: 147000 },
  { mes: "Jul", valor: 151590 },
];

const despesaPorCat = OF ? OF.despesaPorCat : [
  { nome: "Moradia", valor: 2690 },
  { nome: "Alimentação", valor: 1980 },
  { nome: "Transporte", valor: 1120 },
  { nome: "Impostos & Contab.", valor: 890 },
  { nome: "Saúde", valor: 760 },
  { nome: "Lazer", valor: 640 },
  { nome: "Educação", valor: 450 },
  { nome: "Pessoal", valor: 370 },
];

const catTree = OF ? OF.catTree : {
  receita: [
    { nome: "Trabalho", subs: ["Pró-labore PJ", "Freelance", "Consultoria"], total: 15800 },
    { nome: "Rendimentos", subs: ["Juros", "Dividendos"], total: 0 },
    { nome: "Reembolsos", subs: ["Despesas de cliente", "Outros"], total: 540 },
    { nome: "Vendas", subs: ["Itens usados"], total: 0 },
  ],
  despesa: [
    { nome: "Moradia", subs: ["Aluguel", "Condomínio", "Energia", "Internet"], total: 2690 },
    { nome: "Alimentação", subs: ["Supermercado", "Restaurante", "Delivery"], total: 1980 },
    { nome: "Transporte", subs: ["Combustível", "Aplicativos", "Manutenção", "Passagens"], total: 1120 },
    { nome: "Impostos & Contabilidade", subs: ["DAS Simples", "Contabilidade"], total: 890 },
    { nome: "Saúde", subs: ["Plano", "Farmácia", "Consultas"], total: 760 },
    { nome: "Lazer", subs: ["Streaming", "Bares", "Viagens"], total: 640 },
    { nome: "Educação", subs: ["Cursos", "Livros"], total: 450 },
    { nome: "Pessoal", subs: ["Assinaturas", "Roupas"], total: 370 },
  ],
};

const initialTx = OF ? OF.tx : [
  { id: 1, data: "15/07", desc: "Pró-labore", tipo: "receita", cat: "Trabalho", sub: "Pró-labore PJ", conta: "Conta Corrente", valor: 12000, status: "conciliado" },
  { id: 2, data: "14/07", desc: "iFood", tipo: "despesa", cat: "Alimentação", sub: "Delivery", conta: "Cartão de Crédito", valor: -68.9, status: "conciliado" },
  { id: 3, data: "13/07", desc: "Aporte investimentos", tipo: "transferencia", origem: "Conta Corrente", destino: "Investimentos", valor: 3000, status: "conciliado" },
  { id: 4, data: "12/07", desc: "Posto Shell", tipo: "despesa", cat: "Transporte", sub: "Combustível", conta: "Cartão de Crédito", valor: -220, status: "pendente" },
  { id: 5, data: "11/07", desc: "Reembolso viagem cliente", tipo: "reembolso", cat: "Transporte", sub: "Passagens", conta: "Conta Corrente", valor: 540, status: "conciliado" },
  { id: 6, data: "10/07", desc: "Aluguel", tipo: "despesa", cat: "Moradia", sub: "Aluguel", conta: "Conta Corrente", valor: -1800, status: "conciliado" },
  { id: 7, data: "09/07", desc: "DAS Simples Nacional", tipo: "despesa", cat: "Impostos & Contabilidade", sub: "DAS Simples", conta: "Conta Corrente", valor: -890, status: "conciliado" },
  { id: 8, data: "05/07", desc: "Freela edtech", tipo: "receita", cat: "Trabalho", sub: "Freelance", conta: "Conta Corrente", valor: 3800, status: "conciliado" },
  { id: 9, data: "03/07", desc: "Nordestão", tipo: "despesa", cat: "Alimentação", sub: "Supermercado", conta: "Cartão de Crédito", valor: -412, status: "conciliado" },
  { id: 10, data: "01/07", desc: "Compra do carro", tipo: "transferencia", origem: "Conta Corrente", destino: "Carro — Honda City", valor: 82000, status: "conciliado", nota: "Alocação de patrimônio" },
];

const initialRecon = [
  { id: "r1", raw: "PAG*IFOOD 88 SAOPAULO", valor: -54.3, sug: { tipo: "despesa", cat: "Alimentação", sub: "Delivery", conta: "Cartão de Crédito" }, conf: 96, match: null, status: "pendente" },
  { id: "r2", raw: "POSTO SHELL BR NATAL RN", valor: -220, sug: { tipo: "despesa", cat: "Transporte", sub: "Combustível", conta: "Cartão de Crédito" }, conf: 98, match: "Posto Shell · 12/07 · pendente", status: "pendente" },
  { id: "r3", raw: "TED RECEBIDA JOAO S CLIENTE", valor: 2500, sug: { tipo: "receita", cat: "Trabalho", sub: "Freelance", conta: "Conta Corrente" }, conf: 71, match: null, status: "pendente" },
  { id: "r4", raw: "NORDESTAO SUPERM NATAL", valor: -388.7, sug: { tipo: "despesa", cat: "Alimentação", sub: "Supermercado", conta: "Cartão de Crédito" }, conf: 94, match: null, status: "pendente" },
  { id: "r5", raw: "NETFLIX.COM ASSINATURA", valor: -44.9, sug: { tipo: "despesa", cat: "Lazer", sub: "Streaming", conta: "Cartão de Crédito" }, conf: 99, match: null, status: "pendente" },
  { id: "r6", raw: "SAQUE 24HORAS TERMINAL", valor: -200, sug: { tipo: "transferencia", origem: "Conta Corrente", destino: "Carteira" }, conf: 64, match: null, status: "pendente" },
  { id: "r7", raw: "PIX ENVIADO APLICACAO", valor: -1000, sug: { tipo: "transferencia", origem: "Conta Corrente", destino: "Investimentos" }, conf: 87, match: null, status: "pendente" },
];

accounts.forEach((a, i) => { if (a.arquivada === undefined) a.arquivada = false; a.ordem = i; });
const netWorth = () => accounts.filter((a) => !a.arquivada).reduce((s, a) => s + a.saldo, 0);
const patrimonioLiquido = accounts.reduce((s, a) => s + a.saldo, 0);
const receitasMes = OF ? OF.receitasMes : 15800;
const despesasMes = OF ? OF.despesasMes : 8900;

/* helpers de conta / drill */
const acctById = (id) => accounts.find((a) => a.id === id);
const acctTx = (nome) => state.tx.filter((t) => t.conta === nome || t.origem === nome || t.destino === nome);
// valor do lançamento sob a ótica DESTA conta (transferência: saída se origem, entrada se destino)
function txValorConta(t, nome) {
  if (t.tipo === "transferencia") return t.destino === nome ? Math.abs(t.valor) : -Math.abs(t.valor);
  return t.valor;
}
// quebra de categorias de um mês/tipo (mock: distribui o total do mês pelas proporções conhecidas)
function drillCats(mesLabel, tipo) {
  const m = monthly.find((x) => x.mes === mesLabel);
  if (!m) return [];
  if (tipo === "despesa") {
    const soma = despesaPorCat.reduce((s, d) => s + d.valor, 0);
    return despesaPorCat.map((d) => ({ nome: d.nome, valor: Math.round((d.valor / soma) * m.despesa) }));
  }
  const base = catTree.receita.filter((c) => c.total > 0);
  const soma = base.reduce((s, c) => s + c.total, 0);
  return base.map((c) => ({ nome: c.nome, valor: Math.round((c.total / soma) * m.receita) }))
    .sort((a, b) => b.valor - a.valor);
}

const TIPOS = {
  receita: { label: "Receita", cor: C.receita, icon: "trending-up" },
  despesa: { label: "Despesa", cor: C.despesa, icon: "trending-down" },
  transferencia: { label: "Transferência", cor: C.transfer, icon: "transfer" },
  reembolso: { label: "Reembolso", cor: C.reembolso, icon: "undo" },
};
const ACCT_ICON = { banco: "landmark", cartao: "credit-card", dinheiro: "banknote", invest: "invest", patrimonio: "car" };
const PAGE = {
  dashboard: ["Visão geral", "Como está seu dinheiro em Julho de 2026"],
  contas: ["Contas", "Saldos e alocações de patrimônio"],
  transacoes: ["Transações", "Receitas, despesas, transferências e reembolsos"],
  conciliacao: ["Conciliação", "Importe o extrato e confirme as sugestões"],
  categorias: ["Categorias", "Estrutura de receitas e despesas"],
};

/* ---------- 3. helpers ---------- */
const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtShort = (n) => "R$ " + Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const TODAY_ISO = "2026-07-18"; // "hoje" do protótipo (dados mock são de Jul/2026)
const parseValor = (s) => parseFloat(String(s || "").replace(/\./g, "").replace(",", ".")) || 0;
const dataBR = (iso) => { const [, m, d] = (iso || TODAY_ISO).split("-"); return `${d}/${m}`; };

const ICON = {
  "layout": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  "wallet": '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>',
  "transfer": '<polyline points="16 3 21 8 16 13"/><line x1="21" y1="8" x2="4" y2="8"/><polyline points="8 11 3 16 8 21"/><line x1="3" y1="16" x2="20" y2="16"/>',
  "checklist": '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="m4 6 1 1 2-2"/><path d="m4 12 1 1 2-2"/><path d="m4 18 1 1 2-2"/>',
  "folder-tree": '<rect x="3" y="4" width="5" height="5" rx="1"/><path d="M11 6.5h9"/><path d="M11 12h9"/><path d="M11 17.5h9"/><path d="M7 8v10h4"/><path d="M7 13.5h4"/>',
  "plus": '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  "trending-up": '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  "trending-down": '<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>',
  "undo": '<path d="M3 8a9 9 0 1 0 2.5-5.5"/><polyline points="3 2 3 8 9 8"/>',
  "building": '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M4 21h16"/><rect x="10" y="15" width="4" height="6"/><line x1="9" y1="8" x2="9.01" y2="8"/><line x1="15" y1="8" x2="15.01" y2="8"/><line x1="9" y1="11.5" x2="9.01" y2="11.5"/><line x1="15" y1="11.5" x2="15.01" y2="11.5"/>',
  "credit-card": '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="11" y2="15"/>',
  "landmark": '<line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="5" y1="10" x2="5" y2="21"/><line x1="9.5" y1="10" x2="9.5" y2="21"/><line x1="14.5" y1="10" x2="14.5" y2="21"/><line x1="19" y1="10" x2="19" y2="21"/>',
  "car": '<path d="M5 13l1.6-4.7A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.3L19 13"/><path d="M4 13h16v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="15.5" r="1"/><circle cx="16.5" cy="15.5" r="1"/>',
  "invest": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  "banknote": '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/><line x1="6" y1="12" x2="6.5" y2="12"/><line x1="17.5" y1="12" x2="18" y2="12"/>',
  "check": '<polyline points="20 6 9 17 4 12"/>',
  "pencil": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  "x": '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  "upload": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 9 12 4 17 9"/><line x1="12" y1="4" x2="12" y2="16"/>',
  "sparkles": '<path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"/><path d="M18.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  "chevron-down": '<polyline points="6 9 12 15 18 9"/>',
  "arrow-right": '<line x1="4" y1="12" x2="18" y2="12"/><polyline points="13 7 18 12 13 17"/>',
  "circle-alert": '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.3" r="0.6" fill="currentColor" stroke="none"/>',
  "coins": '<circle cx="9" cy="9" r="6"/><path d="M15.5 5.2a6 6 0 1 1 0 13.6"/>',
  "home": '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  "utensils": '<path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18"/><path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"/>',
  "receipt": '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
  "heart": '<path d="M20.8 6.6a5 5 0 0 0-7.1 0L12 8.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  "play-circle": '<circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z"/>',
  "book": '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 5 3 5 3s5-1.5 5-3v-5"/>',
  "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  "briefcase": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  "tag": '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  "chevron-up": '<polyline points="18 15 12 9 6 15"/>',
  "sliders": '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  "grip": '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  "more-vertical": '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  "archive": '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  "arrow-left": '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>',
  "list": '<line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
};

/* categoria → ícone (grade de seleção do modal) */
const CAT_ICON = {
  "Moradia": "home", "Alimentação": "utensils", "Transporte": "car",
  "Impostos & Contabilidade": "receipt", "Saúde": "heart", "Lazer": "play-circle",
  "Educação": "book", "Pessoal": "user",
  "Trabalho": "briefcase", "Rendimentos": "coins", "Reembolsos": "undo", "Vendas": "tag",
};
const catIcon = (nome) => CAT_ICON[nome] || "wallet";
function ic(name, size = 16) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ""}</svg>`;
}

/* ---------- 4. componentes ---------- */
function badgeHTML(tipo, small) {
  const t = TIPOS[tipo];
  return `<span class="badge" style="color:${t.cor};background:${t.cor}1A;font-size:${small ? 11 : 12}px">${ic(t.icon, small ? 11 : 13)} ${t.label}</span>`;
}
function moneyHTML(tipo, valor, big) {
  const positivo = tipo === "receita" || tipo === "reembolso";
  const neutro = tipo === "transferencia";
  const cor = neutro ? "#64748B" : positivo ? C.receita : C.despesa;
  const sinal = neutro ? "" : positivo ? "+" : "−";
  return `<span class="num" style="color:${cor};font-weight:600;font-size:${big ? 15 : 14}px">${sinal} ${fmt(Math.abs(valor))}</span>`;
}
function kpi(label, valor, delta, good, iconName, cor) {
  return `<div class="card kpi"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ic" style="background:${cor}1A;color:${cor}">${ic(iconName, 16)}</span></div><div class="kpi-val num">${fmt(valor)}</div>${delta ? `<div class="kpi-delta" style="color:${good ? C.receita : C.despesa}">${delta}</div>` : ""}</div>`;
}

/* ---------- 5. gráficos SVG ---------- */
function barChartSVG(data) {
  const W = 520, H = 240, padL = 44, padR = 12, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...data.flatMap((d) => [d.receita, d.despesa]));
  const gridMax = Math.ceil(max / 4000) * 4000;
  const n = data.length, bw = 14, gap = 4;
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const val = (gridMax * i) / 4, y = padT + plotH - (val / gridMax) * plotH;
    g += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--hair)"/>`;
    g += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--subtle)">${fmtShort(val)}</text>`;
  }
  data.forEach((d, i) => {
    const cx = padL + (i + 0.5) * (plotW / n);
    [["receita", C.receita, -1, "Receitas"], ["despesa", C.despesa, 1, "Despesas"]].forEach(([k, col, side, lbl]) => {
      const h = (d[k] / gridMax) * plotH, x = side < 0 ? cx - bw - gap / 2 : cx + gap / 2, y = padT + plotH - h;
      g += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${col}"><title>${lbl} · ${d.mes}: ${fmt(d[k])}</title></rect>`;
    });
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--subtle)">${d.mes}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" font-family="Inter,sans-serif">${g}</svg>`;
}

function donutSVG(data, colors) {
  const cx = 100, cy = 100, r = 68, sw = 26, circ = 2 * Math.PI * r;
  const pal = colors || donutPalette;
  const total = data.reduce((s, d) => s + d.valor, 0) || 1;
  let off = 0, segs = "";
  data.forEach((d, i) => {
    const len = (d.valor / total) * circ, dash = Math.max(len - 2, 0.5);
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${pal[i % pal.length]}" stroke-width="${sw}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-off}"><title>${d.nome}: ${fmt(d.valor)}</title></circle>`;
    off += len;
  });
  return `<svg viewBox="0 0 200 200" width="100%" height="100%"><g transform="rotate(-90 100 100)">${segs}</g></svg>`;
}

function areaChartSVG(s) {
  const W = 520, H = 200, padL = 44, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = s.map((d) => d.valor), dMin = Math.min(...vals), dMax = Math.max(...vals);
  const pad = (dMax - dMin) * 0.3 || dMax * 0.1, yMin = dMin - pad, yMax = dMax + pad, n = s.length;
  const X = (i) => padL + i * (plotW / (n - 1));
  const Y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const val = yMin + ((yMax - yMin) * i) / 3, y = Y(val);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--hair)"/><text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--subtle)">${fmtShort(val)}</text>`;
  }
  const pts = s.map((d, i) => [X(i), Y(d.valor)]);
  const line = "M" + pts.map((p) => `${p[0]} ${p[1]}`).join(" L ");
  const area = line + ` L ${X(n - 1)} ${padT + plotH} L ${X(0)} ${padT + plotH} Z`;
  const dots = s.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d.valor)}" r="3.2" fill="${C.brand}"><title>${d.mes}: ${fmt(d.valor)}</title></circle>`).join("");
  const xl = s.map((d, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--subtle)">${d.mes}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" font-family="Inter,sans-serif"><defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.brand}" stop-opacity="0.28"/><stop offset="100%" stop-color="${C.brand}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#gp)"/><path d="${line}" fill="none" stroke="${C.brand}" stroke-width="2.5"/>${dots}${xl}</svg>`;
}

/* ---------- 6. views ---------- */
/* blocos reordenáveis do dashboard */
function blkReceitaDespesa() {
  return `<div class="card dash-clickable" data-drill="open"><div class="card-head"><h3>Receitas × Despesas</h3><span class="card-sub drill-hint">detalhar ${ic("arrow-right", 12)}</span></div><div class="chart" style="height:260px">${barChartSVG(monthly)}</div><div class="legend"><span><i style="background:${C.receita}"></i> Receitas</span><span><i style="background:${C.despesa}"></i> Despesas</span></div></div>`;
}
function blkCategorias() {
  return `<div class="card"><div class="card-head"><h3>Despesas por categoria</h3><span class="card-sub">${REF_LABEL} · ${fmt(despesasMes)}</span></div><div class="donut-wrap"><div style="width:190px;height:190px;position:relative">${donutSVG(despesaPorCat)}<div class="donut-center"><span>total</span><strong class="num">${fmtShort(despesasMes)}</strong></div></div><ul class="cat-legend">${despesaPorCat.slice(0, 6).map((d, i) => `<li><i style="background:${donutPalette[i % donutPalette.length]}"></i><span>${d.nome}</span><b class="num">${fmtShort(d.valor)}</b></li>`).join("")}</ul></div></div>`;
}
function blkPatrimonio() {
  return `<div class="card"><div class="card-head"><h3>Evolução do patrimônio</h3><span class="card-sub">líquido, últimos 6 meses</span></div><div class="chart" style="height:200px">${areaChartSVG(patrimonioSerie)}</div></div>`;
}
function blkUltimas() {
  return `<div class="card"><div class="card-head"><h3>Últimas transações</h3><button class="link" data-tab="transacoes">ver todas ${ic("arrow-right", 13)}</button></div><div class="mini-list">${state.tx.slice(0, 5).map((t) => `<div class="mini-row"><div class="mini-l">${badgeHTML(t.tipo, true)}<div><div class="mini-desc">${t.desc}</div><div class="mini-meta">${t.tipo === "transferencia" ? `${t.origem} → ${t.destino}` : `${t.cat} · ${t.sub}`}</div></div></div>${moneyHTML(t.tipo, t.valor)}</div>`).join("")}</div></div>`;
}
const DASH_BLOCKS = {
  receitaDespesa: { title: "Receitas × Despesas", sub: "gráfico de barras", icon: "trending-up", cor: C.brand, render: blkReceitaDespesa },
  categorias: { title: "Despesas por categoria", sub: "rosca", icon: "folder-tree", cor: C.despesa, render: blkCategorias },
  patrimonio: { title: "Evolução do patrimônio", sub: "área", icon: "building", cor: C.patrimonio, render: blkPatrimonio },
  ultimas: { title: "Últimas transações", sub: "lista", icon: "list", cor: C.transfer, render: blkUltimas },
};

function dashEditor() {
  const last = state.dashOrder.length - 1;
  const rows = state.dashOrder.map((key, idx) => {
    const b = DASH_BLOCKS[key];
    return `<div class="dash-edit-row${state.dragKey === key ? " dragging" : ""}" draggable="true" data-dash-row="${key}">
      <span class="der-grip" title="Arraste para reordenar">${ic("grip", 17)}</span>
      <span class="der-ic" style="background:${b.cor}1A;color:${b.cor}">${ic(b.icon, 17)}</span>
      <span class="der-txt"><b>${b.title}</b><span>${b.sub}</span></span>
      <span class="der-pos">${idx + 1}º</span>
      <span class="der-moves">
        <button class="dash-move" data-dash-move="${key}:up" title="Subir" ${idx === 0 ? "disabled" : ""}>${ic("chevron-up", 15)}</button>
        <button class="dash-move" data-dash-move="${key}:down" title="Descer" ${idx === last ? "disabled" : ""}>${ic("chevron-down", 15)}</button>
      </span>
    </div>`;
  }).join("");
  return `<div class="dash-editor">${rows}</div>`;
}

function viewDashboard() {
  const edit = state.dashEdit;
  return `
  <div class="dash-tools">
    <button class="ghost dash-personalize ${edit ? "on" : ""}" data-dash-edit>${ic(edit ? "check" : "sliders", 15)} ${edit ? "Concluir" : "Personalizar página"}</button>
    ${edit ? `<span class="dash-hint">Arraste os blocos ou use as setas para mudar a ordem.</span>` : ""}
  </div>
  <div class="kpi-row">
    ${kpi("Patrimônio líquido", netWorth(), "", true, "building", C.brand)}
    ${kpi(`Receitas · ${REF_LABEL}`, receitasMes, "", true, "trending-up", C.receita)}
    ${kpi(`Despesas · ${REF_LABEL}`, despesasMes, "", true, "trending-down", C.despesa)}
    ${kpi(`Resultado · ${REF_LABEL}`, receitasMes - despesasMes, receitasMes - despesasMes >= 0 ? "sobrou este mês" : "faltou este mês", receitasMes - despesasMes >= 0, "coins", C.transfer)}
  </div>
  ${edit ? dashEditor() : `<div class="dash-grid">${state.dashOrder.map((k) => DASH_BLOCKS[k].render()).join("")}</div>`}`;
}

const chipLabel = (t) => (t === "cartao" ? "cartão" : t === "invest" ? "investimento" : t);

function acctMenuHTML(a) {
  if (state.acctMenu !== a.id) return "";
  return `<div class="acct-menu">
    <button data-acct-open="${a.nome}">${ic("list", 14)} Ver lançamentos</button>
    <button data-acct-edit="${a.id}">${ic("pencil", 14)} Editar nome</button>
    <button data-acct-move="${a.id}:up">${ic("chevron-up", 14)} Mover pra cima</button>
    <button data-acct-move="${a.id}:down">${ic("chevron-down", 14)} Mover pra baixo</button>
    <button class="danger" data-acct-archive="${a.id}">${ic("archive", 14)} Arquivar</button>
  </div>`;
}
function acctEditForm(a) {
  return `<div class="acct-edit"><label class="fld-label">Nome da conta</label><input class="acct-edit-input" value="${a.nome}" data-acct-input="${a.id}"><div class="acct-edit-actions"><button class="mini-btn primary" data-acct-save="${a.id}">Salvar</button><button class="mini-btn" data-acct-cancel>Cancelar</button></div></div>`;
}
function acctCard(a) {
  const kebab = `<button class="acct-kebab" data-acct-menu="${a.id}" title="Opções">${ic("more-vertical", 18)}</button>`;
  const editing = state.acctEdit === a.id;
  if (a.grupo === "pat") {
    const body = `<div class="acct-name">${a.nome}</div><div class="acct-sub">${a.sub}</div><div class="alloc-lines"><div><span>Valor alocado</span><b class="num">${fmt(a.alocado)}</b></div><div><span>Custos lançados</span><b class="num" style="color:${C.despesa}">${fmt(a.custo)}</b></div></div><div class="alloc-val"><span>Valor atual</span><strong class="num" style="color:${C.patrimonio}">${fmt(a.saldo)}</strong></div>`;
    return `<div class="card acct alloc-card"><div class="acct-top"><span class="acct-ic pat">${ic("car", 18)}</span><div class="acct-top-r"><span class="acct-chip patrimonio">patrimônio</span>${kebab}</div></div>${editing ? acctEditForm(a) : `<div class="acct-body" data-acct-open="${a.nome}">${body}</div>`}${acctMenuHTML(a)}</div>`;
  }
  const body = `<div class="acct-name">${a.nome}</div><div class="acct-sub">${a.sub}</div><div class="acct-saldo num" style="color:${a.saldo < 0 ? C.despesa : "var(--ink)"}">${fmt(a.saldo)}</div>`;
  return `<div class="card acct"><div class="acct-top"><span class="acct-ic">${ic(ACCT_ICON[a.tipo], 18)}</span><div class="acct-top-r"><span class="acct-chip ${a.tipo}">${chipLabel(a.tipo)}</span>${kebab}</div></div>${editing ? acctEditForm(a) : `<div class="acct-body" data-acct-open="${a.nome}">${body}</div>`}${acctMenuHTML(a)}</div>`;
}
function viewAcctDetail(nome) {
  const a = accounts.find((x) => x.nome === nome);
  const txs = acctTx(nome).slice().sort((x, y) => (y.iso || y.data).localeCompare(x.iso || x.data));
  let entradas = 0, saidas = 0;
  const rows = txs.map((t) => {
    const v = txValorConta(t, nome);
    if (v >= 0) entradas += v; else saidas += -v;
    const contraparte = t.tipo === "transferencia" ? (t.origem === nome ? `→ ${t.destino}` : `← ${t.origem}`) : `${t.cat} · ${t.sub}`;
    return `<div class="mini-row"><div class="mini-l">${badgeHTML(t.tipo, true)}<div><div class="mini-desc">${t.desc}</div><div class="mini-meta">${t.data} · ${contraparte}</div></div></div><span class="num" style="color:${v < 0 ? "var(--ink)" : C.receita};font-weight:600">${v < 0 ? "−" : "+"} ${fmt(Math.abs(v))}</span></div>`;
  }).join("") || `<div class="empty-mini">Nenhum lançamento nesta conta ainda.</div>`;
  const iconName = a ? (a.grupo === "pat" ? "car" : ACCT_ICON[a.tipo]) : "wallet";
  return `
  <button class="back-btn" data-acct-back>${ic("arrow-left", 16)} Contas</button>
  <div class="card acct-detail-head"><div class="adh-l"><span class="acct-ic big">${ic(iconName, 22)}</span><div><div class="adh-name">${nome}</div><div class="acct-sub">${a ? a.sub : ""}</div></div></div><div class="adh-saldo num" style="color:${a && a.saldo < 0 ? C.despesa : "var(--ink)"}">${a ? fmt(a.saldo) : ""}</div></div>
  <div class="adh-stats">
    <div class="card adh-stat"><span>Entradas</span><b class="num" style="color:${C.receita}">${fmt(entradas)}</b></div>
    <div class="card adh-stat"><span>Saídas</span><b class="num" style="color:${C.despesa}">${fmt(saidas)}</b></div>
    <div class="card adh-stat"><span>Lançamentos</span><b class="num">${txs.length}</b></div>
  </div>
  <div class="card table-card" style="padding:6px 18px"><div class="card-head" style="padding:12px 0 4px"><h3>Lançamentos</h3></div><div class="mini-list">${rows}</div></div>`;
}
function viewContas() {
  if (state.acctDetail) return viewAcctDetail(state.acctDetail);
  const active = accounts.filter((a) => !a.arquivada);
  const fin = active.filter((a) => a.grupo === "fin");
  const pat = active.filter((a) => a.grupo === "pat");
  const archived = accounts.filter((a) => a.arquivada);
  const archBlock = archived.length ? `
  <div class="section-lead alloc"><div><span class="lead-eyebrow" style="color:var(--subtle)">Arquivadas</span><p>Ocultas do dia a dia e fora do patrimônio. Reative quando quiser.</p></div></div>
  <div class="archived-list">${archived.map((a) => `<div class="arch-row"><span class="acct-ic small">${ic(a.grupo === "pat" ? "car" : ACCT_ICON[a.tipo], 16)}</span><div class="arch-info"><div class="arch-name">${a.nome}</div><div class="acct-sub">${a.sub}</div></div><span class="num arch-saldo">${fmt(a.saldo)}</span><button class="mini-btn" data-acct-archive="${a.id}">${ic("archive", 13)} Desarquivar</button></div>`).join("")}</div>` : "";
  return `
  <div class="section-lead"><div><span class="lead-eyebrow" style="color:${C.brand}">Contas financeiras</span><p>Clique numa conta pra ver os lançamentos dela. Use o ⋯ pra editar o nome, reordenar ou arquivar.</p></div></div>
  <div class="acct-grid">${fin.map(acctCard).join("")}</div>
  <div class="section-lead alloc"><div><span class="lead-eyebrow" style="color:${C.patrimonio}">Alocações de patrimônio</span><p>Comprar um bem não é despesa: você transfere o dinheiro pra cá e ele vira patrimônio.</p></div></div>
  <div class="acct-grid">${pat.map(acctCard).join("")}<button class="card acct add-acct">${ic("plus", 22)}<span>Nova conta ou alocação</span></button></div>
  ${archBlock}`;
}

function viewTransacoes() {
  const chips = ["todas", "receita", "despesa", "transferencia", "reembolso"];
  const CAP = 300;
  const filtered = state.tx.filter((t) => state.filter === "todas" || t.tipo === state.filter);
  const shown = filtered.slice(0, CAP);
  const rows = shown.map((t) => {
    const cat = t.tipo === "transferencia"
      ? `<span class="transfer-path">${t.origem} ${ic("arrow-right", 12)} ${t.destino}</span>`
      : `<span>${t.cat}${t.sub ? ` <span class="dot">·</span> <span class="muted2">${t.sub}</span>` : ""}</span>`;
    const conta = t.tipo === "transferencia" ? (t.nota || "—") : t.conta;
    const status = t.status === "conciliado" ? `<span class="status conciliado">${ic("check", 11)} conciliado</span>` : `<span class="status pendente">pendente</span>`;
    return `<tr><td class="num muted">${t.data}</td><td><div class="td-desc">${t.desc}</div>${badgeHTML(t.tipo, true)}</td><td class="muted">${cat}</td><td class="muted">${conta}</td><td class="r">${moneyHTML(t.tipo, t.valor)}</td><td class="c">${status}</td></tr>`;
  }).join("");
  const capNote = filtered.length > CAP ? `<p class="foot-note">Mostrando os <b>${CAP}</b> lançamentos mais recentes de <b>${filtered.length}</b>.</p>` : "";
  const filters = chips.map((f) => {
    const on = state.filter === f;
    const style = on && f !== "todas" ? `style="background:${TIPOS[f].cor}1A;color:${TIPOS[f].cor};border-color:${TIPOS[f].cor}55"` : "";
    return `<button class="chip ${on ? "on" : ""}" data-filter="${f}" ${style}>${f === "todas" ? "Todas" : TIPOS[f].label}</button>`;
  }).join("");
  return `
  <div class="filters">${filters}</div>
  <div class="card table-card"><table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="r">Valor</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${capNote}
  <p class="foot-note"><span style="color:${C.transfer}">${ic("transfer", 13)}</span> Transferências aparecem na lista, mas <b>não somam em receitas nem despesas</b> — só movem saldo entre contas.</p>`;
}

function viewConciliacao() {
  if (!state.imported) {
    return `<div class="import-zone card"><span class="import-ic">${ic("upload", 26)}</span><h3>Importe seu extrato</h3><p>Arraste um arquivo OFX, CSV ou PDF do banco. O Meu Caixa lê as transações e já sugere a categoria, a conta e possíveis correspondências com o que você lançou.</p><button class="cta big" data-action="import">${ic("sparkles", 16)} Usar extrato de exemplo</button><span class="import-formats">Nubank · Caixa · Itaú · Bradesco · e outros</span></div>`;
  }
  const conc = state.recon.filter((r) => r.status === "conciliado").length;
  const totalR = state.recon.filter((r) => r.status !== "ignorado").length;
  const ign = state.recon.filter((r) => r.status === "ignorado").length;
  const bar = `<div class="recon-bar card"><div class="recon-prog"><div class="recon-prog-head"><strong>${conc} de ${totalR} conciliados</strong><span>${ign} ignorados</span></div><div class="bar"><span style="width:${totalR ? (conc / totalR) * 100 : 0}%"></span></div></div><button class="ghost" data-action="reimport">Reimportar</button></div>`;
  const list = state.recon.map((r) => {
    const confCor = r.conf >= 90 ? C.receita : r.conf >= 75 ? C.patrimonio : C.despesa;
    const done = r.status === "conciliado", skip = r.status === "ignorado", isEdit = state.editing === r.id;
    const sug = !isEdit
      ? `<div class="sug-body">${badgeHTML(r.sug.tipo, true)}${r.sug.tipo === "transferencia" ? `<span class="sug-cat">${r.sug.origem} ${ic("arrow-right", 12)} ${r.sug.destino}</span>` : `<span class="sug-cat">${r.sug.cat} <span class="dot">·</span> <span class="muted2">${r.sug.sub}</span> <span class="dot">·</span> ${r.sug.conta}</span>`}</div>`
      : `<div class="edit-body"><select>${Object.keys(TIPOS).map((k) => `<option ${k === r.sug.tipo ? "selected" : ""}>${TIPOS[k].label}</option>`).join("")}</select><select>${(r.sug.tipo === "receita" ? catTree.receita : catTree.despesa).map((c) => `<option ${c.nome === r.sug.cat ? "selected" : ""}>${c.nome}</option>`).join("")}</select><select>${accounts.map((a) => `<option ${a.nome === (r.sug.conta || r.sug.destino) ? "selected" : ""}>${a.nome}</option>`).join("")}</select></div>`;
    const match = r.match && !isEdit ? `<div class="recon-match">${ic("circle-alert", 12)} corresponde a um lançamento existente: <b>${r.match}</b></div>` : "";
    const hint = r.sug.tipo === "transferencia" && !isEdit ? `<div class="recon-hint">não entra como despesa — só move saldo</div>` : "";
    const actions = done ? `<span class="conc-tag">${ic("check", 14)} Conciliado</span>`
      : skip ? `<span class="skip-tag">Ignorado</span>`
        : `<button class="act accept" data-recon-accept="${r.id}">${ic("check", 14)} ${isEdit ? "Salvar" : "Aceitar"}</button><button class="act edit" data-recon-edit="${r.id}">${ic("pencil", 13)} ${isEdit ? "Cancelar" : "Editar"}</button><button class="act skip-btn" data-recon-ignore="${r.id}">${ic("x", 13)}</button>`;
    return `<div class="card recon${done ? " done" : ""}${skip ? " skip" : ""}"><div class="recon-main"><div class="recon-raw"><div class="raw-label">no extrato</div><div class="raw-desc">${r.raw}</div><div class="raw-val num" style="color:${r.valor < 0 ? C.despesa : C.receita}">${fmt(r.valor)}</div></div><div class="recon-arrow">${ic("sparkles", 15)}</div><div class="recon-sug"><div class="raw-label">sugestão · <span style="color:${confCor};font-weight:700">${r.conf}% confiança</span></div>${sug}${match}${hint}</div></div><div class="recon-actions">${actions}</div></div>`;
  }).join("");
  return bar + `<div class="recon-list">${list}</div>`;
}

function viewCategorias() {
  const cols = [["receita", "Receitas"], ["despesa", "Despesas"]].map(([tipo, titulo]) => {
    const cor = tipo === "receita" ? C.receita : C.despesa;
    const maxT = Math.max(...catTree[tipo].map((c) => c.total), 1);
    const nodes = catTree[tipo].map((c) => `<div class="cat-node"><div class="cat-node-head"><span class="cn-name">${c.nome}</span><span class="cn-total num" style="color:${c.total ? cor : "var(--line-strong)"}">${c.total ? fmtShort(c.total) : "—"}</span></div><div class="cn-bar"><span style="width:${(c.total / maxT) * 100}%;background:${cor}"></span></div><div class="cat-subs">${c.subs.map((s) => `<span class="sub-pill">${s}</span>`).join("")}<button class="sub-add">${ic("plus", 11)} subcategoria</button></div></div>`).join("");
    return `<div class="card cat-col"><div class="cat-col-head" style="border-color:${cor}33"><span class="cat-dot" style="background:${cor}"></span><h3>${titulo}</h3><span class="cat-count">${catTree[tipo].length} categorias</span></div><div class="cat-tree">${nodes}</div><button class="cat-add" style="color:${cor}">${ic("plus", 14)} Nova categoria de ${tipo === "receita" ? "receita" : "despesa"}</button></div>`;
  }).join("");
  return `<div class="cat-cols">${cols}</div>`;
}

const VIEWS = { dashboard: viewDashboard, contas: viewContas, transacoes: viewTransacoes, conciliacao: viewConciliacao, categorias: viewCategorias };

/* ---------- drill-down do gráfico Receitas × Despesas ---------- */
function renderDrill() {
  const el = document.getElementById("drill-root");
  if (!state.drill) { el.innerHTML = ""; return; }
  const d = state.drill;
  let title = "", back = "", body = "";
  if (d.stage === "months") {
    title = "Escolha um mês";
    body = `<div class="drill-months">${monthly.map((m) => `<button class="drill-month" data-drill-month="${m.mes}"><span class="dm-mes">${m.mes}</span><span class="dm-vals"><b style="color:${C.receita}">+ ${fmtShort(m.receita)}</b><b style="color:${C.despesa}">− ${fmtShort(m.despesa)}</b></span><span class="dm-net num">${fmt(m.receita - m.despesa)}</span>${ic("arrow-right", 15)}</button>`).join("")}</div>`;
  } else if (d.stage === "split") {
    const m = monthly.find((x) => x.mes === d.month);
    title = `${d.month} — receitas × despesas`;
    back = `<button class="drill-back" data-drill-back="months">${ic("arrow-left", 15)} meses</button>`;
    const data = [{ nome: "Receitas", valor: m.receita }, { nome: "Despesas", valor: m.despesa }];
    body = `<div class="drill-pie"><div class="pie-box">${donutSVG(data, [C.receita, C.despesa])}<div class="donut-center"><span>saldo</span><strong class="num">${fmtShort(m.receita - m.despesa)}</strong></div></div><ul class="cat-legend"><li><i style="background:${C.receita}"></i><span>Receitas</span><b class="num">${fmtShort(m.receita)}</b></li><li><i style="background:${C.despesa}"></i><span>Despesas</span><b class="num">${fmtShort(m.despesa)}</b></li></ul></div><div class="drill-ask"><p>Quer afunilar em quê?</p><div class="drill-ask-btns"><button class="ask-btn" style="--c:${C.receita}" data-drill-type="receita">${ic("trending-up", 15)} Ver receitas</button><button class="ask-btn" style="--c:${C.despesa}" data-drill-type="despesa">${ic("trending-down", 15)} Ver despesas</button></div></div>`;
  } else {
    const cats = drillCats(d.month, d.type);
    const total = cats.reduce((s, c) => s + c.valor, 0);
    title = `${d.month} — ${d.type === "receita" ? "receitas" : "despesas"} por categoria`;
    back = `<button class="drill-back" data-drill-back="split">${ic("arrow-left", 15)} ${d.month}</button>`;
    body = `<div class="drill-pie"><div class="pie-box">${donutSVG(cats)}<div class="donut-center"><span>total</span><strong class="num">${fmtShort(total)}</strong></div></div><ul class="cat-legend">${cats.map((c, i) => `<li><i style="background:${donutPalette[i % donutPalette.length]}"></i><span>${c.nome}</span><b class="num">${fmtShort(c.valor)}</b></li>`).join("")}</ul></div>`;
  }
  el.innerHTML = `<div class="overlay" id="drill-overlay"><div class="modal drill-modal"><div class="modal-head"><div class="drill-head-l">${back}<h3>${title}</h3></div><button class="x" data-drill-close>${ic("x", 18)}</button></div><div class="drill-body">${body}</div></div></div>`;
}

/* ---------- 7. modal ---------- */
function modalHTML() {
  const baseTipo = state.modalTipo;                                   // despesa | receita | transferencia
  const isReemb = baseTipo === "receita" && !!state.form.reembolso;
  const tipo = isReemb ? "reembolso" : baseTipo;                      // tipo efetivo (com reembolso)
  const t = TIPOS[tipo];
  const catList = tipo === "receita" ? catTree.receita : catTree.despesa;
  const showCat = tipo !== "transferencia";
  const f = state.form;

  // segmentado de tipo (3, pílula) — reembolso vira slider dentro de Receita
  const seg = ["despesa", "receita", "transferencia"].map((k) => {
    const v = TIPOS[k];
    const on = baseTipo === k;
    return `<button class="seg ${on ? "on" : ""}" data-modal-tipo="${k}" ${on ? `style="color:${v.cor}"` : ""}>${v.label}</button>`;
  }).join("");

  // slider "é um reembolso" — só aparece em Receita
  const reembToggle = baseTipo === "receita"
    ? `<div class="reemb-row"><button class="switch ${isReemb ? "on" : ""}" data-modal-reemb aria-pressed="${isReemb}" style="--acc:${TIPOS.reembolso.cor}"><span class="knob"></span></button><div class="reemb-txt"><b>É um reembolso</b><span>Crédito que volta pra uma despesa — não é receita nova</span></div></div>`
    : "";

  // grade de categorias (ícone) + subcategorias
  let catBlock = "";
  if (showCat) {
    const tiles = catList.map((c) =>
      `<button class="cat-tile ${f.cat === c.nome ? "on" : ""}" data-modal-cat="${c.nome}">${ic(catIcon(c.nome), 20)}<span>${c.nome}</span></button>`
    ).join("");
    const selObj = catList.find((c) => c.nome === f.cat);
    const subs = selObj ? `<div class="sub-wrap"><div class="fld-label">Subcategoria</div><div class="sub-row">${selObj.subs.map((s) => `<button class="sub-pick ${f.sub === s ? "on" : ""}" data-modal-sub="${s}">${s}</button>`).join("")}</div></div>` : "";
    const lbl = `Categoria${tipo === "reembolso" ? ' <span class="lbl-hint">· de qual despesa voltou</span>' : ""}`;
    catBlock = `<div class="cat-pick-wrap"><div class="fld-label">${lbl}</div><div class="cat-grid">${tiles}</div>${subs}</div>`;
  } else {
    const opts = (sel) => accounts.map((a) => `<option ${a.nome === sel ? "selected" : ""}>${a.nome}</option>`).join("");
    catBlock = `<div class="cat-pick-wrap"><div class="transfer-fields"><label class="fld"><span class="fld-label">De</span><select data-field="origem">${opts(f.origem)}</select></label><span class="tf-arrow">${ic("arrow-right", 18)}</span><label class="fld"><span class="fld-label">Para</span><select data-field="destino">${opts(f.destino)}</select></label></div></div>`;
  }

  const contaField = showCat
    ? `<label class="fld"><span class="fld-label">${tipo === "despesa" ? "Conta de origem" : "Conta destino"}</span><select data-field="conta">${accounts.map((a) => `<option ${a.nome === f.conta ? "selected" : ""}>${a.nome}</option>`).join("")}</select></label>`
    : "";

  const note = { receita: "Entra como receita e soma no resultado do mês.", despesa: "Sai como despesa e reduz o resultado do mês.", transferencia: "Move saldo entre contas. Não conta como receita nem despesa.", reembolso: "Reduz a despesa da categoria escolhida — dinheiro que voltou." }[tipo];
  const canSave = parseValor(f.valor) > 0 && (baseTipo === "transferencia" || !!f.cat);

  return `<div class="overlay" id="overlay"><div class="modal modal-tx" style="--acc:${t.cor}">
    <div class="modal-head"><h3>Nova transação</h3><button class="x" data-action="close-modal">${ic("x", 18)}</button></div>
    <div class="tx-body">
      <div class="type-seg3">${seg}</div>
      ${reembToggle}
      <div class="amount-block"><label class="amount-inline"><span class="amt-cur">R$</span><input class="amt-input" data-field="valor" value="${f.valor || ""}" placeholder="0,00" inputmode="decimal" autocomplete="off"></label></div>
      ${catBlock}
      <div class="form2">
        <label class="fld"><span class="fld-label">Descrição</span><input data-field="desc" value="${f.desc || ""}" placeholder="Ex.: Mercado, cliente X, aporte…"></label>
        <div class="fld-row">${contaField}<label class="fld"><span class="fld-label">Data</span><input type="date" data-field="data" value="${f.data || TODAY_ISO}"></label></div>
      </div>
      <div class="tx-note" style="background:${t.cor}12;color:${t.cor}"><span class="tx-note-ic">${ic("circle-alert", 14)}</span><span>${note}</span></div>
    </div>
    <div class="modal-foot-tx">
      <button class="save-tx" data-action="save-tx" style="background:${t.cor}" ${canSave ? "" : "disabled"}>${ic("check", 16)} Salvar ${t.label.toLowerCase()}</button>
    </div>
  </div></div>`;
}

/* ---------- 8. estado, render e eventos ---------- */
const state = {
  tab: "dashboard",
  tx: initialTx.slice(),
  recon: initialRecon.map((r) => ({ ...r })),
  imported: false,
  filter: "todas",
  modal: false,
  modalTipo: "despesa",
  editing: null,
  form: { desc: "", valor: "", cat: "", sub: "", conta: "Conta Corrente", data: TODAY_ISO, origem: "Conta Corrente", destino: "Investimentos" },
  // contas
  acctDetail: null, acctMenu: null, acctEdit: null,
  // dashboard
  dashEdit: false, dashOrder: ["receitaDespesa", "categorias", "patrimonio", "ultimas"], dragKey: null,
  // drill-down
  drill: null,
};
const freshForm = () => ({ desc: "", valor: "", cat: "", sub: "", conta: "Conta Corrente", data: TODAY_ISO, origem: "Conta Corrente", destino: "Investimentos", reembolso: false });

let elView, elTitle, elSub, elBadge, elModal;

function renderView() {
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
  const meta = PAGE[state.tab];
  if (elTitle) elTitle.textContent = meta[0];
  if (elSub) elSub.textContent = meta[1];
  const pend = state.recon.filter((r) => r.status === "pendente").length;
  if (elBadge) { elBadge.textContent = pend; elBadge.style.display = pend ? "grid" : "none"; }
  elView.innerHTML = VIEWS[state.tab]();
}
function renderModal() {
  elModal.innerHTML = state.modal ? modalHTML() : "";
}

/* handlers */
function openModal() { state.modal = true; state.modalTipo = "despesa"; state.form = freshForm(); state.acctMenu = null; renderModal(); }
function closeModal() { state.modal = false; renderModal(); }
function setTipo(k) { state.modalTipo = k; state.form.cat = ""; state.form.sub = ""; state.form.reembolso = false; renderModal(); }
function toggleReemb() { state.form.reembolso = !state.form.reembolso; state.form.cat = ""; state.form.sub = ""; renderModal(); }
function pickCat(nome) {
  const list = state.modalTipo === "receita" ? catTree.receita : catTree.despesa;
  const obj = list.find((c) => c.nome === nome);
  state.form.cat = nome; state.form.sub = obj ? obj.subs[0] : "";
  renderModal();
}
function pickSub(s) { state.form.sub = s; renderModal(); }
function updateSaveEnabled() {
  const btn = document.querySelector(".save-tx");
  if (!btn) return;
  const ok = parseValor(state.form.valor) > 0 && (state.modalTipo === "transferencia" || !!state.form.cat);
  btn.disabled = !ok;
}
function saveTx() {
  const v = parseValor(state.form.valor);
  const tipo = state.modalTipo === "receita" && state.form.reembolso ? "reembolso" : state.modalTipo;
  if (v <= 0) return;
  if (tipo !== "transferencia" && !state.form.cat) return;
  const base = { id: Date.now(), data: dataBR(state.form.data), desc: state.form.desc || TIPOS[tipo].label, tipo, status: "pendente" };
  let tx;
  if (tipo === "transferencia") {
    tx = { ...base, origem: state.form.origem || "Conta Corrente", destino: state.form.destino || "Investimentos", valor: v };
  } else {
    const list = tipo === "receita" ? catTree.receita : catTree.despesa;
    const catObj = list.find((c) => c.nome === state.form.cat) || list[0];
    tx = { ...base, cat: catObj.nome, sub: state.form.sub || catObj.subs[0], conta: state.form.conta || "Conta Corrente", valor: tipo === "despesa" ? -Math.abs(v) : Math.abs(v) };
  }
  state.tx = [tx, ...state.tx];
  state.modal = false;
  renderModal();
  renderView();
}
/* contas */
function refreshSideNet() { const el = document.getElementById("side-net-val"); if (el) el.textContent = fmt(netWorth()); }
function openAcct(nome) { state.acctDetail = nome; state.acctMenu = null; renderView(); }
function backAcct() { state.acctDetail = null; renderView(); }
function toggleAcctMenu(id) { state.acctMenu = state.acctMenu === id ? null : id; renderView(); }
function startEditAcct(id) { state.acctEdit = id; state.acctMenu = null; renderView(); }
function cancelEditAcct() { state.acctEdit = null; renderView(); }
function saveAcctName(id) {
  const inp = document.querySelector(`[data-acct-input="${id}"]`), a = acctById(id);
  if (a && inp) {
    const nv = inp.value.trim();
    if (nv && nv !== a.nome) {
      const old = a.nome; a.nome = nv;
      state.tx.forEach((t) => { if (t.conta === old) t.conta = nv; if (t.origem === old) t.origem = nv; if (t.destino === old) t.destino = nv; });
      if (state.acctDetail === old) state.acctDetail = nv;
    }
  }
  state.acctEdit = null; renderView();
}
function moveAcct(id, dir) {
  const a = acctById(id); if (!a) return;
  const group = accounts.filter((x) => x.grupo === a.grupo && !x.arquivada);
  const pos = group.indexOf(a), swap = dir === "up" ? group[pos - 1] : group[pos + 1];
  if (!swap) return;
  const i = accounts.indexOf(a), j = accounts.indexOf(swap);
  accounts[i] = swap; accounts[j] = a;
  renderView();
}
function toggleArchive(id) { const a = acctById(id); if (a) a.arquivada = !a.arquivada; state.acctMenu = null; refreshSideNet(); renderView(); }
/* dashboard */
function moveDash(key, dir) {
  const o = state.dashOrder, i = o.indexOf(key), j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; renderView();
}
function reorderDash(fromKey, toKey) {
  if (!fromKey || fromKey === toKey) return;
  const o = state.dashOrder;
  o.splice(o.indexOf(fromKey), 1);
  o.splice(o.indexOf(toKey), 0, fromKey);
  renderView();
}
/* drill-down */
function openDrill() { state.drill = { stage: "months" }; renderDrill(); }
function closeDrill() { state.drill = null; renderDrill(); }
function drillMonth(mes) { state.drill = { stage: "split", month: mes }; renderDrill(); }
function drillType(tipo) { state.drill = { ...state.drill, stage: "cats", type: tipo }; renderDrill(); }
function drillBack(to) {
  if (to === "months") state.drill = { stage: "months" };
  else if (to === "split") state.drill = { stage: "split", month: state.drill.month };
  renderDrill();
}

function reconAccept(id) { state.recon = state.recon.map((r) => (r.id === id ? { ...r, status: "conciliado" } : r)); state.editing = null; renderView(); }
function reconIgnore(id) { state.recon = state.recon.map((r) => (r.id === id ? { ...r, status: "ignorado" } : r)); state.editing = null; renderView(); }
function reconEdit(id) { state.editing = state.editing === id ? null : id; renderView(); }

const ACTIONS = {
  "open-modal": openModal,
  "close-modal": closeModal,
  "save-tx": saveTx,
  "import": () => { state.imported = true; renderView(); },
  "reimport": () => { state.recon = initialRecon.map((r) => ({ ...r })); state.imported = false; state.editing = null; renderView(); },
};

function wire() {
  document.addEventListener("click", (e) => {
    if (e.target.id === "overlay") { closeModal(); return; }
    if (e.target.id === "drill-overlay") { closeDrill(); return; }
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) { state.tab = tabBtn.dataset.tab; state.acctDetail = null; state.acctMenu = null; state.acctEdit = null; renderView(); return; }
    const filt = e.target.closest("[data-filter]");
    if (filt) { state.filter = filt.dataset.filter; renderView(); return; }
    // drill-down
    if (e.target.closest("[data-drill]")) { openDrill(); return; }
    const dMonth = e.target.closest("[data-drill-month]");
    if (dMonth) { drillMonth(dMonth.dataset.drillMonth); return; }
    const dType = e.target.closest("[data-drill-type]");
    if (dType) { drillType(dType.dataset.drillType); return; }
    const dBack = e.target.closest("[data-drill-back]");
    if (dBack) { drillBack(dBack.dataset.drillBack); return; }
    if (e.target.closest("[data-drill-close]")) { closeDrill(); return; }
    // contas
    const aMenu = e.target.closest("[data-acct-menu]");
    if (aMenu) { toggleAcctMenu(aMenu.dataset.acctMenu); return; }
    const aEdit = e.target.closest("[data-acct-edit]");
    if (aEdit) { startEditAcct(aEdit.dataset.acctEdit); return; }
    const aSave = e.target.closest("[data-acct-save]");
    if (aSave) { saveAcctName(aSave.dataset.acctSave); return; }
    if (e.target.closest("[data-acct-cancel]")) { cancelEditAcct(); return; }
    const aMove = e.target.closest("[data-acct-move]");
    if (aMove) { const [id, dir] = aMove.dataset.acctMove.split(":"); moveAcct(id, dir); return; }
    const aArch = e.target.closest("[data-acct-archive]");
    if (aArch) { toggleArchive(aArch.dataset.acctArchive); return; }
    const aOpen = e.target.closest("[data-acct-open]");
    if (aOpen) { openAcct(aOpen.dataset.acctOpen); return; }
    if (e.target.closest("[data-acct-back]")) { backAcct(); return; }
    // dashboard
    if (e.target.closest("[data-dash-edit]")) { state.dashEdit = !state.dashEdit; renderView(); return; }
    const dMove = e.target.closest("[data-dash-move]");
    if (dMove) { const [key, dir] = dMove.dataset.dashMove.split(":"); moveDash(key, dir); return; }
    const mt = e.target.closest("[data-modal-tipo]");
    if (mt) { setTipo(mt.dataset.modalTipo); return; }
    const rb = e.target.closest("[data-modal-reemb]");
    if (rb) { toggleReemb(); return; }
    const mc = e.target.closest("[data-modal-cat]");
    if (mc) { pickCat(mc.dataset.modalCat); return; }
    const ms = e.target.closest("[data-modal-sub]");
    if (ms) { pickSub(ms.dataset.modalSub); return; }
    const acc = e.target.closest("[data-recon-accept]");
    if (acc) { reconAccept(acc.dataset.reconAccept); return; }
    const edt = e.target.closest("[data-recon-edit]");
    if (edt) { reconEdit(edt.dataset.reconEdit); return; }
    const ign = e.target.closest("[data-recon-ignore]");
    if (ign) { reconIgnore(ign.dataset.reconIgnore); return; }
    const act = e.target.closest("[data-action]");
    if (act && ACTIONS[act.dataset.action]) { ACTIONS[act.dataset.action](); return; }
    // clique fora fecha o menu de conta aberto
    if (state.acctMenu && !e.target.closest(".acct-menu")) { state.acctMenu = null; renderView(); }
  });
  document.addEventListener("input", (e) => {
    const f = e.target.closest("[data-field]");
    if (!f) return;
    let v = f.value;
    if (f.dataset.field === "valor") { const clean = v.replace(/[^0-9.,]/g, ""); if (clean !== v) f.value = clean; v = clean; }
    state.form[f.dataset.field] = v;
    updateSaveEnabled();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (state.modal) closeModal();
    else if (state.drill) closeDrill();
    else if (state.acctMenu || state.acctEdit) { state.acctMenu = null; state.acctEdit = null; renderView(); }
  });
  // arrastar-e-soltar dos blocos do dashboard
  document.addEventListener("dragstart", (e) => {
    const row = e.target.closest("[data-dash-row]");
    if (!row) return;
    state.dragKey = row.dataset.dashRow;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  document.addEventListener("dragover", (e) => {
    if (!state.dragKey) return;
    const row = e.target.closest("[data-dash-row]");
    if (!row) return;
    e.preventDefault();
    document.querySelectorAll(".dash-edit-row.drop-over").forEach((r) => r.classList.remove("drop-over"));
    if (row.dataset.dashRow !== state.dragKey) row.classList.add("drop-over");
  });
  document.addEventListener("drop", (e) => {
    const row = e.target.closest("[data-dash-row]");
    if (!row || !state.dragKey) return;
    e.preventDefault();
    const from = state.dragKey; state.dragKey = null;
    reorderDash(from, row.dataset.dashRow);
  });
  document.addEventListener("dragend", () => {
    if (state.dragKey !== null) { state.dragKey = null; renderView(); }
    else document.querySelectorAll(".drop-over,.dragging").forEach((r) => r.classList.remove("drop-over", "dragging"));
  });
}

function init() {
  elView = document.getElementById("view");
  elTitle = document.getElementById("pg-title");
  elSub = document.getElementById("pg-sub");
  elBadge = document.getElementById("nav-badge");
  elModal = document.getElementById("modal-root");
  const netEl = document.getElementById("side-net-val");
  if (netEl) netEl.textContent = fmt(netWorth());
  if (OF) {
    // reflete o mês de referência e a origem real dos dados nos rótulos estáticos
    const cap = REF_LABEL.charAt(0).toUpperCase() + REF_LABEL.slice(1);
    PAGE.dashboard[1] = `Como está seu dinheiro em ${cap}`;
    const monthEl = document.querySelector(".month");
    if (monthEl && monthEl.childNodes[0]) monthEl.childNodes[0].textContent = REF_LABEL + " ";
    const demo = document.querySelector(".pill-demo");
    if (demo) { const t = demo.childNodes[demo.childNodes.length - 1]; if (t) t.textContent = " dados do Orçamento Fácil"; }
  }
  wire();
  renderView();
  renderModal();
}
document.addEventListener("DOMContentLoaded", init);
