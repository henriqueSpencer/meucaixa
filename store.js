/* store.js — persistência offline-first do MeuCaixa (IndexedDB = fonte da verdade local; Supabase = sync).
 * Single-user em vários aparelhos → resolução last-write-wins por updated_at (carimbado no servidor).
 * O app continua usando o modelo em memória (accounts / catTree / tx / dashOrder). Este módulo faz a
 * ponte modelo⇄linhas e sincroniza por diff. Sem framework, sem build. Exposto em window.Store. */
(function () {
  "use strict";
  const SB_URL = "https://umvtbondcihigdltspub.supabase.co";
  const SB_KEY = "sb_publishable_Yw6ISMmrN_ovWPbfIEpt-w_hPauW78Y";
  const DB_NAME = "meucaixa";
  const DB_VER = 1;
  const TABLES = ["accounts", "categories", "transactions", "prefs"];

  // ---------------------------------------------------------------- adaptadores puros (testáveis)
  // ids determinísticos p/ categorias (o app é todo keyed por nome; renomear = id novo + id velho vira tombstone)
  const catPid = (tipo, nome) => `c|${tipo}|${nome}`;
  const catSid = (tipo, parent, sub) => `c|${tipo}|${parent}|${sub}`;

  // modelo em memória → linhas por tabela (só o que existe; deleções vêm do diff)
  function modelToRows(model) {
    const rows = { accounts: [], categories: [], transactions: [], prefs: [] };
    (model.accounts || []).forEach((a, i) => {
      rows.accounts.push({
        id: String(a.id), nome: a.nome, sub: a.sub || null, tipo: a.tipo || null,
        saldo: num(a.saldo), grupo: a.grupo || null, arquivada: !!a.arquivada,
        icon: a.icon || null, ordem: a.ordem != null ? a.ordem : i,
        alocado: a.alocado != null ? num(a.alocado) : null, custo: a.custo != null ? num(a.custo) : null,
        deleted: false,
      });
    });
    ["receita", "despesa"].forEach((tipo) => {
      ((model.catTree && model.catTree[tipo]) || []).forEach((c, ci) => {
        rows.categories.push({ id: catPid(tipo, c.nome), tipo, nome: c.nome, parent_id: null, icon: c.icon || null, ordem: ci, deleted: false });
        (c.subs || []).forEach((s, si) => {
          if (s === c.nome) return; // fallback "sub = próprio nome" não vira linha
          rows.categories.push({ id: catSid(tipo, c.nome, s), tipo, nome: s, parent_id: catPid(tipo, c.nome), icon: null, ordem: si, deleted: false });
        });
      });
    });
    (model.tx || []).forEach((t) => {
      rows.transactions.push({
        id: String(t.id), tipo: t.tipo, iso: t.iso || null, descricao: t.desc || null, valor: num(t.valor),
        cat: t.cat || null, sub: t.sub || null, conta: t.conta || null,
        origem: t.origem || null, destino: t.destino || null, status: t.status || null, deleted: false,
      });
    });
    const prefs = model.prefs || {};
    if (model.dashOrder) prefs.dashOrder = model.dashOrder;
    Object.keys(prefs).forEach((k) => rows.prefs.push({ id: k, value: prefs[k], deleted: false }));
    return rows;
  }

  // linhas (do banco/idb) → modelo em memória (ignora tombstones)
  function rowsToModel(rows) {
    const live = (arr) => (arr || []).filter((r) => !r.deleted);
    const accounts = live(rows.accounts)
      .slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map((a) => {
        const o = { id: a.id, nome: a.nome, sub: a.sub || "", tipo: a.tipo, saldo: num(a.saldo), grupo: a.grupo, arquivada: !!a.arquivada };
        if (a.icon) o.icon = a.icon;
        if (a.ordem != null) o.ordem = a.ordem;
        if (a.alocado != null) o.alocado = num(a.alocado);
        if (a.custo != null) o.custo = num(a.custo);
        return o;
      });
    const catTree = { receita: [], despesa: [] };
    ["receita", "despesa"].forEach((tipo) => {
      const parents = live(rows.categories).filter((c) => c.tipo === tipo && !c.parent_id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      catTree[tipo] = parents.map((p) => {
        const subs = live(rows.categories).filter((c) => c.parent_id === p.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((c) => c.nome);
        const node = { nome: p.nome, subs: subs.length ? subs : [p.nome], total: 0 };
        if (p.icon) node.icon = p.icon;
        return node;
      });
    });
    const tx = live(rows.transactions).map((t) => {
      const o = { id: idFix(t.id), tipo: t.tipo, iso: t.iso || "", data: t.iso ? t.iso.slice(8, 10) + "/" + t.iso.slice(5, 7) : "", desc: t.descricao || "", valor: num(t.valor), status: t.status || "conciliado" };
      if (t.tipo === "transferencia") { o.origem = t.origem || ""; o.destino = t.destino || ""; }
      else { o.cat = t.cat || ""; o.sub = t.sub || ""; o.conta = t.conta || ""; }
      return o;
    });
    const prefs = {}; live(rows.prefs).forEach((p) => { prefs[p.id] = p.value; });
    const model = { accounts, catTree, tx, prefs };
    if (prefs.dashOrder) model.dashOrder = prefs.dashOrder;
    return model;
  }

  // diff: linhas atuais vs último sincronizado → { table: [rows a fazer upsert] } (inclui tombstones p/ removidos)
  function diffRows(current, lastSynced) {
    const pending = {};
    TABLES.forEach((t) => {
      const cur = index(current[t] || []);
      const last = index((lastSynced && lastSynced[t]) || []);
      const out = [];
      // novos ou alterados
      Object.keys(cur).forEach((id) => { if (!last[id] || !shallowEq(stripMeta(cur[id]), stripMeta(last[id]))) out.push(cur[id]); });
      // removidos → tombstone
      Object.keys(last).forEach((id) => { if (!cur[id] && !last[id].deleted) out.push(Object.assign({}, last[id], { deleted: true })); });
      if (out.length) pending[t] = out;
    });
    return pending;
  }

  // ---------------------------------------------------------------- helpers puros
  function num(x) { const n = parseFloat(x); return isFinite(n) ? n : 0; }
  function idFix(id) { return /^-?\d+$/.test(String(id)) ? Number(id) : id; } // tx ids numéricos voltam number
  function index(arr) { const m = {}; arr.forEach((r) => { m[String(r.id)] = r; }); return m; }
  function stripMeta(r) { const o = Object.assign({}, r); delete o.updated_at; delete o.user_id; return o; }
  function shallowEq(a, b) {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) { const va = a[k], vb = b[k]; if (typeof va === "object" && va) { if (JSON.stringify(va) !== JSON.stringify(vb)) return false; } else if (va !== vb) return false; }
    return true;
  }

  // ---------------------------------------------------------------- IndexedDB
  let idb = null;
  function openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "k" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function kvGet(k) { return new Promise((res, rej) => { const r = idb.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => res(r.result ? r.result.v : undefined); r.onerror = () => rej(r.error); }); }
  function kvSet(k, v) { return new Promise((res, rej) => { const r = idb.transaction("kv", "readwrite").objectStore("kv").put({ k, v }); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

  // ---------------------------------------------------------------- Supabase + sync
  let sb = null, userId = null, syncing = false, syncTimer = null;
  const authCbs = [];

  async function init() {
    idb = await openIDB();
    sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange((_evt, session) => {
      userId = session ? session.user.id : null;
      authCbs.forEach((cb) => cb(!!userId));
    });
    const { data } = await sb.auth.getSession();
    userId = data.session ? data.session.user.id : null;
    if (userId) startAutoSync();
    return { authed: !!userId };
  }
  function onAuth(cb) { authCbs.push(cb); }
  function isAuthed() { return !!userId; }
  async function signIn(email) {
    const redirect = location.origin + location.pathname;
    return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  }
  async function signOut() { stopAutoSync(); await sb.auth.signOut(); userId = null; }

  // snapshot local (fonte da verdade offline)
  async function loadSnapshot() { return (await kvGet("snapshot")) || null; }
  async function saveSnapshot(model) {
    await kvSet("snapshot", model);
    scheduleSync();
  }

  function startAutoSync() {
    stopAutoSync();
    syncTimer = setInterval(() => sync().catch(() => {}), 20000);
    window.addEventListener("online", () => sync().catch(() => {}));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sync().catch(() => {}); });
  }
  function stopAutoSync() { if (syncTimer) clearInterval(syncTimer); syncTimer = null; }
  let syncSched = null;
  function scheduleSync() { clearTimeout(syncSched); syncSched = setTimeout(() => sync().catch(() => {}), 1500); }

  // push (diff→upsert) + pull (updated_at>cursor). Retorna {pulled:bool, model?} se o remoto mudou.
  async function sync() {
    if (!userId || syncing || !navigator.onLine) return { pulled: false };
    syncing = true;
    try {
      const model = await loadSnapshot();
      if (model) {
        const current = modelToRows(model);
        const lastSynced = (await kvGet("lastSynced")) || {};
        const pending = diffRows(current, lastSynced);
        for (const t of TABLES) {
          if (!pending[t] || !pending[t].length) continue;
          const payload = pending[t].map((r) => Object.assign({ user_id: userId }, r));
          const { error } = await sb.from(t).upsert(payload, { onConflict: "id" });
          if (error) throw error;
        }
        if (Object.keys(pending).length) await kvSet("lastSynced", current);
      }
      // pull incremental
      const cursor = (await kvGet("cursor")) || "1970-01-01T00:00:00Z";
      let maxTs = cursor, remoteChanged = false;
      const pulledRows = {};
      for (const t of TABLES) {
        const { data, error } = await sb.from(t).select("*").gt("updated_at", cursor).order("updated_at", { ascending: true });
        if (error) throw error;
        pulledRows[t] = data || [];
        (data || []).forEach((r) => { if (r.updated_at > maxTs) maxTs = r.updated_at; });
        if (data && data.length) remoteChanged = true;
      }
      if (remoteChanged) {
        // reconstrói o modelo a partir do banco inteiro (simples e correto p/ single-user)
        const full = {};
        for (const t of TABLES) { const { data } = await sb.from(t).select("*"); full[t] = data || []; }
        const model2 = rowsToModel(full);
        await kvSet("snapshot", model2);
        await kvSet("lastSynced", modelToRows(model2));
        await kvSet("cursor", maxTs);
        syncing = false;
        return { pulled: true, model: model2 };
      }
      await kvSet("cursor", maxTs);
      return { pulled: false };
    } finally { syncing = false; }
  }

  // servidor vazio? (1ª vez) → semeia com o modelo dado (OF_DATA convertido)
  async function isRemoteEmpty() {
    const { count, error } = await sb.from("transactions").select("id", { count: "exact", head: true });
    if (error) throw error;
    return (count || 0) === 0;
  }
  async function seed(model) {
    await saveSnapshot(model);
    await kvSet("lastSynced", {}); // força diff completo no próximo sync → sobe tudo
    return sync();
  }

  window.Store = {
    init, onAuth, isAuthed, signIn, signOut,
    loadSnapshot, saveSnapshot, sync, isRemoteEmpty, seed,
    get userId() { return userId; },
    // puros (p/ testes)
    _modelToRows: modelToRows, _rowsToModel: rowsToModel, _diffRows: diffRows,
  };
})();
