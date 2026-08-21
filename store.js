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
  const TABLES = ["accounts", "categories", "transactions", "prefs", "asset_moves"];

  // ---------------------------------------------------------------- adaptadores puros (testáveis)
  // ids determinísticos p/ categorias (o app é todo keyed por nome; renomear = id novo + id velho vira tombstone)
  const catPid = (tipo, nome) => `c|${tipo}|${nome}`;
  const catSid = (tipo, parent, sub) => `c|${tipo}|${parent}|${sub}`;

  // modelo em memória → linhas por tabela (só o que existe; deleções vêm do diff)
  function modelToRows(model) {
    const rows = { accounts: [], categories: [], transactions: [], prefs: [], asset_moves: [] };
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
        origem: t.origem || null, destino: t.destino || null, status: t.status || null,
        imovel_id: t.imovelId || null, unidade_id: t.unidadeId || null, deleted: false,
      });
    });
    // movimentos de ativos (compra/venda) — a posição/preço-médio é DERIVADA disto no app
    (model.assetMoves || []).forEach((m) => {
      rows.asset_moves.push({
        id: String(m.id), conta_id: m.contaId || null, iso: m.iso || null,
        ticker: m.ticker || null, nome: m.nome || null, classe: m.classe || null,
        tipo: m.tipo || "compra", qtd: num(m.qtd), preco: num(m.preco), deleted: false,
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
      if (t.imovel_id) o.imovelId = t.imovel_id;
      if (t.unidade_id) o.unidadeId = t.unidade_id;
      return o;
    });
    const assetMoves = live(rows.asset_moves).map((m) => ({
      id: idFix(m.id), contaId: m.conta_id || "", iso: m.iso || "",
      ticker: m.ticker || "", nome: m.nome || "", classe: m.classe || "",
      tipo: m.tipo || "compra", qtd: num(m.qtd), preco: num(m.preco),
    }));
    const prefs = {}; live(rows.prefs).forEach((p) => { prefs[p.id] = p.value; });
    const model = { accounts, catTree, tx, prefs, assetMoves };
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

  // igualdade de linha ignorando meta. Ausente(undefined) só é igual a ausente.
  function rowEq(a, b) { if (!a || !b) return a === b; return shallowEq(stripMeta(a), stripMeta(b)); }

  // MERGE 3-vias por linha — o coração da "validação criteriosa" do sync.
  //   base   = último estado do servidor que ESTE aparelho confirmou (lastSynced)
  //   local  = snapshot local atual (o que o app tem em memória/IndexedDB)
  //   remote = estado COMPLETO e atual do servidor (null quando nada mudou lá desde o cursor)
  // Regra: uma linha só é EMPURRADA quando difere da base (edição/inclusão/exclusão minha genuína)
  // E o servidor NÃO a alterou. Se o servidor mudou a linha, o remoto vence (nunca sobrescrevemos um
  // valor mais novo do servidor com um valor local obsoleto — foi essa a causa do "push fantasma").
  // Retorna { merged: linhas do novo estado local, push: linhas a fazer upsert (inclui tombstones) }.
  function mergeRows(localR, baseR, remoteR) {
    const merged = {}, push = {};
    TABLES.forEach((t) => {
      const L = index(localR[t] || []);
      const B = index((baseR && baseR[t]) || []);
      const R = remoteR ? index(remoteR[t] || []) : B; // servidor inalterado ⇒ remoto == base
      const ids = new Set([].concat(Object.keys(L), Object.keys(B), Object.keys(R)));
      const mrows = [], prows = [];
      ids.forEach((id) => {
        const l = L[id], b = B[id], r = R[id];
        const localChanged = l ? !rowEq(l, b) : !!b;   // presente e ≠base, ou ausente mas existia (delete local)
        const remoteChanged = r ? !rowEq(r, b) : !!b;  // idem no servidor
        if (localChanged && !remoteChanged) {
          if (l) { mrows.push(l); prows.push(l); }               // minha edição/inclusão → mantém e empurra
          else if (b) prows.push(Object.assign({}, b, { deleted: true })); // minha exclusão → tombstone
        } else if (remoteChanged) {
          if (r) mrows.push(r);                                   // servidor venceu (inclui conflito) — não empurra
        } else if (l) {
          mrows.push(l);                                          // nada mudou
        }
      });
      merged[t] = mrows;
      if (prows.length) push[t] = prows;
    });
    return { merged, push };
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
  function kvDel(k) { return new Promise((res, rej) => { const r = idb.transaction("kv", "readwrite").objectStore("kv").delete(k); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

  // ---------------------------------------------------------------- Supabase + sync
  // Bump quando um bug de sync exigir descartar o cache local e re-puxar tudo.
  // v2: correção do limite de 1000 linhas (snapshots antigos vinham truncados/vazios).
  // v3: cache passa a ser por-usuário — limpa qualquer snapshot de outro usuário no mesmo aparelho.
  // v4/v5: feature de imóveis (transações ganham imovel_id/unidade_id; asset_moves; categorias
  //        de imóvel agrupadas) — força re-puxar tudo pra popular os novos campos no snapshot local.
  const SYNC_VERSION = 5;
  let sb = null, userId = null, user = null, syncing = false, syncTimer = null;
  // coordenação entre ABAS: cada gravação de snapshot incrementa "snapVersion" no IndexedDB.
  // _snapVer = a versão que ESTA aba viu por último. Se o IndexedDB estiver numa versão MAIOR na
  // hora de gravar, é porque OUTRA aba gravou depois → não sobrescreve (senão a aba velha empurraria
  // exclusões do que a outra fez — bug grave de perda de dados) e pede recarga via _staleCb.
  let _snapVer = 0, _staleCb = null, _bc = null;
  const authCbs = [];
  function bcPost(v) { try { if (_bc) _bc.postMessage({ v }); } catch (e) {} }

  async function init() {
    idb = await openIDB();
    // auto-reparo: se o snapshot local foi criado por uma versão com bug de sync, descarta p/
    // forçar um pull completo (paginado) no boot — sem isso o cache ruim persistiria pra sempre.
    if ((await kvGet("syncVersion")) !== SYNC_VERSION) {
      await kvDel("snapshot"); await kvDel("cursor"); await kvDel("lastSynced");
      await kvSet("syncVersion", SYNC_VERSION);
    }
    _snapVer = (await kvGet("snapVersion")) || 0;
    try { _bc = new BroadcastChannel("meucaixa-sync"); _bc.onmessage = (e) => { const v = e && e.data && e.data.v; if (v && v > _snapVer) { _snapVer = v; if (_staleCb) _staleCb(); } }; } catch (e) {}
    sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
    sb.auth.onAuthStateChange((_evt, session) => {
      user = session ? session.user : null;
      userId = user ? user.id : null;
      authCbs.forEach((cb) => cb(!!userId));
    });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    userId = user ? user.id : null;
    if (userId) startAutoSync();
    return { authed: !!userId };
  }
  function onAuth(cb) { authCbs.push(cb); }
  function isAuthed() { return !!userId; }
  async function signIn(email) {
    const redirect = location.origin + location.pathname;
    return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  }
  async function signInWithGoogle() {
    const redirect = location.origin + location.pathname;
    return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
  }
  async function signInPassword(email, password) { return sb.auth.signInWithPassword({ email, password }); }
  async function signUpPassword(email, password) {
    const redirect = location.origin + location.pathname;
    return sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
  }
  async function setPassword(password) { return sb.auth.updateUser({ password }); }
  async function updateName(nome) { return sb.auth.updateUser({ data: { full_name: nome } }); }
  // admin (SaaS): flag no banco + visão agregada de todos os usuários (RPC SECURITY DEFINER, guard por is_admin)
  async function isAdmin() {
    if (!userId) return false;
    try { const { data, error } = await sb.rpc("is_admin"); if (error) return false; return !!data; } catch (e) { return false; }
  }
  async function adminOverview() {
    const { data, error } = await sb.rpc("admin_overview");
    if (error) throw error;
    return data || { totais: {}, usuarios: [] };
  }
  // histórico de alterações (audit_log) — mais recente primeiro
  async function fetchAudit(limit) {
    if (!userId) return [];
    const { data, error } = await sb.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(limit || 300);
    if (error) throw error;
    return data || [];
  }
  async function signOut() {
    stopAutoSync();
    // limpa o cache local do usuário — o snapshot é por-aparelho; sem isso o PRÓXIMO usuário a
    // logar neste navegador carregaria os dados de quem saiu (vazamento entre contas).
    try { await kvDel("snapshot"); await kvDel("cursor"); await kvDel("lastSynced"); await kvDel("uid"); } catch (e) {}
    await sb.auth.signOut(); userId = null; user = null;
  }

  // snapshot local (fonte da verdade offline) — escopado ao usuário logado
  async function loadSnapshot() {
    // se o snapshot em cache é de OUTRO usuário (troca de conta no mesmo aparelho), descarta.
    const cachedUid = await kvGet("uid");
    if (userId && cachedUid && cachedUid !== userId) {
      await kvDel("snapshot"); await kvDel("cursor"); await kvDel("lastSynced");
      await kvSet("uid", userId);
      return null;
    }
    _snapVer = (await kvGet("snapVersion")) || 0; // sincroniza a versão vista com o IndexedDB
    return (await kvGet("snapshot")) || null;
  }
  async function saveSnapshot(model) {
    const curV = (await kvGet("snapVersion")) || 0;
    if (curV > _snapVer) {
      // OUTRA aba gravou depois que carreguei → meu modelo em memória está velho. NÃO sobrescreve
      // (impede empurrar exclusões do que a outra aba fez) e pede recarga do app.
      _snapVer = curV;
      if (_staleCb) _staleCb();
      return;
    }
    if (userId) await kvSet("uid", userId); // carimba de quem é o snapshot
    const nv = curV + 1;
    await kvSet("snapshot", model);
    await kvSet("snapVersion", nv);
    _snapVer = nv;
    bcPost(nv);
    scheduleSync();
  }
  function onStale(cb) { _staleCb = cb; }

  function startAutoSync() {
    stopAutoSync();
    syncTimer = setInterval(() => sync().catch(() => {}), 20000);
    window.addEventListener("online", () => sync().catch(() => {}));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sync().catch(() => {}); });
  }
  function stopAutoSync() { if (syncTimer) clearInterval(syncTimer); syncTimer = null; }
  let syncSched = null;
  function scheduleSync() { clearTimeout(syncSched); syncSched = setTimeout(() => sync().catch(() => {}), 1500); }

  const EPOCH = "1970-01-01T00:00:00Z";
  // PostgREST corta em 1000 linhas/requisição → pagina com .range() até esgotar.
  async function selectAll(table, tweak) {
    const PAGE = 1000; let from = 0; const all = [];
    for (;;) {
      let q = sb.from(table).select("*").order("updated_at", { ascending: true }).range(from, from + PAGE - 1);
      if (tweak) q = tweak(q);
      const { data, error } = await q;
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }
  // sync = PULL primeiro, depois MERGE 3-vias, depois PUSH só das edições genuínas.
  // Ordem importa: puxar antes de empurrar garante que nunca sobrescrevemos um valor mais novo do
  // servidor com um valor local obsoleto (o "push fantasma" que zerava/revertia dados no reload).
  // Retorna {pulled:bool, model?} — model presente quando o estado local mudou e o app deve reaplicar.
  async function sync() {
    if (!userId || syncing || !navigator.onLine) return { pulled: false };
    syncing = true;
    try {
      const model = await loadSnapshot();
      const localRows = model ? modelToRows(model) : { accounts: [], categories: [], transactions: [], prefs: [], asset_moves: [] };
      const base = (await kvGet("lastSynced")) || {};

      // 1) PULL incremental (paginado): descobre se o servidor mudou desde o cursor.
      const cursor = (await kvGet("cursor")) || EPOCH;
      let maxTs = cursor, remoteChanged = false;
      const pulledRows = {};
      for (const t of TABLES) {
        const data = await selectAll(t, (q) => q.gt("updated_at", cursor));
        pulledRows[t] = data;
        data.forEach((r) => { if (r.updated_at > maxTs) maxTs = r.updated_at; });
        if (data.length) remoteChanged = true;
      }
      // estado remoto COMPLETO e normalizado (só quando algo mudou lá). No 1º sync (cursor no epoch)
      // o pull incremental já trouxe tudo — reaproveita; senão refaz o full paginado.
      let remoteRows = null;
      if (remoteChanged) {
        const full = cursor === EPOCH ? pulledRows : {};
        if (cursor !== EPOCH) for (const t of TABLES) full[t] = await selectAll(t);
        remoteRows = modelToRows(rowsToModel(full));
      }

      // 2) MERGE 3-vias → novo estado local + linhas a empurrar (edições minhas que o servidor não tocou).
      const { merged, push } = mergeRows(localRows, base, remoteRows);

      // 3) PUSH das edições genuínas (inclui tombstones de exclusão).
      let pushed = false;
      for (const t of TABLES) {
        if (!push[t] || !push[t].length) continue;
        const payload = push[t].map((r) => Object.assign({ user_id: userId }, r));
        const { error } = await sb.from(t).upsert(payload, { onConflict: "user_id,id" });
        if (error) throw error;
        pushed = true;
      }

      // 4) Persistência local. Guarda anti-corrida: se o snapshot mudou DURANTE o sync (edição do
      // usuário / outra aba), não aplica o merge nem avança o cursor — reconcilia no próximo ciclo.
      const latest = await loadSnapshot();
      const localUnchanged = JSON.stringify(latest ? modelToRows(latest) : localRows) === JSON.stringify(localRows);
      if (!localUnchanged) { scheduleSync(); return { pulled: false }; }

      if (remoteChanged) {
        const model2 = rowsToModel(merged);
        const nv = ((await kvGet("snapVersion")) || 0) + 1; // nova versão + avisa as outras abas
        await kvSet("snapshot", model2);
        await kvSet("snapVersion", nv);
        _snapVer = nv;
        bcPost(nv);
        await kvSet("lastSynced", merged);
        await kvSet("cursor", maxTs);
        return { pulled: true, model: model2 };
      }
      // servidor inalterado: se empurramos algo, a baseline agora é o que o servidor passou a ter.
      if (pushed) await kvSet("lastSynced", merged);
      await kvSet("cursor", maxTs);
      return { pulled: false };
    } finally { syncing = false; }
  }

  // usuário nunca fez onboarding? (0 contas) → semeia o starter. Checa CONTAS, não transações:
  // um usuário pode ter categorias/contas sem nenhum lançamento ainda.
  async function isRemoteEmpty() {
    const { count, error } = await sb.from("accounts").select("id", { count: "exact", head: true });
    if (error) throw error;
    return (count || 0) === 0;
  }
  async function seed(model) {
    await saveSnapshot(model);
    await kvSet("lastSynced", {}); // força diff completo no próximo sync → sobe tudo
    return sync();
  }

  // ---- documentos no Supabase Storage (bucket privado 'imovel-docs'; RLS por pasta = user_id) ----
  // O banco (prefs) guarda só metadados {path,nome,tipo,size}; os bytes ficam no Storage.
  async function uploadDoc(file) {
    if (!sb || !userId) throw new Error("sem sessão");
    const safe = String(file.name || "arquivo").replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await sb.storage.from("imovel-docs").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) throw error;
    return { path, nome: file.name, tipo: file.type || "", size: file.size || 0 };
  }
  async function docSignedUrl(path) {
    if (!sb) return null;
    const { data, error } = await sb.storage.from("imovel-docs").createSignedUrl(path, 3600);
    return error ? null : data.signedUrl;
  }
  async function deleteDoc(path) { if (sb) { try { await sb.storage.from("imovel-docs").remove([path]); } catch (e) {} } }

  window.Store = {
    init, onAuth, onStale, isAuthed, signIn, signInWithGoogle, signInPassword, signUpPassword, setPassword, updateName, fetchAudit, isAdmin, adminOverview, signOut,
    loadSnapshot, saveSnapshot, sync, isRemoteEmpty, seed, uploadDoc, docSignedUrl, deleteDoc,
    get userId() { return userId; },
    get user() { return user; },
    // puros (p/ testes)
    _modelToRows: modelToRows, _rowsToModel: rowsToModel, _diffRows: diffRows, _mergeRows: mergeRows,
  };
})();
