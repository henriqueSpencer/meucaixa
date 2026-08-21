/* imoveis.js — Módulo Imóveis de renda (script clássico; escopo global compartilhado com app.js).
   Carregado ANTES do app.js no index.html: o registry VIEWS do app referencia viewImoveis em parse-time.
   As funções deste módulo usam helpers do núcleo (state, accounts, catTree, fmt, attr, applyTxToBalance,
   renderView, scheduleSave, delTx, openTxPop, acctTotal...) em call-time — por isso o escopo global compartilhado. */

/* =================================================================================
   MÓDULO IMÓVEIS DE RENDA (opcional — flag em Configurações; dados em prefs.imoveis)
   Autocontido: estado sincroniza via prefs; listeners e modais próprios (prefixo imv-).
   ================================================================================= */
const imvE = (s) => attr(s);
function imvData(){ if(!state.prefs.imoveis) state.prefs.imoveis = { enabled:false, owner:null, props:[] }; const d=state.prefs.imoveis; if(!d.props) d.props=[]; return d; }
function imvEnabled(){ return !!(state.prefs && state.prefs.imoveis && state.prefs.imoveis.enabled); }
function imvProps(){ return imvData().props; }
function imvOwner(){ const d=imvData(); if(!d.owner){ const u=(window.Store&&Store.user)||{}; const meta=u.user_metadata||{}; d.owner={nome:meta.full_name||meta.name||"",nacionalidade:"brasileiro",estadoCivil:"",sexo:"m",profissao:"",cpf:"",rg:"",endereco:"",email:u.email||"",tel:""}; } return d.owner; }
function imvBlankTenant(){ return {nome:"",cpf:"",rg:"",tel:"",email:"",endereco:"",estadoCivil:"",naturalidade:"",sexo:"m"}; }
function imvUI(){ if(!state.imv) state.imv={sub:"portfolio",propId:null,unitDetail:null,histOpen:null,chartMonths:12,tpl:"residencial",tplPropId:null,tplUnitId:null,tenant:imvBlankTenant(),contract:{inicio:"",meses:30,diaVenc:10,testNome:"",testCpf:""}}; return state.imv; }
function imvSave(){ scheduleSave(); try{ refreshSideNet(); }catch(e){} renderView(); }

/* ---- helpers de formato ---- */
function imvFmt(v){ return "R$ " + Math.round(numOr0(v)).toLocaleString("pt-BR"); }
function imvFmt2(v){ return numOr0(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function imvFmtK(v){ const a=Math.abs(v); if(a>=1e6)return (v/1e6).toFixed(a>=1e7?0:1).replace(".",",")+"M"; if(a>=1000)return Math.round(v/1000)+"k"; return String(Math.round(v)); }
function imvPct(v){ return (v*100).toFixed(1).replace(".",",")+"%"; }
const IMV_MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const IMV_MESX=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function imvYmLabel(ym){ const[y,m]=ym.split("-"); return IMV_MES[+m-1]+"/"+y.slice(2); }
function imvLastMonths(n){ const out=[]; const d=new Date(); d.setDate(1); for(let i=n-1;i>=0;i--){const t=new Date(d.getFullYear(),d.getMonth()-i,1);out.push(t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0"));} return out; }
function imvCurYM(){ const n=new Date(); return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0"); }
function imvFormatBR(iso){ if(!iso)return ""; const[y,m,d]=iso.split("-"); return `${d||"01"}/${m}/${y}`; }
function imvDataExtenso(dt){ return `${dt.getDate()} de ${IMV_MESX[dt.getMonth()]} de ${dt.getFullYear()}`; }
const imvGen=(sexo,f,m)=> (sexo||"m")==="f"?f:m;
function imvExtensoInt(n){ n=Math.floor(n); if(n===0)return "zero";
  const u=["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dez=["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const cem=["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  const tres=x=>{ if(x===100)return "cem"; let s=""; const c=Math.floor(x/100),r=x%100; if(c)s+=cem[c];
    if(r){ if(s)s+=" e "; if(r<20)s+=u[r]; else{const d=Math.floor(r/10),un=r%10; s+=dez[d]; if(un)s+=" e "+u[un];} } return s; };
  const g=[Math.floor(n/1e6)%1000,Math.floor(n/1e3)%1000,n%1000]; const p=[];
  if(g[0])p.push(tres(g[0])+(g[0]>1?" milhões":" milhão"));
  if(g[1])p.push(g[1]===1?"mil":tres(g[1])+" mil");
  if(g[2])p.push(tres(g[2]));
  return p.join(" e ");
}
function imvValorExtenso(v){ v=Math.round((v||0)*100)/100; const r=Math.floor(v),c=Math.round((v-r)*100); let s=imvExtensoInt(r)+(r===1?" real":" reais"); if(c)s+=" e "+imvExtensoInt(c)+(c===1?" centavo":" centavos"); return s; }
function imvContractDates(inicioISO,meses){ if(!inicioISO)return {ini:"",fim:""}; const[y,m,d]=inicioISO.split("-").map(Number); const fim=new Date(y,m-1+(meses||0),d); fim.setDate(fim.getDate()-1); const iso=fim.getFullYear()+"-"+String(fim.getMonth()+1).padStart(2,"0")+"-"+String(fim.getDate()).padStart(2,"0"); return {ini:imvFormatBR(inicioISO),fim:imvFormatBR(iso)}; }
function imvParseVal(s){ if(!s)return 0; s=String(s).replace(/[^\d,.-]/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."); const v=parseFloat(s); return isNaN(v)?0:Math.round(v*100)/100; }
const imvIsMoradia = p => (p.uso||"aluguel")==="moradia";

/* ---- métricas ---- */
function imvPropMetrics(p,months=12){
  const set=new Set(imvLastMonths(months)); let rec=0,desp=0;
  imvAcctTxs(p).forEach(t=>{ const k=(t.iso||"").slice(0,7); if(!set.has(k))return; if(t.tipo==="receita")rec+=Math.abs(t.valor); else if(t.tipo==="despesa")desp+=Math.abs(t.valor); });
  const vm=imvValorMercado(p), vc=imvValorCompra(p);
  const espMes=p.units.reduce((s,u)=>s+(u.aluguelEsperado||0),0);
  const realMes=p.units.filter(u=>u.status==="alugado").reduce((s,u)=>s+(u.aluguelReal||0),0);
  const ocup=p.units.filter(u=>u.status==="alugado").length;
  return { rec, desp, liquido:rec-desp, months, moradia:imvIsMoradia(p), aluguelEsperadoMes:espMes, aluguelRealMes:realMes, valorMercado:vm, valorCompra:vc,
    ocup, totalUnits:p.units.length, ocupPct:p.units.length?ocup/p.units.length:0,
    yBrutoEsperado:vm?(espMes*12)/vm:0, yBrutoReal:vm?(realMes*12)/vm:0,
    yLiquido:vm?((realMes*12)-(desp*(12/months)))/vm:0, valoriz:vc?(vm-vc)/vc:0 };
}
function imvTotals(){
  let patrim=0,custo=0,recMes=0,espMes=0,units=0,ocup=0,rentPatrim=0,moradiaPatrim=0,moradiaCount=0;
  imvProps().forEach(p=>{ const vm=imvValorMercado(p); patrim+=vm; custo+=imvValorCompra(p);
    if(imvIsMoradia(p)){ moradiaPatrim+=vm; moradiaCount++; return; }
    rentPatrim+=vm;
    p.units.forEach(u=>{ units++; if(u.status==="alugado"){ocup++; recMes+=u.aluguelReal||0;} espMes+=u.aluguelEsperado||0; });
  });
  return { patrim,custo,recMes,espMes,units,ocup, ocupPct:units?ocup/units:0, valoriz:custo?(patrim-custo)/custo:0,
    rentPatrim,moradiaPatrim,moradiaCount, yieldReal:rentPatrim?(recMes*12)/rentPatrim:0, yieldEsp:rentPatrim?(espMes*12)/rentPatrim:0 };
}

/* ---- ligação imóvel ⇄ conta real (tipo "imovel"); dinheiro vive em accounts/transactions ---- */
function imvAcct(p){ return p && p.accountId ? accounts.find(a => a.id === p.accountId) : null; }
function imvAcctName(p){ const a = imvAcct(p); return a ? a.nome : (p ? p.nome : ""); }
function imvValorMercado(p){ const a = imvAcct(p); return a ? acctTotal(a) : numOr0(p && p.valorMercado); }              // saldo do bem = valor atual
function imvValorCompra(p){ const a = imvAcct(p); return a ? numOr0(a.alocado != null ? a.alocado : a.saldo) : numOr0(p && p.valorCompra); }
function imvAcctTxs(p){ return p ? state.tx.filter(t => t.imovelId === p.id && t.tipo !== "transferencia") : []; } // ETIQUETADAS (de qualquer conta)
function imvDefaultCashAccount(){ const a = accounts.find(x => !x.arquivada && (x.tipo === "banco" || x.tipo === "dinheiro")); return a ? a.nome : (accounts[0] ? accounts[0].nome : "Conta Corrente"); }
function imvPropOfAccount(id){ return imvEnabled() ? imvProps().find((p) => p.accountId === id) : null; }
// injeta as categorias de imóvel na aba Categorias (unificadas), se faltarem
const IMV_CAT = "Imóveis de renda";
const IMV_SUBS_R = ["Aluguel", "Reajuste", "Multa/Juros"];
const IMV_SUBS_D = ["IPTU", "Condomínio", "Administração", "Manutenção", "Reparos", "Seguro", "Outros"];
// tudo de imóvel fica sob UMA categoria "Imóveis de renda" (receita e despesa), com subcategorias
function imvEnsureCategories(){
  if (!imvEnabled()) return false; let changed = false;
  const ensure = (tipo, subs) => { let c = catTree[tipo].find((x) => x.nome === IMV_CAT);
    if (!c) { c = { nome: IMV_CAT, subs: [], total: 0 }; catTree[tipo].push(c); changed = true; }
    subs.forEach((s) => { if (!c.subs.includes(s)) { c.subs.push(s); changed = true; } }); };
  ensure("receita", IMV_SUBS_R);
  ensure("despesa", IMV_SUBS_D);
  return changed;
}
function imvSubsFor(tipo){ const c = catTree[tipo] && catTree[tipo].find((x) => x.nome === IMV_CAT); return c ? c.subs : (tipo === "receita" ? IMV_SUBS_R : IMV_SUBS_D); }
// amarra o sentido inverso: toda conta tipo imovel sem imóvel ganha um imóvel vinculado
function imvLinkOrphanAccounts(){
  if (!imvEnabled()) return false; const d = imvData(); let changed = false;
  accounts.filter((a) => a.tipo === "imovel" && !a.arquivada).forEach((a) => {
    if (!d.props.some((p) => p.accountId === a.id)) {
      d.props.push({ id: "p" + a.id, accountId: a.id, nome: a.nome, tipo: "Apartamento", cidade: "", uso: "aluguel", endereco: "", units: [{ id: "u" + a.id, nome: "Unidade única", area: "—", quartos: 1, aluguelEsperado: 0, aluguelReal: 0, status: "vago", inquilino: null, historico: [], docs: [] }] });
      changed = true;
    }
  });
  return changed;
}
// campo "Imóvel (opcional)" no modal de transação — etiqueta a despesa/receita a um imóvel (+unidade)
function imvTxFieldHTML(f){
  if(!imvEnabled()) return "";
  const props = imvProps(); if(!props.length) return "";
  const sel = props.find((x) => x.id === f.imovelId);
  const uni = sel && sel.units.length > 1
    ? `<label class="fld"><span class="fld-label">Unidade</span><select data-field="unidadeId"><option value="">— imóvel todo —</option>${sel.units.map((u) => `<option value="${u.id}" ${f.unidadeId === u.id ? "selected" : ""}>${attr(u.nome)}</option>`).join("")}</select></label>`
    : "";
  return `<div class="fld-row"><label class="fld"><span class="fld-label">Imóvel <span class="lbl-hint">· opcional</span></span><select data-field="imovelId"><option value="">— nenhum —</option>${props.map((p) => `<option value="${p.id}" ${f.imovelId === p.id ? "selected" : ""}>${attr(p.nome)}</option>`).join("")}</select></label>${uni}</div>`;
}
// linhas de unidade (usadas no dropdown das abas Contas e Imóveis)
function imvUnitRows(p){
  const moradia = imvIsMoradia(p);
  return p.units.map((u) => { const occ = u.status === "alugado";
    const color = (moradia || occ) ? "var(--pos)" : "var(--subtle)";
    const right = moradia ? "próprio" : (occ ? fmt(u.aluguelReal) : "vago");
    const sub = moradia ? "uso próprio" : (occ ? imvE(u.inquilino.nome) : "disponível");
    return `<div class="unit-row"><span class="ud" style="background:${color}"></span><div class="um"><b>${imvE(u.nome)}</b><small>${sub}</small></div><span class="ur">${right}</span></div>`;
  }).join("");
}
function unitDrop(p, open, attr){
  if (!p || p.units.length <= 1) return "";
  return `<div class="unit-drop"><button class="unit-drop-btn ${open ? "open" : ""}" ${attr}>${p.units.length} unidades <span class="car">▾</span></button>${open ? `<div class="unit-rows">${imvUnitRows(p)}</div>` : ""}</div>`;
}
let _imvTxSeq = 0;
function imvAddTx(p, o){ // cria transação REAL numa conta de dinheiro, ETIQUETADA ao imóvel (+unidade)
  if (!p) return null;
  const conta = o.conta || imvDefaultCashAccount();
  const signed = o.tipo === "despesa" ? -Math.abs(o.valor) : Math.abs(o.valor);
  const iso = o.iso || TODAY_ISO;
  const tx = { id: "imv" + Date.now() + "_" + (_imvTxSeq++), data: dataBR(iso), iso, desc: o.desc || o.cat, tipo: o.tipo, cat: o.cat, sub: o.sub || "", conta, valor: signed, status: "conciliado", imovelId: p.id };
  if (o.unidadeId) tx.unidadeId = o.unidadeId;
  state.tx.push(tx); applyTxToBalance(tx, 1); sortTx(); return tx;
}

/* ---- vencimento / pagamento ---- */
function imvRentPaid(p,u,ym){ return imvAcctTxs(p).some(t=>t.tipo==="receita"&&(t.sub==="Aluguel"||t.cat==="Aluguel")&&(t.iso||"").slice(0,7)===ym&&(t.unidadeId===u.id||(!t.unidadeId&&p.units.length===1))); }
function imvUnpaidMonths(p,u){ const now=new Date(); const start=u.inquilino&&u.inquilino.inicio?u.inquilino.inicio.slice(0,7):null; const out=[];
  for(let i=0;i<12;i++){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const ym=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); if(start&&ym<start)break; if(imvRentPaid(p,u,ym))break; out.push(ym); } return out; }
function imvRentStatus(p,u){ if(u.status!=="alugado"||!u.inquilino||imvIsMoradia(p))return null;
  const now=new Date(),today=now.getDate(); const dueDay=Math.min(28,u.inquilino.diaVenc||10); const cur=imvCurYM(); const unpaid=imvUnpaidMonths(p,u); const v=u.aluguelReal||0;
  if(!unpaid.includes(cur))return {kind:"pago",dueDay,valor:v};
  const prior=unpaid.filter(y=>y!==cur).length;
  if(prior>0)return {kind:"atrasado",dueDay,meses:prior+1,dias:today>dueDay?today-dueDay:0,valor:v*(prior+1)};
  if(today<dueDay)return {kind:"avencer",dueDay,dias:dueDay-today,valor:v};
  if(today===dueDay)return {kind:"hoje",dueDay,valor:v};
  return {kind:"atrasado",dueDay,meses:1,dias:today-dueDay,valor:v};
}
function imvPending(){ const out=[]; imvProps().forEach(p=>p.units.forEach(u=>{const st=imvRentStatus(p,u); if(st&&st.kind!=="pago")out.push({p,u,st});})); const rank={atrasado:0,hoje:1,avencer:2}; return out.sort((a,b)=>rank[a.st.kind]-rank[b.st.kind]||b.st.valor-a.st.valor); }
function imvWorstRent(p){ if(imvIsMoradia(p))return null; const rank={atrasado:0,hoje:1,avencer:2,pago:3}; let best=null; p.units.forEach(u=>{const st=imvRentStatus(p,u); if(st&&(!best||rank[st.kind]<rank[best.kind]))best=st;}); return best; }
function imvRegisterPayment(p,u){ const now=new Date(); const ym=imvCurYM(); const dd=Math.min(28,u.inquilino.diaVenc||10); const data=ym+"-"+String(Math.min(now.getDate(),dd)).padStart(2,"0");
  imvModalLanc({ title:"Registrar pagamento de aluguel", tipo:"receita", sub:"Aluguel", unitId:u.id, valor:u.aluguelReal||0, desc:u.nome+" — aluguel "+imvYmLabel(ym), iso:data }, p); }
function imvRentPill(st){ if(!st)return ""; const m={ pago:`<span class="imv-rp pago">● em dia</span>`, avencer:`<span class="imv-rp av">vence dia ${st.dueDay} · em ${st.dias}d</span>`, hoje:`<span class="imv-rp hoje">⚠ vence hoje</span>`, atrasado:`<span class="imv-rp atr">⚠ atrasado${st.meses>1?` ${st.meses} meses`:st.dias?` ${st.dias}d`:""}</span>` }; return m[st.kind]||""; }

/* ---- gráficos SVG ---- */
function imvNiceCeil(v){ if(v<=0)return 1; const p=Math.pow(10,Math.floor(Math.log10(v))); const n=v/p; let m; if(n<=1)m=1;else if(n<=2)m=2;else if(n<=2.5)m=2.5;else if(n<=5)m=5;else m=10; return m*p; }
function imvTicks(lo,hi,c){ const out=[]; const st=(hi-lo)/c; for(let i=0;i<=c;i++)out.push(Math.round(lo+st*i)); return [...new Set(out)]; }
function imvBar(x,y,w,h,fill){ if(h<=0)h=0.6; const r=Math.min(4,w/2); return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" fill="${fill}"/>`; }
function imvChartRD(p,months){
  const wanted=imvLastMonths(months);
  const txs=imvAcctTxs(p);
  const bm=wanted.map(ym=>{ let r=0,d=0; txs.forEach(t=>{if((t.iso||"").slice(0,7)!==ym)return; if(t.tipo==="receita")r+=Math.abs(t.valor); else if(t.tipo==="despesa")d+=Math.abs(t.valor);}); return {ym,r,d,liq:r-d}; });
  const W=760,H=280,padL=46,padR=16,padT=18,padB=34,iw=W-padL-padR,ih=H-padT-padB;
  const maxV=Math.max(1,...bm.map(m=>Math.max(m.r,m.d))); const minLiq=Math.min(0,...bm.map(m=>m.liq));
  const top=imvNiceCeil(maxV); const bot=minLiq<0?-imvNiceCeil(-minLiq):0; const range=top-bot||1;
  const y=v=>padT+ih*(1-(v-bot)/range); const n=bm.length,slot=iw/n,bw=Math.min(15,slot*0.32);
  let bars="",labels="",grid="",line="",dots=""; const zeroY=y(0);
  imvTicks(bot,top,4).forEach(t=>{ const yy=y(t); grid+=`<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W-padR}" y2="${yy.toFixed(1)}" stroke="var(--hair)"/>`; grid+=`<text x="${padL-8}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--subtle)">${imvFmtK(t)}</text>`; });
  const step=Math.ceil(n/12);
  bm.forEach((m,i)=>{ const cx=padL+slot*i+slot/2; bars+=imvBar(cx-bw-1,y(m.r),bw,zeroY-y(m.r),"var(--pos)"); bars+=imvBar(cx+1,y(m.d),bw,zeroY-y(m.d),"var(--neg)");
    if(i%step===0||i===n-1)labels+=`<text x="${cx.toFixed(1)}" y="${H-12}" text-anchor="middle" font-size="10" fill="var(--subtle)">${imvYmLabel(m.ym)}</text>`;
    line+=(i===0?"M":"L")+cx.toFixed(1)+" "+y(m.liq).toFixed(1)+" "; dots+=`<circle cx="${cx.toFixed(1)}" cy="${y(m.liq).toFixed(1)}" r="2.6" fill="var(--brand)"/>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">${grid}<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W-padR}" y2="${zeroY.toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.4"/>${bars}<path d="${line}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
}
function imvChartRentab(){
  const rows=imvProps().filter(p=>!imvIsMoradia(p)).map(p=>{const m=imvPropMetrics(p,12); return {nome:p.nome,esp:m.yBrutoEsperado,real:m.yBrutoReal};});
  if(!rows.length) return `<div class="imv-empty">Nenhum imóvel de aluguel.</div>`;
  const maxV=Math.max(0.01,...rows.map(r=>Math.max(r.esp,r.real))); const top=Math.ceil(maxV*100)/100;
  const W=760,rowH=64,padL=170,padR=60,padT=10,H=padT+rows.length*rowH+24,iw=W-padL-padR; const x=v=>padL+iw*(v/top);
  let g="",grid=""; for(let t=0;t<=top+1e-9;t+=(top<=0.06?0.01:0.02)){ const xx=x(t); grid+=`<line x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${H-24}" stroke="var(--hair)"/><text x="${xx.toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--subtle)">${(t*100).toFixed(0)}%</text>`; }
  rows.forEach((r,i)=>{ const yy=padT+i*rowH+8; g+=`<text x="${padL-14}" y="${yy+22}" text-anchor="end" font-size="12.5" fill="var(--ink)" font-weight="500">${imvE(r.nome.length>20?r.nome.slice(0,19)+"…":r.nome)}</text>`;
    g+=imvBar(padL,yy,x(r.esp)-padL,15,"var(--brand)")+`<text x="${x(r.esp)+6}" y="${yy+12}" font-size="10.5" fill="var(--sub)">${imvPct(r.esp)}</text>`;
    g+=imvBar(padL,yy+20,x(r.real)-padL,15,"var(--pos)")+`<text x="${x(r.real)+6}" y="${yy+32}" font-size="10.5" fill="var(--sub)">${imvPct(r.real)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">${grid}${g}</svg>`;
}
function imvFloorStack(p,w=52){
  const moradia=imvIsMoradia(p); const col=moradia?"var(--pos)":"var(--brand)";
  const n=p.units.length,gap=4,bh=Math.min(20,(64-(n-1)*gap)/n),roofH=moradia?12:0,h=roofH+n*bh+(n-1)*gap+8;
  let s=`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  if(moradia)s+=`<path d="M2 ${roofH} L${w/2} 1 L${w-2} ${roofH} Z" fill="${col}" fill-opacity=".85" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/>`;
  p.units.forEach((u,i)=>{ const y=roofH+i*(bh+gap); const occ=moradia?true:u.status==="alugado";
    s+=`<rect x="1" y="${y}" width="${w-2}" height="${bh}" rx="3" fill="${occ?col:'none'}" fill-opacity="${occ?.8:1}" stroke="${col}" stroke-width="1.4" stroke-opacity="${occ?0:.6}"/>`; });
  s+=`<line x1="0" y1="${h-4}" x2="${w}" y2="${h-4}" stroke="${col}" stroke-width="2" stroke-opacity=".7"/></svg>`; return s;
}

/* ---- documentos ---- */
function imvDocIcon(t){ t=t||""; if(/pdf/.test(t))return "📄"; if(/image/.test(t))return "🖼️"; if(/word|doc/.test(t))return "📝"; if(/sheet|excel|csv/.test(t))return "📊"; return "📎"; }
function imvBytes(b){ if(!b)return ""; if(b<1024)return b+" B"; if(b<1048576)return (b/1024).toFixed(0)+" KB"; return (b/1048576).toFixed(1)+" MB"; }
function imvDocList(docs,scope){ if(!docs||!docs.length)return `<div class="imv-empty" style="padding:14px 0">Nenhum documento anexado.</div>`;
  return docs.map(d=>{ const abrir = d.path ? `<button class="imv-dv" data-imv-doc-open="${imvE(d.path)}">Abrir</button>` : `<a class="imv-dv" href="${d.dataURL}" target="_blank" rel="noopener">Abrir</a>`;
    return `<div class="imv-doc"><div class="imv-dic">${imvDocIcon(d.tipo)}</div><div class="imv-dn"><b>${imvE(d.nome)}</b><small>${imvE((d.tipo||"arquivo").split(";")[0])}${d.size?" · "+imvBytes(d.size):""}</small></div>${abrir}<button class="imv-x" data-imv-doc-del="${scope}|${d.id}" title="Remover">×</button></div>`; }).join("");
}
function imvUnitOf(){ const ui=imvUI(); if(!ui.unitDetail)return null; const p=imvProps().find(x=>x.id===ui.unitDetail.propId); return p?p.units.find(x=>x.id===ui.unitDetail.unitId):null; }
function imvCurProp(){ const ui=imvUI(); const pid=(ui.unitDetail&&ui.unitDetail.propId)||ui.propId; return pid?imvProps().find(p=>p.id===pid):null; }
function imvDocHolder(scope){
  if(scope==="prop"){ const p=imvCurProp(); if(p&&!p.docs)p.docs=[]; return p; }
  const u=imvUnitOf();
  if(scope==="unit"){ if(u&&!u.docs)u.docs=[]; return u; }
  if(!u)return null;
  if(scope==="cur")return u.inquilino;
  if(scope[0]==="h")return (u.historico||[])[+scope.slice(1)];
  return null;
}
function imvDelDoc(val){ const i=val.indexOf("|"); const h=imvDocHolder(val.slice(0,i)); if(!h)return; const id=val.slice(i+1);
  const doc=(h.docs||[]).find(d=>d.id===id);
  if(doc && doc.path && window.Store && Store.deleteDoc) Store.deleteDoc(doc.path); // remove do Storage
  h.docs=(h.docs||[]).filter(d=>d.id!==id); imvSave(); }
// upload pro Supabase Storage (bucket privado); guarda só metadados {path,nome,tipo,size}
function imvAddDocs(input, scope){ const files=[...(input.files||[])]; if(!files.length)return;
  const holder=imvDocHolder(scope||"cur"); if(!holder){alert("Registre o inquilino antes de anexar documentos.");return;}
  if(!(window.Store && Store.uploadDoc)){ alert("Faça login para anexar documentos."); return; }
  if(!holder.docs)holder.docs=[]; let pending=files.length, errs=0;
  const done=()=>{ if(errs) alert(errs+" arquivo(s) não enviados (máx. 25 MB cada, e precisa de conexão)."); imvSave(); };
  files.forEach(f=>{ if(f.size>25*1024*1024){ errs++; if(--pending===0)done(); return; }
    Store.uploadDoc(f).then(m=>{ holder.docs.push({id:"d"+Date.now()+"_"+Math.random().toString(36).slice(2,7),nome:m.nome,tipo:m.tipo,size:m.size,path:m.path}); })
      .catch(()=>{ errs++; }).finally(()=>{ if(--pending===0)done(); }); });
}

/* ---- VIEW principal ---- */
function viewImoveis(){
  if(!imvEnabled()) return `<div class="imv-root"><div class="imv-empty">Módulo desativado. Ative em Configurações.</div></div>`;
  const ui=imvUI(); let body;
  if(ui.unitDetail) body=imvViewUnitDetail();
  else if(ui.sub==="portfolio"&&ui.propId) body=imvViewPropDetail();
  else if(ui.sub==="rentabilidade") body=imvViewRentab();
  else if(ui.sub==="contratos") body=imvViewContratos();
  else body=imvViewPortfolio();
  const showNav=!ui.unitDetail && !(ui.sub==="portfolio"&&ui.propId);
  const nav=showNav?`<div class="imv-subnav">${[["portfolio","Portfólio"],["rentabilidade","Rentabilidade"],["contratos","Contratos"]].map(([k,l])=>`<button data-imv-sub="${k}" class="${ui.sub===k?'on':''}">${l}</button>`).join("")}</div>`:"";
  return `<div class="imv-root">${nav}${body}</div>`;
}

function imvRentAlert(){
  const pend=imvPending(); if(!pend.length)return "";
  const atr=pend.filter(x=>x.st.kind==="atrasado"),hoje=pend.filter(x=>x.st.kind==="hoje"),av=pend.filter(x=>x.st.kind==="avencer");
  const urgent=atr.length||hoje.length; const totAtraso=atr.reduce((s,x)=>s+x.st.valor,0);
  const rows=pend.slice(0,10).map(({p,u,st})=>`<div class="imv-cobr">${imvRentPill(st)}<div class="imv-cm"><b>${imvE(u.inquilino.nome)}</b><small>${imvE(p.nome)} · ${imvE(u.nome)} · vence dia ${st.dueDay}</small></div><div class="imv-cv">${imvFmt(st.valor)}</div><button class="imv-btn primary sm" data-imv-pay="${p.id}|${u.id}">Registrar pagamento</button></div>`).join("");
  const parts=[]; if(atr.length)parts.push(`${atr.length} em atraso`); if(hoje.length)parts.push(`${hoje.length} vence${hoje.length>1?'m':''} hoje`); if(!urgent&&av.length)parts.push(`${av.length} a vencer em breve`);
  return `<div class="imv-alert ${urgent?'':'warn'}"><h4>${urgent?'⚠ ':''}Aluguéis: ${parts.join(' · ')}${totAtraso?` — ${imvFmt(totAtraso)} em aberto`:''}</h4>${rows}</div>`;
}

function imvViewPortfolio(){
  const props=imvProps();
  if(!props.length) return `<div class="imv-onboard">
      <div class="imv-onboard-ic">🏠</div>
      <h2>Seus imóveis de aluguel</h2>
      <p>Cadastre cada imóvel como uma conta: lance receitas e despesas, controle inquilinos, contratos, vencimentos e rentabilidade.</p>
      <div class="imv-row" style="justify-content:center">
        <button class="imv-btn primary" data-imv-add-prop>+ Adicionar imóvel</button>
        <button class="imv-btn" data-imv-sample>Carregar dados de exemplo</button>
      </div></div>`;
  const t=imvTotals();
  const kpis=`<div class="imv-kpis">
    <div class="imv-kpi"><div class="l">Patrimônio em imóveis</div><div class="v">${imvFmt(t.patrim)}</div><div class="s"><span class="pos">▲ ${imvPct(t.valoriz)}</span>${t.moradiaCount?` · inclui ${imvFmt(t.moradiaPatrim)} moradia`:''}</div></div>
    <div class="imv-kpi"><div class="l">Aluguel / mês</div><div class="v">${imvFmt(t.recMes)}</div><div class="s">esperado ${imvFmt(t.espMes)}</div></div>
    <div class="imv-kpi"><div class="l">Yield real (a.a.)</div><div class="v">${imvPct(t.yieldReal)}</div><div class="s">sobre ${imvFmt(t.rentPatrim)} p/ alugar</div></div>
    <div class="imv-kpi"><div class="l">Ocupação</div><div class="v">${t.ocup}/${t.units}</div><div class="s">${imvPct(t.ocupPct)} alugado${t.moradiaCount?` · ${t.moradiaCount} moradia`:''}</div></div>
  </div>`;
  const cards=props.map(p=>{
    const m=imvPropMetrics(p,12); const moradia=imvIsMoradia(p);
    const occColor=m.ocupPct===1?"var(--pos)":m.ocupPct===0?"var(--neg)":"var(--brand)";
    const tag=moradia?`<span class="imv-tag" style="color:var(--pos);border-color:var(--pos)">🏠 Moradia própria</span>`:`<span class="imv-tag">${p.units.length} ${p.units.length>1?'unidades':'unidade'}</span>`;
    const worst=moradia?null:imvWorstRent(p);
    const body=moradia?`<div class="imv-occ"><span><span class="imv-dot" style="background:var(--pos)"></span>Uso próprio — fora do aluguel</span></div>
        <div class="imv-metrics"><div><div class="k">Valor</div><div class="vv">${imvFmt(m.valorMercado)}</div></div><div><div class="k">Valorização</div><div class="vv pos">▲ ${imvPct(m.valoriz)}</div></div><div><div class="k">Despesas 12m</div><div class="vv neg">${imvFmt(m.desp)}</div></div><div><div class="k">Rentabilidade</div><div class="vv" style="color:var(--subtle)">n/a</div></div></div>`
      :`<div class="imv-occ"><span><span class="imv-dot" style="background:${occColor}"></span>${m.ocup} de ${m.totalUnits} alugada${m.totalUnits>1?'s':''}</span>${worst&&worst.kind!=="pago"?imvRentPill(worst):""}</div>
        <div class="imv-metrics"><div><div class="k">Valor de mercado</div><div class="vv">${imvFmt(m.valorMercado)}</div></div><div><div class="k">Yield real</div><div class="vv" style="color:${m.yBrutoReal>=m.yBrutoEsperado*0.95?'var(--pos)':'var(--brand)'}">${imvPct(m.yBrutoReal)}</div></div><div><div class="k">Receita 12m</div><div class="vv pos">${imvFmt(m.rec)}</div></div><div><div class="k">Resultado 12m</div><div class="vv ${m.liquido>=0?'pos':'neg'}">${imvFmt(m.liquido)}</div></div></div>`;
    const drop=unitDrop(p, !!(imvUI().expand&&imvUI().expand[p.id]), `data-imv-units="${p.id}"`);
    return `<div class="imv-pcard" data-imv-prop="${p.id}"><div class="imv-pcard-top">${imvFloorStack(p)}<div style="min-width:0;flex:1"><h3>${imvE(p.nome)}</h3><div class="imv-addr">${imvE(p.cidade||"")} · ${imvE(p.tipo||"")}</div>${tag}</div></div><div class="imv-pcard-body">${body}${drop}</div></div>`;
  }).join("");
  return `<div class="imv-head"><div><h1>Portfólio de imóveis</h1><p>Cada imóvel é uma conta — clique para lançar receitas/despesas, ver inquilinos e rentabilidade.</p></div><div class="imv-row">${props.length>=2?`<button class="imv-btn" data-imv-rateio>Custo compartilhado</button>`:""}<button class="imv-btn primary" data-imv-add-prop>+ Novo imóvel</button></div></div>${imvRentAlert()}${kpis}<div class="imv-grid">${cards}</div>`;
}

function imvYieldMeters(m){
  const scale=Math.max(m.yBrutoEsperado,m.yBrutoReal,0.08);
  const bar=(v,c)=>`<div class="imv-ybar"><i style="width:${Math.min(100,(v/scale)*100)}%;background:${c}"></i></div>`;
  return `<div class="imv-ymeters"><div class="imv-ym"><div class="yl">Bruta esperada</div><div class="yv">${imvPct(m.yBrutoEsperado)} <small>a.a.</small></div>${bar(m.yBrutoEsperado,'var(--brand)')}<div class="yf">${imvFmt(m.aluguelEsperadoMes)}/mês cheio</div></div>
    <div class="imv-ym"><div class="yl">Bruta real</div><div class="yv pos">${imvPct(m.yBrutoReal)} <small>a.a.</small></div>${bar(m.yBrutoReal,'var(--pos)')}<div class="yf">${imvFmt(m.aluguelRealMes)}/mês alugado</div></div>
    <div class="imv-ym"><div class="yl">Líquida</div><div class="yv" style="color:${m.yLiquido>=0?'var(--pos)':'var(--neg)'}">${imvPct(m.yLiquido)} <small>a.a.</small></div>${bar(Math.max(0,m.yLiquido),'var(--brand)')}<div class="yf">após despesas 12m</div></div></div>`;
}

function imvMesLongo(ym){ const [y,m]=ym.split("-"); return IMV_MESX[+m-1]+" de "+y; }
// visão mensal agrupada por categoria, com meses e grupos expansíveis/aglutináveis
function imvMensalHTML(p){
  const ui=imvUI(); const wanted=imvLastMonths(ui.chartMonths).slice().reverse();
  const txs=imvAcctTxs(p); const byM={}; txs.forEach(t=>{const k=(t.iso||"").slice(0,7); (byM[k]=byM[k]||[]).push(t);});
  const months=wanted.filter(ym=>byM[ym]&&byM[ym].length);
  if(!months.length) return `<div class="imv-empty">Nenhum lançamento no período.</div>`;
  return `<div class="imv-mensal">`+months.map(ym=>{
    const list=byM[ym]; let rec=0,desp=0; list.forEach(t=>{ if(t.tipo==="receita")rec+=Math.abs(t.valor); else if(t.tipo==="despesa")desp+=Math.abs(t.valor); });
    const res=rec-desp; const mOpen=ui.monthOpen&&ui.monthOpen[ym];
    const grp={}; list.forEach(t=>{ const k=t.sub||t.cat||"—"; (grp[k]=grp[k]||[]).push(t); });
    const groups=Object.keys(grp).sort().map(cat=>{
      const g=grp[cat]; let gt=0; g.forEach(t=>{ gt+=(t.tipo==="receita"?1:-1)*Math.abs(t.valor); });
      const gk=ym+"|"+cat; const gOpen=ui.grpOpen&&ui.grpOpen[gk];
      const trs=gOpen? g.slice().sort((a,b)=>(b.iso||"")<(a.iso||"")?-1:1).map(t=>`<div class="imv-mrow click" data-tx-open="${t.id}"><span class="d">${(t.iso||"").split("-").reverse().slice(0,2).join("/")}</span><span class="ds">${imvE(t.desc)}</span><span class="v ${t.tipo==='receita'?'pos':'neg'}">${t.tipo==='receita'?'+':'−'}${imvFmt(Math.abs(t.valor))}</span></div>`).join(""):"";
      return `<div class="imv-grp"><button class="imv-grp-h ${gOpen?'open':''}" data-imv-grp="${gk}"><span class="car">▾</span><span class="gn">${imvE(cat)}</span><span class="gc">${g.length}</span><span class="gv ${gt>=0?'pos':'neg'}">${gt>=0?'+':'−'}${imvFmt(Math.abs(gt))}</span></button>${gOpen?`<div class="imv-grp-b">${trs}</div>`:""}</div>`;
    }).join("");
    return `<div class="imv-mon"><button class="imv-mon-h ${mOpen?'open':''}" data-imv-mon="${ym}"><span class="car">▾</span><span class="mn">${imvMesLongo(ym)}</span><span class="mstats"><span class="pos">+${imvFmt(rec)}</span><span class="neg">−${imvFmt(desp)}</span><b class="${res>=0?'pos':'neg'}">${res>=0?'+':'−'}${imvFmt(Math.abs(res))}</b></span></button>${mOpen?`<div class="imv-mon-b">${groups}</div>`:""}</div>`;
  }).join("")+`</div>`;
}
function imvViewPropDetail(){
  const ui=imvUI(); const p=imvProps().find(x=>x.id===ui.propId); if(!p){ui.propId=null; return imvViewPortfolio();}
  if(!ui.extMode) ui.extMode="mensal";
  const m=imvPropMetrics(p,ui.chartMonths),m12=imvPropMetrics(p,12),moradia=imvIsMoradia(p);
  const units=p.units.map(u=>{
    if(moradia)return `<div class="imv-unit"><div class="imv-badge" style="color:var(--pos)">${u.icon||'🏠'}</div><div class="imv-umain click" data-imv-edit-unit="${u.id}" title="Editar unidade"><div class="un">${imvE(u.nome)}</div><div class="us">${imvE(u.area||"")} · ocupado pelo proprietário</div></div><div class="imv-row"><button class="imv-btn sm" data-imv-edit-unit="${u.id}">Editar</button></div></div>`;
    const occ=u.status==="alugado"; const diff=u.aluguelEsperado?(u.aluguelReal-u.aluguelEsperado):0; const st=imvRentStatus(p,u); const pend=st&&st.kind!=="pago";
    return `<div class="imv-unit"><div class="imv-badge">${u.icon||(occ?'🔑':'—')}</div>
      <div class="imv-umain click" data-imv-unit-detail="${u.id}" title="Abrir unidade"><div class="un">${imvE(u.nome)} ${occ?'':'<span class="imv-pill neg">vago</span>'}</div>
      <div class="us">${imvE(u.area||"")}${u.quartos?' · '+u.quartos+' dorm.':''} ${occ?'· '+imvE(u.inquilino.nome)+' · vence dia '+st.dueDay:''}</div>${occ?`<div style="margin-top:6px">${imvRentPill(st)}</div>`:''}</div>
      <div class="imv-urent"><div class="big">${occ?imvFmt(u.aluguelReal):'—'}</div><div class="sm">esperado ${imvFmt(u.aluguelEsperado)}${diff<0?' · <span class="neg">-'+imvFmt(-diff)+'</span>':''}</div></div>
      <div class="imv-row">${pend?`<button class="imv-btn primary sm" data-imv-pay="${p.id}|${u.id}">Registrar pagamento</button>`:''}<button class="imv-btn sm" data-imv-unit-detail="${u.id}">👤 Inquilino${u.historico&&u.historico.length?` · ${u.historico.length} hist.`:''}</button>${occ?`<button class="imv-btn sm" data-imv-contract-unit="${u.id}">Contrato</button>`:`<button class="imv-btn primary sm" data-imv-edit-unit="${u.id}">Alugar</button>`}</div></div>`;
  }).join("");
  const wanted=new Set(imvLastMonths(ui.chartMonths));
  const rows=imvAcctTxs(p).filter(t=>wanted.has((t.iso||"").slice(0,7))).sort((a,b)=>(b.iso||"")<(a.iso||"")?-1:1).slice(0,60).map(t=>`<tr class="imv-txr" data-tx-open="${t.id}"><td class="imv-mono" style="color:var(--sub)">${(t.iso||"").split("-").reverse().join("/")}</td><td>${imvE(t.desc)}</td><td><span class="imv-pill">${imvE(t.sub||t.cat)}</span></td><td class="imv-num ${t.tipo==='receita'?'pos':'neg'}">${t.tipo==='receita'?'+':'−'}${imvFmt(Math.abs(t.valor))}</td></tr>`).join("");
  return `<button class="imv-back" data-imv-sub="portfolio">← Portfólio</button>
    <div class="imv-head"><div style="display:flex;gap:16px;align-items:flex-start">${imvFloorStack(p,56)}<div><div class="imv-eyebrow">${imvE(p.tipo||"")} · ${imvE(p.cidade||"")}${moradia?' · <span style="color:var(--pos)">🏠 Moradia</span>':''}</div><h1>${imvE(p.nome)}</h1><p>${imvE(p.endereco||"")}</p></div></div>
    <div class="imv-row"><button class="imv-btn" data-imv-toggle-uso="${p.id}">${moradia?'↩ Voltar p/ aluguel':'🏠 Marcar moradia'}</button><button class="imv-btn" data-imv-edit-prop="${p.id}">Editar</button><button class="imv-btn primary" data-imv-add-lanc>+ Lançar</button></div></div>
    <div class="imv-kpis">
      <div class="imv-kpi"><div class="l">Valor de mercado</div><div class="v">${imvFmt(m12.valorMercado)}</div><div class="s"><span class="pos">▲ ${imvPct(m12.valoriz)}</span> desde ${imvFmt(m12.valorCompra)}</div></div>
      ${moradia?`<div class="imv-kpi"><div class="l">Despesas ${ui.chartMonths}m</div><div class="v neg">${imvFmt(m.desp)}</div><div class="s">custo de manter</div></div><div class="imv-kpi"><div class="l">Custo médio/mês</div><div class="v">${imvFmt(m.desp/ui.chartMonths)}</div><div class="s">no período</div></div><div class="imv-kpi"><div class="l">Uso</div><div class="v" style="font-size:18px;color:var(--pos)">Moradia própria</div><div class="s">fora do aluguel</div></div>`
        :`<div class="imv-kpi"><div class="l">Receita ${ui.chartMonths}m</div><div class="v pos">${imvFmt(m.rec)}</div><div class="s">despesas ${imvFmt(m.desp)}</div></div><div class="imv-kpi"><div class="l">Resultado ${ui.chartMonths}m</div><div class="v ${m.liquido>=0?'pos':'neg'}">${imvFmt(m.liquido)}</div><div class="s">líquido do período</div></div><div class="imv-kpi"><div class="l">Ocupação</div><div class="v">${m.ocup}/${m.totalUnits}</div><div class="s">aluguel/mês ${imvFmt(m.aluguelRealMes)}</div></div>`}
    </div>
    <div class="imv-divlabel">Unidades</div>${units}${!moradia?`<div class="imv-row" style="margin-top:8px"><button class="imv-btn sm" data-imv-manage-units="${p.id}">⚙ Gerenciar unidades (adicionar · juntar · separar · excluir)</button></div>`:""}
    <div class="imv-two">
      <div class="imv-panel"><div class="imv-panel-head"><div><h2>${moradia?'Despesas':'Receita × despesa'}</h2><p>${moradia?'Custos mensais.':'Barras por mês; linha em latão = resultado líquido.'}</p></div><div class="imv-seg">${[3,6,12,24].map(nn=>`<button data-imv-months="${nn}" class="${ui.chartMonths===nn?'on':''}">${nn}m</button>`).join("")}</div></div>
        <div class="imv-legend">${moradia?'<span><i style="background:var(--neg)"></i>Despesa</span>':'<span><i style="background:var(--pos)"></i>Receita</span><span><i style="background:var(--neg)"></i>Despesa</span><span><i class="ln" style="background:var(--brand)"></i>Resultado</span>'}</div>${imvChartRD(p,ui.chartMonths)}</div>
      <div class="imv-panel"><h2>${moradia?'Patrimônio':'Rentabilidade'}</h2>${moradia?`<p class="imv-phint">Uso próprio — sem aluguel a render.</p><div class="imv-ym" style="margin-top:8px"><div class="yl">Valorização</div><div class="yv pos">▲ ${imvPct(m12.valoriz)}</div><div class="yf">desde a compra (${imvFmt(m12.valorCompra)})</div></div>`:`<p class="imv-phint">Yield bruto anualizado sobre o valor de mercado.</p>${imvYieldMeters(m12)}`}</div>
    </div>
    <div class="imv-panel" style="margin-top:16px"><div class="imv-panel-head"><h2>Lançamentos · ${ui.chartMonths} meses</h2><div class="imv-row"><div class="imv-seg"><button data-imv-extmode="mensal" class="${ui.extMode==='mensal'?'on':''}">Mensal</button><button data-imv-extmode="crono" class="${ui.extMode==='crono'?'on':''}">Cronológico</button></div><button class="imv-btn sm" data-imv-add-lanc>+ Lançar</button></div></div>
      ${ui.extMode==='crono'
        ? `<table class="imv-stmt"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="imv-empty">Nenhum lançamento no período.</td></tr>'}</tbody></table>`
        : imvMensalHTML(p)}
    </div>
    <div class="imv-panel" style="margin-top:16px"><h2>Documentos do imóvel</h2><p class="imv-phint">Escritura, matrícula, IPTU, planta, apólice de seguro — vale para o imóvel todo${p.units.length>1?" (todas as unidades)":""}.</p>
      <label class="imv-docup"><input type="file" data-imv-doc-up="prop" multiple style="display:none">📎 Anexar documento do imóvel</label>${imvDocList(p.docs,"prop")}</div>`;
}

function imvViewUnitDetail(){
  const ui=imvUI(); const {propId,unitId}=ui.unitDetail; const p=imvProps().find(x=>x.id===propId); if(!p){ui.unitDetail=null;return imvViewPortfolio();}
  const u=p.units.find(x=>x.id===unitId); if(!u){ui.unitDetail=null;return imvViewPropDetail();}
  const inq=u.inquilino; const occ=u.status==="alugado"&&!!inq;
  const cur=occ?`<div class="imv-tcard"><div><div class="k">Nome</div><div class="vv">${imvE(inq.nome)}</div></div><div><div class="k">CPF/CNPJ</div><div class="vv imv-mono">${imvE(inq.cpf||'—')}</div></div><div><div class="k">R.G</div><div class="vv imv-mono">${imvE(inq.rg||'—')}</div></div><div><div class="k">Telefone</div><div class="vv">${imvE(inq.tel||'—')}</div></div><div><div class="k">E-mail</div><div class="vv">${imvE(inq.email||'—')}</div></div><div><div class="k">Desde</div><div class="vv">${inq.inicio?imvFormatBR(inq.inicio):'—'}</div></div><div><div class="k">Vencimento</div><div class="vv">dia ${inq.diaVenc||10}</div></div><div><div class="k">Aluguel</div><div class="vv">${imvFmt(u.aluguelReal)}</div></div></div>
    <div class="imv-row" style="margin-top:12px"><button class="imv-btn sm" data-imv-edit-unit="${u.id}">Editar dados</button><button class="imv-btn sm" data-imv-contract-unit="${u.id}">Gerar contrato</button><button class="imv-btn sm danger" data-imv-encerrar="${u.id}">Encerrar locação</button></div>
    <div class="imv-divlabel">Observações</div><textarea class="imv-obs" data-imv-obs placeholder="Anotações: forma de pagamento, animais, combinados…">${imvE(inq.obs||'')}</textarea>
    <div class="imv-divlabel">Documentos do inquilino</div><label class="imv-docup"><input type="file" data-imv-doc-up="cur" multiple style="display:none">📎 Anexar (RG, CPF, comprovantes, contrato assinado…)</label>${imvDocList(inq.docs,"cur")}`
    :`<div class="imv-tip">Unidade <b>vaga</b>. Registre um inquilino para guardar dados, observações e documentos.</div><div class="imv-row" style="margin-top:12px"><button class="imv-btn primary" data-imv-edit-unit="${u.id}">Registrar inquilino</button></div>`;
  const hist=(u.historico&&u.historico.length)?u.historico.map((h,i)=>{ const open=ui.histOpen===(propId+"|"+unitId+"|"+i);
    return `<div class="imv-hist"><div class="hh" data-imv-hist="${i}"><div class="imv-badge">👤</div><div class="hn"><b>${imvE(h.nome)}</b><small>${h.inicio?imvFormatBR(h.inicio):'?'} — ${h.fim?imvFormatBR(h.fim):'?'} · ${imvFmt(h.aluguel||0)}/mês${h.docs&&h.docs.length?' · '+h.docs.length+' doc':''}</small></div><span style="color:var(--subtle)">${open?'▲':'▼'}</span></div>${open?`<div class="hb"><div class="imv-tcard"><div><div class="k">CPF</div><div class="vv imv-mono">${imvE(h.cpf||'—')}</div></div><div><div class="k">Telefone</div><div class="vv">${imvE(h.tel||'—')}</div></div><div><div class="k">E-mail</div><div class="vv">${imvE(h.email||'—')}</div></div><div><div class="k">Natural de</div><div class="vv">${imvE(h.naturalidade||'—')}</div></div></div>
      <div class="imv-row" style="margin-top:10px"><button class="imv-btn sm" data-imv-hist-edit="${i}">Editar dados</button><button class="imv-btn sm danger" data-imv-hist-del="${i}">Excluir do histórico</button></div>
      ${h.obs?`<div class="imv-divlabel">Observações</div><p class="imv-phint">${imvE(h.obs)}</p>`:''}
      <div class="imv-divlabel">Documentos</div><label class="imv-docup"><input type="file" data-imv-doc-up="h${i}" multiple style="display:none">📎 Anexar documento deste inquilino</label>${imvDocList(h.docs,"h"+i)}</div>`:''}</div>`; }).join(""):`<div class="imv-empty">Nenhum inquilino anterior.</div>`;
  return `<button class="imv-back" data-imv-unit-back="${propId}">← ${imvE(p.nome)}</button>
    <div class="imv-head"><div><div class="imv-eyebrow">${imvE(p.nome)}${u.area&&u.area!=='—'?' · '+imvE(u.area):''}${u.quartos?' · '+u.quartos+' dorm.':''}</div><h1>${imvE(u.nome)}</h1><p>${occ?'Inquilino atual, observações, documentos e histórico.':'Unidade vaga — histórico preservado abaixo.'}</p></div><div class="imv-row"><button class="imv-btn" data-imv-edit-unit="${u.id}">✏ Editar unidade</button></div></div>
    <div class="imv-panel"><h2>Inquilino atual</h2>${cur}</div>
    <div class="imv-panel" style="margin-top:16px"><h2>Documentos da unidade</h2><p class="imv-phint">Vistoria/laudo, planta, manuais, cópia de chave — específicos desta unidade (independem do inquilino).</p><label class="imv-docup"><input type="file" data-imv-doc-up="unit" multiple style="display:none">📎 Anexar documento da unidade</label>${imvDocList(u.docs,"unit")}</div>
    <div class="imv-panel" style="margin-top:16px"><div class="imv-panel-head"><h2>Histórico de inquilinos</h2><button class="imv-btn sm" data-imv-hist-add>＋ Adicionar ao histórico</button></div><p class="imv-phint">Quem já ocupou esta unidade — clique para ver/editar, anexar documentos e anotações.</p>${hist}</div>`;
}

function imvViewRentab(){
  const props=imvProps().filter(p=>!imvIsMoradia(p)); const t=imvTotals();
  const rows=props.map(p=>({p,m:imvPropMetrics(p,12)})).sort((a,b)=>b.m.yBrutoReal-a.m.yBrutoReal);
  const tbody=rows.map(({p,m})=>`<tr data-imv-prop="${p.id}" style="cursor:pointer"><td><b>${imvE(p.nome)}</b><div style="color:var(--subtle);font-size:12px">${imvE(p.tipo||"")} · ${m.ocup}/${m.totalUnits}</div></td><td class="imv-num">${imvFmt(m.valorMercado)}</td><td class="imv-num">${imvFmt(m.aluguelRealMes)}</td><td class="imv-num" style="color:var(--brand)">${imvPct(m.yBrutoEsperado)}</td><td class="imv-num pos">${imvPct(m.yBrutoReal)}</td><td class="imv-num ${m.yLiquido>=0?'pos':'neg'}">${imvPct(m.yLiquido)}</td><td class="imv-num pos">▲ ${imvPct(m.valoriz)}</td></tr>`).join("");
  return `<div class="imv-head"><div><h1>Rentabilidade da carteira</h1><p>Yield esperado (cheio) × real (alugado) × líquido (após despesas).${t.moradiaCount?` <b>${t.moradiaCount} de moradia (${imvFmt(t.moradiaPatrim)})</b> fora do cálculo.`:''}</p></div></div>
    <div class="imv-kpis"><div class="imv-kpi"><div class="l">Yield médio real</div><div class="v pos">${imvPct(t.yieldReal)}</div><div class="s">potencial ${imvPct(t.yieldEsp)}</div></div><div class="imv-kpi"><div class="l">Aluguel/mês</div><div class="v">${imvFmt(t.recMes)}</div><div class="s">de ${imvFmt(t.espMes)} possível</div></div><div class="imv-kpi"><div class="l">Valorização</div><div class="v pos">▲ ${imvPct(t.valoriz)}</div><div class="s">sobre a compra</div></div><div class="imv-kpi"><div class="l">Ocupação</div><div class="v">${imvPct(t.ocupPct)}</div><div class="s">${t.ocup}/${t.units} unid.</div></div></div>
    <div class="imv-panel"><h2>Yield esperado × real</h2><div class="imv-legend"><span><i style="background:var(--brand)"></i>Esperado</span><span><i style="background:var(--pos)"></i>Real</span></div>${imvChartRentab()}</div>
    <div class="imv-panel" style="margin-top:16px"><h2>Detalhamento</h2><p class="imv-phint">Clique numa linha para abrir o imóvel.</p><table class="imv-stmt"><thead><tr><th>Imóvel</th><th style="text-align:right">Valor</th><th style="text-align:right">Aluguel/mês</th><th style="text-align:right">Yield esp.</th><th style="text-align:right">Yield real</th><th style="text-align:right">Yield líq.</th><th style="text-align:right">Valoriz.</th></tr></thead><tbody>${tbody||'<tr><td colspan="7" class="imv-empty">Nenhum imóvel de aluguel.</td></tr>'}</tbody></table></div>`;
}

/* ---- contratos ---- */
const IMV_TPL={ residencial:{nome:"Locação residencial",desc:"Casa/apartamento para moradia. 30 meses (Lei 8.245/91).",icon:"🏠"}, comercial:{nome:"Locação comercial",desc:"Ponto/sala comercial. Prazo livre.",icon:"🏬"}, temporada:{nome:"Locação por temporada",desc:"Até 90 dias, mobiliado.",icon:"🌴"} };
function imvPickSel(){ const ui=imvUI(); if(!ui.tplPropId||!ui.tplUnitId)return null; const p=imvProps().find(x=>x.id===ui.tplPropId); if(!p)return null; const u=p.units.find(x=>x.id===ui.tplUnitId); if(!u)return null; return {p,u}; }
function imvPrefillTenant(force){ const ui=imvUI(); const sel=imvPickSel();
  if(sel&&sel.u.inquilino){ const i=sel.u.inquilino; ui.tenant={nome:i.nome||"",cpf:i.cpf||"",rg:i.rg||"",tel:i.tel||"",email:i.email||"",endereco:i.endereco||"",estadoCivil:i.estadoCivil||"",naturalidade:i.naturalidade||"",sexo:i.sexo||"m"}; ui.contract={...ui.contract,inicio:i.inicio||ui.contract.inicio||"",meses:i.meses||ui.contract.meses||30,diaVenc:i.diaVenc||ui.contract.diaVenc||10}; }
  else if(force){ ui.tenant=imvBlankTenant(); } }
function imvViewContratos(){
  const ui=imvUI();
  if(imvProps().filter(p=>!imvIsMoradia(p)).length===0) return `<div class="imv-head"><div><h1>Modelos de contrato</h1></div></div><div class="imv-empty">Cadastre um imóvel de aluguel para gerar contratos.</div>`;
  if(!ui.tplPropId){ const first=imvProps().find(p=>!imvIsMoradia(p)); if(first){ui.tplPropId=first.id; ui.tplUnitId=first.units[0].id; imvPrefillTenant();} }
  const tplCards=Object.entries(IMV_TPL).map(([k,tp])=>`<div class="imv-tpl ${ui.tpl===k?'on':''}" data-imv-tpl="${k}"><div class="ti">${tp.icon}</div><h4>${tp.nome}</h4><p>${tp.desc}</p></div>`).join("");
  const unitOptions=[]; imvProps().filter(p=>!imvIsMoradia(p)).forEach(p=>p.units.forEach(u=>unitOptions.push(`<option value="${p.id}|${u.id}" ${ui.tplPropId===p.id&&ui.tplUnitId===u.id?'selected':''}>${imvE(p.nome)} — ${imvE(u.nome)}</option>`)));
  const T=ui.tenant,C=ui.contract,O=imvOwner();
  return `<div class="imv-head"><div><h1>Modelos de contrato</h1><p>Escolha o modelo, o imóvel e o inquilino. Seus dados de locador já vêm preenchidos. Gera formatado, pronto para imprimir/PDF.</p></div></div>
    <div class="imv-tplgrid">${tplCards}</div>
    <div class="imv-two" style="margin-top:16px">
      <div class="imv-panel"><h2>Dados do contrato</h2>
        <div class="imv-field"><label>Imóvel / unidade</label><select data-imv-tpl-unit>${unitOptions.join("")}</select></div>
        <div class="imv-divlabel">Inquilino (Locatário)</div>
        <div class="imv-field"><label>Nome completo</label><input data-imv-t="nome" value="${imvE(T.nome)}" placeholder="Nome do inquilino"></div>
        <div class="imv-f2"><div class="imv-field"><label>CPF/CNPJ</label><input data-imv-t="cpf" value="${imvE(T.cpf)}"></div><div class="imv-field"><label>R.G nº (com órgão)</label><input data-imv-t="rg" value="${imvE(T.rg)}"></div></div>
        <div class="imv-f3"><div class="imv-field"><label>Estado civil</label><input data-imv-t="estadoCivil" value="${imvE(T.estadoCivil)}" placeholder="solteiro(a)"></div><div class="imv-field"><label>Natural de</label><input data-imv-t="naturalidade" value="${imvE(T.naturalidade)}" placeholder="Cidade/UF"></div><div class="imv-field"><label>Gênero</label><select data-imv-t="sexo"><option value="m" ${T.sexo!=="f"?'selected':''}>Masc.</option><option value="f" ${T.sexo==="f"?'selected':''}>Fem.</option></select></div></div>
        <div class="imv-f2"><div class="imv-field"><label>Telefone</label><input data-imv-t="tel" value="${imvE(T.tel)}"></div><div class="imv-field"><label>E-mail</label><input data-imv-t="email" value="${imvE(T.email)}"></div></div>
        <div class="imv-field"><label>Endereço atual do inquilino</label><input data-imv-t="endereco" value="${imvE(T.endereco)}"></div>
        <div class="imv-divlabel">Termos</div>
        <div class="imv-f3"><div class="imv-field"><label>Início</label><input type="date" data-imv-c="inicio" value="${imvE(C.inicio)}"></div><div class="imv-field"><label>Prazo (meses)</label><input data-imv-c="meses" value="${C.meses}"></div><div class="imv-field"><label>Vencimento (dia)</label><input data-imv-c="diaVenc" value="${C.diaVenc}"></div></div>
        <div class="imv-f2"><div class="imv-field"><label>Testemunha — nome</label><input data-imv-c="testNome" value="${imvE(C.testNome)}"></div><div class="imv-field"><label>Testemunha — CPF</label><input data-imv-c="testCpf" value="${imvE(C.testCpf)}"></div></div>
        <div class="imv-divlabel">Proprietário (Locador)</div>
        <div class="imv-tip">${imvE(O.nome||"(defina seus dados)")} · CPF ${imvE(O.cpf||"—")} · ${imvGen(O.sexo,"Locadora","Locador")} <button class="imv-btn sm" data-imv-owner style="margin-left:6px">Editar meus dados</button></div>
        <div class="imv-row" style="margin-top:16px"><button class="imv-btn primary" data-imv-fill-tenant>Puxar inquilino</button><button class="imv-btn" data-imv-print>🖨 Imprimir / PDF</button></div>
      </div>
      <div><div class="imv-paper" id="imv-contract">${imvRenderContract()}</div></div>
    </div>`;
}
function imvRenderContract(){
  const ui=imvUI(); const sel=imvPickSel(); const T=ui.tenant,C=ui.contract,O=imvOwner();
  const hl=(v,ph)=>`<span class="imv-hl">${imvE(v||ph)}</span>`;
  const p=sel?.p,u=sel?.u; const aluguel=u?(u.aluguelReal||u.aluguelEsperado):0;
  const cidade=p?(p.cidade||"São Paulo/SP").split("/")[0].trim():"São Paulo"; const uf=p&&(p.cidade||"").includes("/")?p.cidade.split("/")[1].trim():"SP";
  const meses=C.meses||30; const {ini,fim}=imvContractDates(C.inicio,meses); const comercial=ui.tpl==="comercial",temporada=ui.tpl==="temporada";
  const titulo={residencial:"CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL",comercial:"CONTRATO DE LOCAÇÃO DE IMÓVEL COMERCIAL",temporada:"CONTRATO DE LOCAÇÃO POR TEMPORADA"}[ui.tpl];
  const destino=comercial?"seu uso comercial":temporada?"uso residencial por temporada, de sua família":"seu uso residencial e de sua família";
  const locador=`${hl(O.nome,"[Locador]")}, ${imvE(O.nacionalidade||"brasileiro(a)")}, ${imvE(O.estadoCivil||"—")}, ${imvE(O.profissao||"—")}, ${imvGen(O.sexo,"portadora","portador")} de cédula de R.G nº ${hl(O.rg,"[RG]")} e ${imvGen(O.sexo,"inscrita","inscrito")} no CPF sob o nº ${hl(O.cpf,"[CPF]")}`;
  const locatario=`${hl(T.nome,"[Locatário]")}, ${T.estadoCivil?imvE(T.estadoCivil)+", ":""}${T.naturalidade?"natural de "+imvE(T.naturalidade)+", ":""}${imvGen(T.sexo,"portadora","portador")} da cédula de R.G nº ${hl(T.rg,"[RG]")}, ${imvGen(T.sexo,"inscrita","inscrito")} no CPF sob o nº ${hl(T.cpf,"[CPF]")}`;
  return `<h3>${titulo}</h3>
  <p style="margin-top:16px"><b>Locador:</b> ${locador}.</p><p><b>Locatário:</b> ${locatario}.</p>
  <div class="imv-cl">Cláusula Primeira:</div><p>O objeto deste contrato de locação é o imóvel ${comercial?"comercial":"residencial"} situado à ${hl(p?p.endereco:"","[endereço do imóvel]")}${u&&p&&p.units.length>1?`, ${imvE(u.nome)}`:""}.</p>
  <div class="imv-cl">Cláusula Segunda:</div><p>O prazo da locação é de ${hl(meses+" ("+imvExtensoInt(meses)+") meses","")}, iniciando-se em ${hl(ini,"[início]")} com término em ${hl(fim,"[término]")}, independentemente de aviso, notificação ou interpelação judicial ou mesmo extrajudicial.</p><p><b>Parágrafo único:</b> No caso do LOCATÁRIO não se adaptar no imóvel, fica o MESMO isento de pagar multa contratual ao rescindir o contrato, tendo o mesmo que avisar com antecedência de 30 (trinta) dias, assim como deixar o imóvel nas mesmas condições recebidas.</p>
  <div class="imv-cl">Cláusula Terceira:</div><p>O aluguel mensal deverá ser pago até o dia ${hl(C.diaVenc+" ("+imvExtensoInt(C.diaVenc)+")","[dia]")} do mês subsequente ao vencido, no local indicado pelo LOCADOR, no valor de ${hl(aluguel?imvFmt2(aluguel):"","[valor]")} (${aluguel?imvValorExtenso(aluguel):"…"}) mensais, reajustados anualmente, de conformidade com a variação do IGP-M apurada no ano anterior, e na sua falta, por outro índice criado pelo Governo Federal e, ainda, em sua substituição, pela Fundação Getúlio Vargas.</p>
  <div class="imv-cl">Cláusula Quarta:</div><p>O LOCATÁRIO será responsável por todas as despesas provenientes de sua utilização, sejam elas ligação e consumo de luz, força e gás, pagas diretamente às concessionárias. As faturas de água e energia elétrica deverão ser transferidas para o nome do LOCATÁRIO.</p>
  <div class="imv-cl">Cláusula Quinta:</div><p>Em caso de mora no pagamento do aluguel, será aplicada multa de 2% (dois por cento) sobre o valor devido e juros mensais de 1% (um por cento) do montante devido.</p>
  <div class="imv-cl">Cláusula Sexta:</div><p>Fica ao LOCATÁRIO a responsabilidade em zelar pela conservação e limpeza do imóvel, efetuando as reformas necessárias para sua manutenção, por sua conta. O LOCATÁRIO devolverá o imóvel em perfeitas condições de limpeza, conservação e pintura ao fim da locação, e não poderá realizar obras que alterem a estrutura sem prévia autorização por escrito do LOCADOR; consentidas, incorporam-se ao imóvel sem indenização ou retenção por benfeitorias, salvo as removíveis que não o desfigurem.</p><p><b>Parágrafo único:</b> O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e funcionamento.</p>
  <div class="imv-cl">Cláusula Sétima:</div><p>O LOCATÁRIO declara que o imóvel destina-se única e exclusivamente para o ${destino}.</p>
  <div class="imv-cl">Cláusula Oitava:</div><p>O LOCATÁRIO não poderá sublocar, transferir ou ceder o imóvel, sendo nulo qualquer ato com este fim sem consentimento prévio e por escrito do LOCADOR.</p>
  <div class="imv-cl">Cláusula Nona:</div><p>Em caso de sinistro que impossibilite a habitação, o contrato estará rescindido, independentemente de aviso; no incêndio parcial que obrigue reconstrução, a vigência fica suspensa e a renda reduzida à metade no período, prorrogando-se o prazo pelo tempo das obras.</p>
  <div class="imv-cl">Cláusula Décima:</div><p>Em caso de desapropriação total ou parcial, o contrato fica rescindido de pleno direito, independente de indenizações entre as partes.</p>
  <div class="imv-cl">Cláusula Décima Primeira:</div><p>No caso de alienação do imóvel, o LOCADOR dará preferência ao LOCATÁRIO; não exercida, fará constar da escritura a existência deste contrato para que o adquirente o respeite.</p>
  <div class="imv-cl">Cláusula Décima Segunda:</div><p>É facultado ao LOCADOR vistoriar o imóvel, por si ou procuradores, sempre que conveniente, para certeza do cumprimento das obrigações.</p>
  <div class="imv-cl">Cláusula Décima Terceira:</div><p>A infração de qualquer cláusula sujeita o infrator à multa de duas vezes o valor do aluguel, com base no último vencido.</p>
  <div class="imv-cl">Cláusula Décima Quarta:</div><p>As partes obrigam-se por si, herdeiros e sucessores, elegendo o foro da comarca de ${hl(cidade,"[comarca]")}/${imvE(uf)} para qualquer ação.</p>
  <p style="margin-top:16px">E, por estarem justos e contratados, mandaram extrair o presente em 03 (três) vias, assinando-as com a testemunha.</p>
  <p style="text-align:right;margin-top:18px">${cidade}/${uf}, ${imvDataExtenso(new Date())}.</p>
  <div class="imv-sign"><div><div class="ln">${imvE(O.nome)}<br><span>LOCADOR — CPF ${imvE(O.cpf)}</span></div></div><div><div class="ln">${imvE(T.nome||"Locatário")}<br><span>LOCATÁRIO${T.cpf?" — CPF "+imvE(T.cpf):""}</span></div></div></div>
  <div class="imv-sign" style="grid-template-columns:1fr;margin-top:30px"><div><div class="ln">${imvE(C.testNome||"")}<br><span>TESTEMUNHA${C.testCpf?" — CPF "+imvE(C.testCpf):""}</span></div></div></div>`;
}
function imvRefreshContract(){ const el=document.getElementById("imv-contract"); if(el)el.innerHTML=imvRenderContract(); }
function imvPrintContract(){ const html=imvRenderContract();
  const w=window.open("","_blank","width=820,height=940"); if(!w){alert("Permita pop-ups para imprimir o contrato.");return;}
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato de locação</title><style>body{font-family:Georgia,'Times New Roman',serif;color:#111;max-width:720px;margin:40px auto;padding:0 26px;line-height:1.65}h3{text-align:center;font-size:18px;text-decoration:underline;margin-bottom:18px}.imv-cl{font-weight:bold;margin:16px 0 4px}.imv-hl{background:transparent}p{text-align:justify;margin:0 0 10px;font-size:14px}.imv-sign{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:44px;text-align:center;font-size:13px}.imv-sign .ln{border-top:1px solid #111;padding-top:6px;margin-top:40px}.imv-sign span{font-size:11px;color:#555}</style></head><body>${html}</body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>{try{w.print();}catch(e){}},350);
}

/* ---- ações de uso / encerrar ---- */
function imvToggleUso(p){ if(!p)return;
  if(imvIsMoradia(p)){ p.uso="aluguel"; p.units.forEach(u=>{u.status=u.inquilino?"alugado":"vago";}); }
  else { if(!confirm(`Marcar "${p.nome}" como moradia própria?\n\nSai dos cálculos de aluguel, rentabilidade e contratos (segue no patrimônio). As despesas são mantidas.`))return; p.uso="moradia"; p.units.forEach(u=>{u.status="proprio";}); }
  imvSave();
}
function imvEncerrar(u,fimISO){ if(!u.historico)u.historico=[]; if(u.inquilino)u.historico.unshift({...u.inquilino,fim:fimISO||imvCurYM(),aluguel:u.aluguelReal||u.inquilino.aluguel||0}); u.inquilino=null; u.status="vago"; u.aluguelReal=0; }

/* ---- modais ---- */
function imvOpenModal(html){ document.getElementById("imv-modal").innerHTML=`<div class="imv-modal-bg" data-imv-close-bg><div class="imv-modal">${html}</div></div>`; }
function imvCloseModal(){ document.getElementById("imv-modal").innerHTML=""; }
function imvModalLanc(prefill, propOverride){
  imvEnsureCategories();
  const ui=imvUI(); const p=propOverride || imvProps().find(x=>x.id===ui.propId); if(!p)return;
  const pf=prefill||{};
  let tipo = pf.tipo || "receita";
  const subOpts=(tp,sel)=>imvSubsFor(tp).map(s=>`<option ${s===sel?"selected":""}>${imvE(s)}</option>`).join("");
  const unitOpts=`<option value="">— imóvel todo —</option>`+p.units.map(u=>`<option value="${u.id}" ${pf.unitId===u.id?"selected":""}>${imvE(u.nome)}</option>`).join("");
  const cashAccts=accounts.filter(a=>!a.arquivada&&a.tipo!=="imovel"&&a.tipo!=="patrimonio");
  const contaOpts=cashAccts.map(a=>`<option ${a.nome===(pf.conta||imvDefaultCashAccount())?"selected":""}>${imvE(a.nome)}</option>`).join("");
  const today=new Date().toISOString().slice(0,10);
  const valInit=pf.valor?String(pf.valor).replace(".",","):"";
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>${pf.title||"Novo lançamento"}</h3>
    <div class="imv-seg" id="imv_ltipo"><button data-lt="receita" class="${tipo==="receita"?"on":""}">Receita</button><button data-lt="despesa" class="${tipo==="despesa"?"on":""}">Despesa</button></div>
    <div class="imv-f2"><div class="imv-field"><label>Data</label><input type="date" id="imv_ldata" value="${pf.iso||today}"></div><div class="imv-field"><label>Valor (R$)</label><input id="imv_lvalor" inputmode="decimal" placeholder="0,00" value="${valInit}"></div></div>
    <div class="imv-f2"><div class="imv-field"><label>Categoria</label><div class="imv-lockfield" title="Todo lançamento de um imóvel de renda entra nesta categoria"><span>${IMV_CAT}</span><span class="imv-lockfield-ic">🔒</span></div></div><div class="imv-field"><label>Subcategoria</label><select id="imv_lcat">${subOpts(tipo,pf.sub||pf.cat)}</select></div></div>
    <p class="imv-lockhint">A categoria já vem travada como <b>${IMV_CAT}</b> — todo lançamento deste imóvel cai aqui, pra somar custos e ganhos num lugar só. Você escolhe só a subcategoria.</p>
    <div class="imv-f2"><div class="imv-field"><label>Conta (dinheiro)</label><select id="imv_lconta">${contaOpts||`<option>Conta Corrente</option>`}</select></div><div class="imv-field"><label>Unidade</label><select id="imv_lunit">${unitOpts}</select></div></div>
    <div class="imv-field"><label>Descrição</label><input id="imv_ldesc" placeholder="Ex.: Aluguel do mês" value="${attr(pf.desc||"")}"></div>
    <div class="imv-modal-foot"><button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn primary" id="imv_lsave">Lançar</button></div>`);
  document.getElementById("imv_ltipo").onclick=e=>{const b=e.target.closest("[data-lt]");if(!b)return;tipo=b.dataset.lt;document.querySelectorAll("#imv_ltipo button").forEach(x=>x.classList.toggle("on",x===b));document.getElementById("imv_lcat").innerHTML=subOpts(tipo,"");};
  document.getElementById("imv_lsave").onclick=()=>{ const valor=imvParseVal(document.getElementById("imv_lvalor").value); if(!valor){alert("Informe um valor.");return;}
    const data=document.getElementById("imv_ldata").value||today; const sub=document.getElementById("imv_lcat").value;
    const uid=document.getElementById("imv_lunit").value; const conta=document.getElementById("imv_lconta").value;
    imvAddTx(p,{iso:data,tipo,cat:IMV_CAT,sub,conta,unidadeId:uid||"",desc:document.getElementById("imv_ldesc").value||sub,valor});
    imvCloseModal(); imvSave(); };
}
function imvModalUnit(unitId){
  const ui=imvUI(); const p=imvProps().find(x=>x.id===ui.propId)||imvProps().find(x=>x.id===(ui.unitDetail&&ui.unitDetail.propId));
  const u=p.units.find(x=>x.id===unitId); const inq=u.inquilino||{}; const moradia=imvIsMoradia(p);
  const tenantBlock = moradia ? "" : `
    <div class="imv-f2"><div class="imv-field"><label>Aluguel esperado</label><input id="imv_uesp" value="${u.aluguelEsperado||''}"></div><div class="imv-field"><label>Aluguel real</label><input id="imv_ureal" value="${u.aluguelReal||''}" placeholder="vago = 0"></div></div>
    <div class="imv-divlabel">Inquilino</div>
    <div class="imv-field"><label>Nome</label><input id="imv_unome" value="${imvE(inq.nome||'')}" placeholder="vazio = unidade vaga"></div>
    <div class="imv-f2"><div class="imv-field"><label>CPF/CNPJ</label><input id="imv_ucpf" value="${imvE(inq.cpf||'')}"></div><div class="imv-field"><label>R.G nº</label><input id="imv_urg" value="${imvE(inq.rg||'')}"></div></div>
    <div class="imv-f3"><div class="imv-field"><label>Estado civil</label><input id="imv_uec" value="${imvE(inq.estadoCivil||'')}"></div><div class="imv-field"><label>Natural de</label><input id="imv_unat" value="${imvE(inq.naturalidade||'')}"></div><div class="imv-field"><label>Gênero</label><select id="imv_usexo"><option value="m" ${inq.sexo!=="f"?'selected':''}>Masc.</option><option value="f" ${inq.sexo==="f"?'selected':''}>Fem.</option></select></div></div>
    <div class="imv-f2"><div class="imv-field"><label>Telefone</label><input id="imv_utel" value="${imvE(inq.tel||'')}"></div><div class="imv-field"><label>E-mail</label><input id="imv_uemail" value="${imvE(inq.email||'')}"></div></div>
    <div class="imv-f3"><div class="imv-field"><label>Início</label><input type="date" id="imv_uini" value="${inq.inicio||''}"></div><div class="imv-field"><label>Prazo (meses)</label><input id="imv_umeses" value="${inq.meses||30}"></div><div class="imv-field"><label>Vencimento (dia)</label><input id="imv_udv" value="${inq.diaVenc||10}"></div></div>`;
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>Editar unidade</h3>
    <div class="imv-f3"><div class="imv-field"><label>Nome da unidade</label><input id="imv_unm" value="${imvE(u.nome)}"></div><div class="imv-field"><label>Área</label><input id="imv_uarea" value="${imvE(u.area&&u.area!=='—'?u.area:'')}" placeholder="ex.: 60 m²"></div><div class="imv-field"><label>Dormitórios</label><input id="imv_uq" value="${u.quartos||''}"></div></div>
    <div class="imv-field"><label>Ícone da unidade</label><div class="imv-iconpick" id="imv_uiconpick">${["","🔑","🏠","🏢","🏬","🏪","🛏️","🚪","🚗","🏨","🏚️","🌳"].map(ico=>`<button type="button" class="imv-icb ${(u.icon||'')===ico?'on':''}" data-icon="${ico}">${ico||'Auto'}</button>`).join("")}</div><input type="hidden" id="imv_uicon" value="${imvE(u.icon||'')}"></div>
    ${tenantBlock}
    <div class="imv-modal-foot"><button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn primary" id="imv_usave">Salvar</button></div>`);
  document.getElementById("imv_uiconpick").onclick=(ev)=>{ const b=ev.target.closest("[data-icon]"); if(!b)return; document.getElementById("imv_uicon").value=b.dataset.icon; document.querySelectorAll("#imv_uiconpick .imv-icb").forEach(x=>x.classList.toggle("on",x===b)); };
  document.getElementById("imv_usave").onclick=()=>{ const g=id=>document.getElementById(id).value;
    u.nome=g("imv_unm").trim()||u.nome; u.area=g("imv_uarea").trim()||"—"; u.quartos=parseInt(g("imv_uq"))||0; u.icon=g("imv_uicon")||"";
    if(!moradia){
      u.aluguelEsperado=imvParseVal(g("imv_uesp"))||u.aluguelEsperado||0; u.aluguelReal=imvParseVal(g("imv_ureal")); const nome=g("imv_unome").trim();
      if(nome){ u.status="alugado"; u.inquilino={...(u.inquilino||{}),nome,cpf:g("imv_ucpf"),rg:g("imv_urg"),estadoCivil:g("imv_uec"),naturalidade:g("imv_unat"),sexo:g("imv_usexo"),tel:g("imv_utel"),email:g("imv_uemail"),inicio:g("imv_uini")||inq.inicio||new Date().toISOString().slice(0,10),meses:parseInt(g("imv_umeses"))||inq.meses||30,diaVenc:Math.min(28,Math.max(1,parseInt(g("imv_udv"))||10)),deposito:inq.deposito||u.aluguelReal*3,obs:(u.inquilino&&u.inquilino.obs)||"",docs:(u.inquilino&&u.inquilino.docs)||[]}; }
      else if(inq.nome){ imvEncerrar(u,new Date().toISOString().slice(0,10)); }
      else { u.status="vago"; u.inquilino=null; u.aluguelReal=0; }
    }
    imvCloseModal(); imvSave(); };
}
function imvModalEncerrar(unitId){ const ui=imvUI(); const p=imvProps().find(x=>x.id===(ui.unitDetail?ui.unitDetail.propId:ui.propId)); const u=p.units.find(x=>x.id===unitId); const today=new Date().toISOString().slice(0,10);
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>Encerrar locação</h3><div class="imv-tip" style="margin-bottom:14px">${imvE(u.inquilino?u.inquilino.nome:'—')} vai para o <b>histórico</b> desta unidade (com documentos e observações). A unidade fica vaga.</div><div class="imv-field"><label>Data de saída</label><input type="date" id="imv_efim" value="${today}"></div><div class="imv-modal-foot"><button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn danger" id="imv_esave">Encerrar e arquivar</button></div>`);
  document.getElementById("imv_esave").onclick=()=>{ imvEncerrar(u,document.getElementById("imv_efim").value||today); imvCloseModal(); imvSave(); };
}
/* ---- editar/adicionar/excluir entrada do histórico de inquilinos ---- */
function imvModalHistEdit(propId, unitId, idx){
  const p=imvProps().find(x=>x.id===propId); const u=p&&p.units.find(x=>x.id===unitId); if(!u)return;
  if(!u.historico) u.historico=[];
  const isNew = idx==null || idx<0;
  const h = isNew ? {nome:"",cpf:"",rg:"",tel:"",email:"",estadoCivil:"",naturalidade:"",sexo:"m",inicio:"",fim:"",aluguel:0,obs:"",docs:[]} : u.historico[idx];
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>${isNew?"Adicionar ao histórico":"Editar inquilino do histórico"}</h3>
    <div class="imv-field"><label>Nome</label><input id="imv_he_nome" value="${imvE(h.nome||'')}"></div>
    <div class="imv-f2"><div class="imv-field"><label>CPF/CNPJ</label><input id="imv_he_cpf" value="${imvE(h.cpf||'')}"></div><div class="imv-field"><label>R.G</label><input id="imv_he_rg" value="${imvE(h.rg||'')}"></div></div>
    <div class="imv-f3"><div class="imv-field"><label>Estado civil</label><input id="imv_he_ec" value="${imvE(h.estadoCivil||'')}"></div><div class="imv-field"><label>Natural de</label><input id="imv_he_nat" value="${imvE(h.naturalidade||'')}"></div><div class="imv-field"><label>Gênero</label><select id="imv_he_sexo"><option value="m" ${h.sexo!=="f"?"selected":""}>Masc.</option><option value="f" ${h.sexo==="f"?"selected":""}>Fem.</option></select></div></div>
    <div class="imv-f2"><div class="imv-field"><label>Telefone</label><input id="imv_he_tel" value="${imvE(h.tel||'')}"></div><div class="imv-field"><label>E-mail</label><input id="imv_he_email" value="${imvE(h.email||'')}"></div></div>
    <div class="imv-f3"><div class="imv-field"><label>Início</label><input type="date" id="imv_he_ini" value="${h.inicio||''}"></div><div class="imv-field"><label>Fim</label><input type="date" id="imv_he_fim" value="${h.fim||''}"></div><div class="imv-field"><label>Aluguel (R$)</label><input id="imv_he_al" value="${h.aluguel||''}"></div></div>
    <div class="imv-field"><label>Observações</label><textarea class="imv-obs" id="imv_he_obs">${imvE(h.obs||'')}</textarea></div>
    <div class="imv-modal-foot">${isNew?"":`<button class="imv-btn danger" data-imv-hist-del-modal="${idx}">Excluir</button>`}<button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn primary" id="imv_he_save">Salvar</button></div>`);
  document.getElementById("imv_he_save").onclick=()=>{ const g=id=>document.getElementById(id).value;
    const rec={...h, nome:g("imv_he_nome").trim(), cpf:g("imv_he_cpf"), rg:g("imv_he_rg"), estadoCivil:g("imv_he_ec"), naturalidade:g("imv_he_nat"), sexo:g("imv_he_sexo"), tel:g("imv_he_tel"), email:g("imv_he_email"), inicio:g("imv_he_ini"), fim:g("imv_he_fim"), aluguel:imvParseVal(g("imv_he_al")), obs:g("imv_he_obs"), docs:h.docs||[]};
    if(!rec.nome){alert("Informe o nome do inquilino.");return;}
    if(isNew) u.historico.unshift(rec); else u.historico[idx]=rec;
    imvCloseModal(); imvSave(); };
}
/* ---- gestão de unidades (adicionar/renomear/juntar/separar/excluir) ---- */
function imvMakeUnit(nome,status){ return {id:"u"+Date.now()+"_"+(_imvTxSeq++),nome:nome||"Unidade",area:"—",quartos:1,aluguelEsperado:0,aluguelReal:0,status:status||"vago",inquilino:null,historico:[],docs:[]}; }
function imvUnitAdd(p){ p.units.push(imvMakeUnit("Unidade "+(p.units.length+1),"vago")); scheduleSave(); }
function imvUnitDel(p,uid){
  if(p.units.length<=1){ alert("O imóvel precisa ter ao menos uma unidade."); return false; }
  const u=p.units.find(x=>x.id===uid); if(!u)return false;
  const hasTx=state.tx.some(t=>t.imovelId===p.id && t.unidadeId===uid);
  const msg = (u.inquilino||hasTx)
    ? `Excluir a unidade "${u.nome}"?\n\nO inquilino atual e os lançamentos dela deixam de ficar vinculados a uma unidade (continuam no imóvel).`
    : `Excluir a unidade "${u.nome}"?`;
  if(!confirm(msg)) return false;
  state.tx.forEach(t=>{ if(t.imovelId===p.id && t.unidadeId===uid) delete t.unidadeId; });
  p.units=p.units.filter(x=>x.id!==uid); scheduleSave(); return true;
}
function imvUnitMerge(p,ids){
  const us=p.units.filter(x=>ids.includes(x.id)); if(us.length<2){alert("Marque pelo menos 2 unidades para juntar.");return false;}
  if(!confirm(`Juntar ${us.length} unidades em uma só? Aluguéis somam e os lançamentos das unidades são remapeados para a nova.`)) return false;
  const occ=us.find(x=>x.status==="alugado");
  const merged=imvMakeUnit(us.map(x=>x.nome).join(" + "),"vago");
  merged.area=us.map(x=>x.area).filter(a=>a&&a!=="—").join(" + ")||"—";
  merged.quartos=us.reduce((s,x)=>s+(x.quartos||0),0);
  merged.aluguelEsperado=us.reduce((s,x)=>s+(x.aluguelEsperado||0),0);
  if(occ){ merged.status="alugado"; merged.inquilino=occ.inquilino; merged.aluguelReal=us.reduce((s,x)=>s+(x.status==="alugado"?(x.aluguelReal||0):0),0); }
  merged.historico=us.flatMap(x=>x.historico||[]); merged.docs=us.flatMap(x=>x.docs||[]);
  state.tx.forEach(t=>{ if(t.imovelId===p.id && ids.includes(t.unidadeId)) t.unidadeId=merged.id; });
  const firstIdx=p.units.findIndex(x=>ids.includes(x.id));
  p.units=p.units.filter(x=>!ids.includes(x.id));
  p.units.splice(firstIdx,0,merged); scheduleSave(); return true;
}
function imvUnitSplit(p,uid,n){
  n=Math.max(2,parseInt(n)||2);
  const idx=p.units.findIndex(x=>x.id===uid); const u=p.units[idx]; if(!u)return false;
  const base=u.nome; u.nome=base+" (1)";
  const espEach=Math.round((u.aluguelEsperado||0)/n); u.aluguelEsperado=espEach;
  const novos=[]; for(let i=2;i<=n;i++){ const nu=imvMakeUnit(base+" ("+i+")","vago"); nu.aluguelEsperado=espEach; novos.push(nu); }
  p.units.splice(idx+1,0,...novos); // as transações da original ficam na (1) — mesmo id, nada a remapear
  scheduleSave(); return true;
}
function imvModalUnits(propId){
  const p=imvProps().find(x=>x.id===propId); if(!p)return;
  const rows=p.units.map(u=>{ const occ=u.status==="alugado";
    return `<div class="imv-un-row">
      <input type="checkbox" data-imv-un-sel="${u.id}" title="Selecionar para juntar">
      <input class="imv-un-nome" data-imv-un-f="nome" data-uid="${u.id}" value="${imvE(u.nome)}">
      <input class="imv-un-area" data-imv-un-f="area" data-uid="${u.id}" value="${imvE(u.area||"")}" placeholder="área">
      <span class="imv-un-st ${occ?'occ':''}">${occ?imvE(u.inquilino.nome):(u.status==="proprio"?"próprio":"vago")}</span>
      <button class="imv-btn sm" data-imv-un-split="${u.id}">Separar</button>
      <button class="imv-btn sm danger" data-imv-un-del="${u.id}">Excluir</button>
    </div>`;
  }).join("");
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>Gerenciar unidades — ${imvE(p.nome)}</h3>
    <p class="imv-phint">Renomeie direto no campo. Marque 2+ e "Juntar", ou "Separar" uma em várias. Inquilinos e lançamentos de cada unidade são preservados/remapeados.</p>
    <div class="imv-un-list">${rows}</div>
    <div class="imv-row" style="margin-top:12px"><button class="imv-btn" data-imv-un-add="${p.id}">＋ Adicionar unidade</button><button class="imv-btn" data-imv-un-merge="${p.id}">⛓ Juntar selecionadas</button></div>
    <div class="imv-modal-foot"><button class="imv-btn primary" data-imv-un-done>Concluir</button></div>`);
}
function imvModalProp(propId){ const isNew=!propId; const p=isNew?{nome:"",tipo:"Apartamento",cidade:"",endereco:"",uso:"aluguel"}:imvProps().find(x=>x.id===propId); const uso=p.uso||"aluguel";
  const vmCur=isNew?"":imvValorMercado(p), vcCur=isNew?"":imvValorCompra(p);
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>${isNew?'Novo imóvel':'Editar imóvel'}</h3>
    <div class="imv-field"><label>Nome</label><input id="imv_pnome" value="${imvE(p.nome)}" placeholder="Ex.: Apartamento Centro"></div>
    <div class="imv-f2"><div class="imv-field"><label>Tipo</label><select id="imv_ptipo">${["Apartamento","Sobrado","Casa","Kitnet","Comercial","Terreno"].map(t=>`<option ${p.tipo===t?'selected':''}>${t}</option>`).join("")}</select></div><div class="imv-field"><label>Uso</label><select id="imv_puso"><option value="aluguel" ${uso==="aluguel"?'selected':''}>Para alugar</option><option value="moradia" ${uso==="moradia"?'selected':''}>Moradia própria</option></select></div></div>
    <div class="imv-field"><label>Cidade/UF</label><input id="imv_pcidade" value="${imvE(p.cidade||'')}" placeholder="Cidade/UF"></div>
    ${isNew?`<div class="imv-field"><label>Nº de unidades <span class="lbl-hint">· ex.: sobrado alugado a 2 famílias = 2 (dá pra ajustar depois)</span></label><input id="imv_pnu" value="1" inputmode="numeric"></div>`:""}
    <div class="imv-field"><label>Endereço completo</label><input id="imv_pend" value="${imvE(p.endereco||'')}"></div>
    <div class="imv-f2"><div class="imv-field"><label>Valor de mercado (R$)</label><input id="imv_pvm" value="${vmCur||''}"></div><div class="imv-field"><label>Valor de compra (R$)</label><input id="imv_pvc" value="${vcCur||''}"></div></div>
    <div class="imv-tip">Cada imóvel vira uma <b>conta</b> (tipo Imóvel): aparece em Contas e os aluguéis/despesas viram transações reais.</div>
    <div class="imv-modal-foot"><button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn primary" id="imv_psave">Salvar</button></div>`);
  document.getElementById("imv_psave").onclick=()=>{ const g=id=>document.getElementById(id).value; const nome=g("imv_pnome").trim(); if(!nome){alert("Dê um nome ao imóvel.");return;}
    const vm=imvParseVal(g("imv_pvm")),vc=imvParseVal(g("imv_pvc")),usoV=g("imv_puso");
    const collide=(nm,exceptId)=>accounts.some(a=>a.nome===nm && a.id!==exceptId);
    if(isNew){ if(collide(nome)){alert("Já existe uma conta com esse nome.");return;}
      const acc={id:"imv"+Date.now()+"_"+(_imvTxSeq++),nome,sub:"Imóvel de renda",tipo:"imovel",saldo:vm,alocado:(vc||vm),custo:0,grupo:"pat",arquivada:false,ordem:accounts.length};
      accounts.push(acc); reindexAccounts();
      let units;
      if(usoV==="moradia"){ units=[imvMakeUnit("Cobertura","proprio")]; }
      else { const n=Math.max(1,parseInt(g("imv_pnu"))||1); units = n===1 ? [imvMakeUnit("Unidade única","vago")] : Array.from({length:n},(_,i)=>imvMakeUnit("Unidade "+(i+1),"vago")); }
      const id="p"+Date.now(); imvProps().push({id,accountId:acc.id,nome,tipo:g("imv_ptipo"),cidade:g("imv_pcidade"),uso:usoV,endereco:g("imv_pend"),units});
      imvUI().propId=id; imvUI().sub="portfolio";
    } else { const a=imvAcct(p);
      if(a && a.nome!==nome){ if(collide(nome,a.id)){alert("Já existe uma conta com esse nome.");return;} const old=a.nome; a.nome=nome; state.tx.forEach(t=>{if(t.conta===old)t.conta=nome; if(t.origem===old)t.origem=nome; if(t.destino===old)t.destino=nome;}); }
      if(a){ a.saldo=vm; a.alocado=(vc||vm); }
      p.nome=nome; p.tipo=g("imv_ptipo"); p.cidade=g("imv_pcidade"); p.uso=usoV; p.endereco=g("imv_pend");
    }
    refreshSideNet(); imvCloseModal(); imvSave(); };
}
function imvModalRateio(){
  const props=imvProps(); if(props.length<2){alert("Cadastre ao menos 2 imóveis.");return;}
  const cats=["Administração","Zeladoria","Manutenção","Seguro","Impostos","Água/Luz","Contabilidade","Outros"];
  const today=new Date().toISOString().slice(0,10);
  const rows=props.map(p=>`<label class="imv-rt-row"><input type="checkbox" data-rt-check="${p.id}" checked><span class="imv-rt-nm">${imvE(p.nome)}${imvIsMoradia(p)?' <span style="color:var(--subtle);font-size:11px">(moradia)</span>':''}</span><input class="imv-rt-amt" data-rt-amt="${p.id}" inputmode="decimal" placeholder="0,00"></label>`).join("");
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>Custo compartilhado entre imóveis</h3>
    <p class="imv-phint">Ex.: salário de um zelador/funcionário que atende vários imóveis. Cria uma <b>despesa</b> em cada imóvel selecionado, com o valor rateado.</p>
    <div class="imv-field"><label>Descrição</label><input id="imv_rtdesc" placeholder="Ex.: Salário do zelador"></div>
    <div class="imv-f2"><div class="imv-field"><label>Categoria</label><select id="imv_rtcat">${cats.map(c=>`<option>${c}</option>`).join("")}</select></div><div class="imv-field"><label>Data</label><input type="date" id="imv_rtdata" value="${today}"></div></div>
    <div class="imv-f2"><div class="imv-field"><label>Valor total (R$)</label><input id="imv_rttotal" inputmode="decimal" placeholder="0,00"></div><div class="imv-field" style="display:flex;align-items:flex-end"><button class="imv-btn" id="imv_rtsplit" type="button" style="width:100%">Dividir igualmente</button></div></div>
    <div class="imv-divlabel">Imóveis e valor de cada um</div>
    <div class="imv-rt-list">${rows}</div>
    <div class="imv-rt-sum" id="imv_rtsum"></div>
    <div class="imv-modal-foot"><button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn primary" id="imv_rtsave">Lançar em cada imóvel</button></div>`);
  const amtEl=id=>document.querySelector(`[data-rt-amt="${id}"]`);
  const chkEl=id=>document.querySelector(`[data-rt-check="${id}"]`);
  const updSum=()=>{ let s=0; props.forEach(p=>{ s+=imvParseVal(amtEl(p.id).value); }); const el=document.getElementById("imv_rtsum"); if(el)el.textContent="Soma lançada: "+imvFmt2(s); };
  document.getElementById("imv_rtsplit").onclick=()=>{ const tot=imvParseVal(document.getElementById("imv_rttotal").value); const ck=props.filter(p=>chkEl(p.id).checked); if(!tot||!ck.length){alert("Informe o valor total e marque ao menos um imóvel.");return;}
    const base=Math.floor(tot/ck.length*100)/100; let acc=0;
    ck.forEach((p,i)=>{ const v=i===ck.length-1?Math.round((tot-acc)*100)/100:base; acc=Math.round((acc+base)*100)/100; amtEl(p.id).value=String(v).replace(".",","); });
    props.forEach(p=>{ if(!chkEl(p.id).checked) amtEl(p.id).value=""; }); updSum(); };
  const list=document.querySelector(".imv-rt-list"); list.addEventListener("input",updSum); list.addEventListener("change",updSum); updSum();
  document.getElementById("imv_rtsave").onclick=()=>{ const desc=document.getElementById("imv_rtdesc").value.trim(); const cat=document.getElementById("imv_rtcat").value; const data=document.getElementById("imv_rtdata").value||today; let n=0;
    props.forEach(p=>{ const v=imvParseVal(amtEl(p.id).value); if(chkEl(p.id).checked&&v>0){ imvAddTx(p,{iso:data,tipo:"despesa",cat,sub:"",desc:desc||cat,valor:v}); n++; } });
    if(!n){alert("Marque ao menos um imóvel com valor maior que zero.");return;}
    imvCloseModal(); imvSave(); };
}
function imvModalOwner(){ const O=imvOwner();
  imvOpenModal(`<button class="imv-x big" data-imv-close>×</button><h3>Meus dados (Locador)</h3><p class="imv-phint">Usados na qualificação do locador nos contratos.</p>
    <div class="imv-field"><label>Nome completo</label><input id="imv_onome" value="${imvE(O.nome)}"></div>
    <div class="imv-f3"><div class="imv-field"><label>Nacionalidade</label><input id="imv_onac" value="${imvE(O.nacionalidade)}"></div><div class="imv-field"><label>Estado civil</label><input id="imv_oec" value="${imvE(O.estadoCivil)}"></div><div class="imv-field"><label>Profissão</label><input id="imv_oprof" value="${imvE(O.profissao)}"></div></div>
    <div class="imv-f2"><div class="imv-field"><label>Gênero</label><select id="imv_osexo"><option value="m" ${O.sexo!=="f"?'selected':''}>Masculino (Locador)</option><option value="f" ${O.sexo==="f"?'selected':''}>Feminino (Locadora)</option></select></div><div class="imv-field"><label>CPF</label><input id="imv_ocpf" value="${imvE(O.cpf)}"></div></div>
    <div class="imv-field"><label>R.G nº (com órgão)</label><input id="imv_org" value="${imvE(O.rg)}"></div>
    <div class="imv-field"><label>Endereço completo</label><input id="imv_oend" value="${imvE(O.endereco)}"></div>
    <div class="imv-modal-foot"><button class="imv-btn" data-imv-close>Cancelar</button><button class="imv-btn primary" id="imv_osave">Salvar</button></div>`);
  document.getElementById("imv_osave").onclick=()=>{ const g=id=>document.getElementById(id).value; const d=imvData(); d.owner={...O,nome:g("imv_onome"),nacionalidade:g("imv_onac"),estadoCivil:g("imv_oec"),profissao:g("imv_oprof"),sexo:g("imv_osexo"),cpf:g("imv_ocpf"),rg:g("imv_org"),endereco:g("imv_oend")}; imvCloseModal(); imvSave(); };
}

/* ---- dados de exemplo ---- */
function imvLoadSample(){ const d=imvData(); const M=imvLastMonths(18); const rnd=(v,p)=>Math.round(v*(1+(Math.random()-.5)*2*p));
  const mkL=(pid,units,tipoP,vm)=>{ const L=[]; let s=0; M.forEach(ym=>{ const mm=ym.slice(5);
    units.forEach(u=>{ if(u.status==="alugado"&&u.aluguelReal){ L.push({id:pid+"r"+(s++),ym,data:ym+"-05",tipo:"receita",categoria:"Aluguel",unitId:u.id,desc:u.nome+" — aluguel",valor:rnd(u.aluguelReal,.01)});
      if(mm==="01") L.push({id:pid+"rj"+(s++),ym,data:ym+"-05",tipo:"receita",categoria:"Reajuste",unitId:u.id,desc:u.nome+" — reajuste IGP-M",valor:Math.round(u.aluguelReal*0.04)});
      if(Math.random()<.06) L.push({id:pid+"mj"+(s++),ym,data:ym+"-18",tipo:"receita",categoria:"Multa/Juros",unitId:u.id,desc:u.nome+" — multa por atraso",valor:rnd(120,.4)}); } });
    if(tipoP==="Apartamento"||tipoP==="Kitnet"||tipoP==="Studio") L.push({id:pid+"c"+(s++),ym,data:ym+"-10",tipo:"despesa",categoria:"Condomínio",unitId:null,desc:"Condomínio",valor:tipoP==="Kitnet"?520:(tipoP==="Studio"?680:890)});
    const rec=units.filter(u=>u.status==="alugado").reduce((a,u)=>a+(u.aluguelReal||0),0); if(rec)L.push({id:pid+"a"+(s++),ym,data:ym+"-12",tipo:"despesa",categoria:"Administração",unitId:null,desc:"Taxa imobiliária (8%)",valor:Math.round(rec*.08)});
    if(mm==="01")L.push({id:pid+"i"+(s++),ym,data:ym+"-20",tipo:"despesa",categoria:"IPTU",unitId:null,desc:"IPTU (1ª parcela)",valor:Math.round(vm*.006/10)});
    if(mm==="03")L.push({id:pid+"sg"+(s++),ym,data:ym+"-15",tipo:"despesa",categoria:"Seguro",unitId:null,desc:"Seguro anual do imóvel",valor:Math.round(vm*0.0008)});
    if(Math.random()<.20)L.push({id:pid+"m"+(s++),ym,data:ym+"-14",tipo:"despesa",categoria:"Manutenção",unitId:null,desc:["Reparo hidráulico","Pintura","Elétrica","Troca de fechadura","Dedetização"][Math.floor(Math.random()*5)],valor:rnd(600,.5)});
    if(Math.random()<.10)L.push({id:pid+"rp"+(s++),ym,data:ym+"-22",tipo:"despesa",categoria:"Reparos",unitId:null,desc:["Reforma banheiro","Troca de piso","Vazamento"][Math.floor(Math.random()*3)],valor:rnd(1500,.6)});
  }); return L; };
  const p1={id:"p1",nome:"Sobrado Vila Mariana",tipo:"Sobrado",cidade:"São Paulo/SP",uso:"aluguel",endereco:"Rua Domingos de Morais, 845 — Vila Mariana, São Paulo/SP",valorMercado:920000,valorCompra:640000,units:[
    {id:"u1",nome:"Térreo",area:"78 m²",quartos:2,aluguelEsperado:2800,aluguelReal:2800,status:"alugado",inquilino:{nome:"Marina Costa Alves",cpf:"321.654.987-11",rg:"33.222.111-0 SSP/SP",tel:"(11) 98888-1122",email:"marina@email.com",estadoCivil:"solteira",naturalidade:"São Paulo/SP",sexo:"f",inicio:"2024-03-01",meses:30,diaVenc:5,deposito:8400,obs:"",docs:[]},historico:[],docs:[]},
    {id:"u2",nome:"Superior",area:"92 m²",quartos:3,aluguelEsperado:3400,aluguelReal:3200,status:"alugado",inquilino:{nome:"Rafael Menezes Lima",cpf:"456.789.123-22",rg:"44.333.222-1 SSP/SP",tel:"(11) 97777-3344",email:"rafael@email.com",estadoCivil:"casado",naturalidade:"Santos/SP",sexo:"m",inicio:"2023-11-01",meses:30,diaVenc:10,deposito:9600,obs:"",docs:[]},historico:[{nome:"Juliana Prado",cpf:"555.666.777-88",tel:"(11) 90000-2222",email:"",estadoCivil:"solteira",naturalidade:"Campinas/SP",sexo:"f",inicio:"2020-01-15",fim:"2023-10-31",aluguel:2500,obs:"Boa inquilina, saiu no fim do prazo.",docs:[]}],docs:[]}]};
  const p2={id:"p2",nome:"Apartamento Pinheiros",tipo:"Apartamento",cidade:"São Paulo/SP",uso:"aluguel",endereco:"Rua dos Pinheiros, 1520, apto 92 — Pinheiros, São Paulo/SP",valorMercado:685000,valorCompra:520000,units:[
    {id:"u3",nome:"Unidade única",area:"64 m²",quartos:2,aluguelEsperado:3600,aluguelReal:3600,status:"alugado",inquilino:{nome:"Beatriz Fonseca",cpf:"789.123.456-33",rg:"55.444.333-2 SSP/SP",tel:"(11) 96666-5566",email:"bia@email.com",estadoCivil:"solteira",naturalidade:"São Paulo/SP",sexo:"f",inicio:"2024-08-01",meses:30,diaVenc:15,deposito:10800,obs:"Ótima pagadora. Tem um gato (autorizado).",docs:[]},historico:[],docs:[]}]};
  const p3={id:"p3",nome:"Kitnet Centro",tipo:"Kitnet",cidade:"São Paulo/SP",uso:"aluguel",endereco:"Av. São João, 430, apto 78 — Centro, São Paulo/SP",valorMercado:245000,valorCompra:180000,units:[
    {id:"u4",nome:"Unidade única",area:"28 m²",quartos:1,aluguelEsperado:1600,aluguelReal:0,status:"vago",inquilino:null,historico:[],docs:[]}]};
  const p5={id:"p5",nome:"Apartamento Perdizes",tipo:"Apartamento",cidade:"São Paulo/SP",uso:"moradia",endereco:"Rua Cardoso de Almeida, 970, apto 121 — Perdizes, São Paulo/SP",valorMercado:820000,valorCompra:590000,units:[
    {id:"u6",nome:"Cobertura",area:"110 m²",quartos:3,aluguelEsperado:0,aluguelReal:0,status:"proprio",inquilino:null,historico:[],docs:[]}]};
  const props=[p1,p2,p3,p5];
  props.forEach(p=>{ p._lanc=mkL(p.id,p.units,p.tipo,p.valorMercado); });
  const cur=imvCurYM(); p1._lanc=p1._lanc.filter(l=>!(l.unitId==="u2"&&l.ym===cur&&l.categoria==="Aluguel")); // deixa 1 aluguel do mês em aberto
  // conta de dinheiro que recebe/paga os aluguéis e despesas
  let cash=accounts.find(a=>!a.arquivada&&a.nome==="Conta Aluguéis");
  if(!cash){ cash={id:"imvcash_"+Date.now(),nome:"Conta Aluguéis",sub:"Recebimentos de aluguel",tipo:"banco",saldo:0,grupo:"fin",arquivada:false,ordem:accounts.length}; accounts.push(cash); }
  // cada imóvel = conta-bem (patrimônio, saldo = valor); lançamentos = transações ETIQUETADAS na conta de dinheiro
  props.forEach(p=>{
    const acc={id:"imvacc_"+p.id,nome:p.nome,sub:"Imóvel de renda",tipo:"imovel",saldo:numOr0(p.valorMercado),alocado:numOr0(p.valorCompra),custo:0,grupo:"pat",arquivada:false,ordem:accounts.length};
    accounts.push(acc); p.accountId=acc.id;
    p._lanc.forEach(l=>{ imvAddTx(p,{iso:l.data||(l.ym+"-05"),tipo:l.tipo,cat:IMV_CAT,sub:l.categoria,conta:cash.nome,unidadeId:l.unitId||"",desc:l.desc||l.categoria,valor:l.valor}); });
    delete p._lanc; delete p.valorMercado; delete p.valorCompra;
  });
  reindexAccounts();
  d.props=props; imvUI().sub="portfolio"; imvUI().propId=null; refreshSideNet(); imvSave();
}

/* ---- listeners (prefixo imv-) ---- */
document.addEventListener("click",(e)=>{
  const iu=e.target.closest("[data-imv-units]"); if(iu){ const ui=imvUI(); ui.expand=ui.expand||{}; const id=iu.dataset.imvUnits; ui.expand[id]=!ui.expand[id]; renderView(); return; }
  const em=e.target.closest("[data-imv-extmode]"); if(em){ imvUI().extMode=em.dataset.imvExtmode; renderView(); return; }
  const mon=e.target.closest("[data-imv-mon]"); if(mon){ const ui=imvUI(); ui.monthOpen=ui.monthOpen||{}; const k=mon.dataset.imvMon; ui.monthOpen[k]=!ui.monthOpen[k]; renderView(); return; }
  const gp=e.target.closest("[data-imv-grp]"); if(gp){ const ui=imvUI(); ui.grpOpen=ui.grpOpen||{}; const k=gp.dataset.imvGrp; ui.grpOpen[k]=!ui.grpOpen[k]; renderView(); return; }
  const au=e.target.closest("[data-acct-units]"); if(au){ state.acctUnitsOpen=state.acctUnitsOpen||{}; const id=au.dataset.acctUnits; state.acctUnitsOpen[id]=!state.acctUnitsOpen[id]; renderView(); return; }
  const sub=e.target.closest("[data-imv-sub]"); if(sub){ const ui=imvUI(); ui.sub=sub.dataset.imvSub; ui.propId=null; ui.unitDetail=null; imvSave(); return; }
  const prop=e.target.closest("[data-imv-prop]"); if(prop){ const ui=imvUI(); ui.sub="portfolio"; ui.propId=prop.dataset.imvProp; ui.unitDetail=null; imvSave(); return; }
  const mo=e.target.closest("[data-imv-months]"); if(mo){ imvUI().chartMonths=+mo.dataset.imvMonths; imvSave(); return; }
  if(e.target.closest("[data-imv-add-lanc]")){ imvModalLanc(); return; }
  if(e.target.closest("[data-imv-add-prop]")){ imvModalProp(null); return; }
  if(e.target.closest("[data-imv-rateio]")){ imvModalRateio(); return; }
  if(e.target.closest("[data-imv-sample]")){ imvLoadSample(); return; }
  const tu=e.target.closest("[data-imv-toggle-uso]"); if(tu){ imvToggleUso(imvProps().find(x=>x.id===tu.dataset.imvToggleUso)); return; }
  const ep=e.target.closest("[data-imv-edit-prop]"); if(ep){ imvModalProp(ep.dataset.imvEditProp); return; }
  const eu=e.target.closest("[data-imv-edit-unit]"); if(eu){ imvModalUnit(eu.dataset.imvEditUnit); return; }
  const mu=e.target.closest("[data-imv-manage-units]"); if(mu){ imvModalUnits(mu.dataset.imvManageUnits); return; }
  const ua=e.target.closest("[data-imv-un-add]"); if(ua){ const p=imvProps().find(x=>x.id===ua.dataset.imvUnAdd); imvUnitAdd(p); imvModalUnits(p.id); return; }
  const ude=e.target.closest("[data-imv-un-del]"); if(ude){ const p=imvProps().find(x=>x.units.some(u=>u.id===ude.dataset.imvUnDel)); if(p&&imvUnitDel(p,ude.dataset.imvUnDel)) imvModalUnits(p.id); return; }
  const usp=e.target.closest("[data-imv-un-split]"); if(usp){ const p=imvProps().find(x=>x.units.some(u=>u.id===usp.dataset.imvUnSplit)); if(!p)return; const n=prompt("Separar em quantas unidades?","2"); if(n&&imvUnitSplit(p,usp.dataset.imvUnSplit,n)) imvModalUnits(p.id); return; }
  const ume=e.target.closest("[data-imv-un-merge]"); if(ume){ const p=imvProps().find(x=>x.id===ume.dataset.imvUnMerge); const ids=[...document.querySelectorAll("[data-imv-un-sel]:checked")].map(c=>c.dataset.imvUnSel); if(imvUnitMerge(p,ids)) imvModalUnits(p.id); return; }
  if(e.target.closest("[data-imv-un-done]")){ imvCloseModal(); imvSave(); return; }
  const udd=e.target.closest("[data-imv-unit-detail]"); if(udd){ const ui=imvUI(); ui.unitDetail={propId:ui.propId,unitId:udd.dataset.imvUnitDetail}; ui.histOpen=null; imvSave(); return; }
  const ub=e.target.closest("[data-imv-unit-back]"); if(ub){ const ui=imvUI(); ui.unitDetail=null; ui.histOpen=null; ui.propId=ub.dataset.imvUnitBack; imvSave(); return; }
  const enc=e.target.closest("[data-imv-encerrar]"); if(enc){ imvModalEncerrar(enc.dataset.imvEncerrar); return; }
  const he=e.target.closest("[data-imv-hist-edit]"); if(he){ const ui=imvUI(); imvModalHistEdit(ui.unitDetail.propId, ui.unitDetail.unitId, +he.dataset.imvHistEdit); return; }
  if(e.target.closest("[data-imv-hist-add]")){ const ui=imvUI(); imvModalHistEdit(ui.unitDetail.propId, ui.unitDetail.unitId, -1); return; }
  const hd=e.target.closest("[data-imv-hist-del]"); if(hd){ const u=imvUnitOf(); if(u&&confirm("Excluir esta entrada do histórico?")){ u.historico.splice(+hd.dataset.imvHistDel,1); imvSave(); } return; }
  const hdm=e.target.closest("[data-imv-hist-del-modal]"); if(hdm){ const u=imvUnitOf(); if(u&&confirm("Excluir esta entrada do histórico?")){ u.historico.splice(+hdm.dataset.imvHistDelModal,1); imvCloseModal(); imvSave(); } return; }
  const ht=e.target.closest("[data-imv-hist]"); if(ht){ const ui=imvUI(); const key=ui.unitDetail.propId+"|"+ui.unitDetail.unitId+"|"+ht.dataset.imvHist; ui.histOpen=ui.histOpen===key?null:key; imvSave(); return; }
  const dop=e.target.closest("[data-imv-doc-open]"); if(dop){ const path=dop.dataset.imvDocOpen; if(window.Store&&Store.docSignedUrl){ Store.docSignedUrl(path).then(u=>{ if(u) window.open(u,"_blank","noopener"); else alert("Não consegui abrir o documento (verifique a conexão)."); }); } return; }
  const ddl=e.target.closest("[data-imv-doc-del]"); if(ddl){ imvDelDoc(ddl.dataset.imvDocDel); return; }
  const pay=e.target.closest("[data-imv-pay]"); if(pay){ const [pid,uid]=pay.dataset.imvPay.split("|"); const p=imvProps().find(x=>x.id===pid); imvRegisterPayment(p,p.units.find(x=>x.id===uid)); return; }
  const cu=e.target.closest("[data-imv-contract-unit]"); if(cu){ const ui=imvUI(); const pid=ui.unitDetail?ui.unitDetail.propId:ui.propId; ui.sub="contratos"; ui.unitDetail=null; ui.propId=null; ui.tplPropId=pid; ui.tplUnitId=cu.dataset.imvContractUnit; imvPrefillTenant(); imvSave(); return; }
  const tp=e.target.closest("[data-imv-tpl]"); if(tp){ imvUI().tpl=tp.dataset.imvTpl; imvRefreshContract(); return; }
  if(e.target.closest("[data-imv-fill-tenant]")){ imvPrefillTenant(true); imvSave(); return; }
  if(e.target.closest("[data-imv-print]")){ imvPrintContract(); return; }
  if(e.target.closest("[data-imv-owner]")){ imvModalOwner(); return; }
  if(e.target.closest("[data-imv-close]")||(e.target.dataset&&e.target.dataset.imvCloseBg!==undefined)){ imvCloseModal(); return; }
});
document.addEventListener("change",(e)=>{
  const en=e.target.closest("[data-imv-enable]"); if(en){ const d=imvData(); d.enabled=e.target.checked; if(!d.enabled&&state.tab==="imoveis")state.tab="dashboard"; imvSave(); return; }
  const up=e.target.closest("[data-imv-doc-up]"); if(up){ imvAddDocs(up, up.dataset.imvDocUp||"cur"); return; }
  const su=e.target.closest("[data-imv-tpl-unit]"); if(su){ const [pid,uid]=su.value.split("|"); const ui=imvUI(); ui.tplPropId=pid; ui.tplUnitId=uid; imvPrefillTenant(); imvSave(); return; }
  const t=e.target.closest("[data-imv-t]"); if(t){ imvUI().tenant[t.dataset.imvT]=t.value; imvRefreshContract(); return; }
  const c=e.target.closest("[data-imv-c]"); if(c){ const k=c.dataset.imvC; imvUI().contract[k]=(k==="meses"||k==="diaVenc")?(parseInt(c.value)||0):c.value; imvRefreshContract(); return; }
});
document.addEventListener("input",(e)=>{
  const ob=e.target.closest("[data-imv-obs]"); if(ob){ const u=imvUnitOf(); if(u&&u.inquilino){u.inquilino.obs=ob.value; scheduleSave();} return; }
  const uf=e.target.closest("[data-imv-un-f]"); if(uf){ const p=imvProps().find(x=>x.units.some(u=>u.id===uf.dataset.uid)); const u=p&&p.units.find(x=>x.id===uf.dataset.uid); if(u){ u[uf.dataset.imvUnF]=uf.value; scheduleSave(); } return; }
  const t=e.target.closest("[data-imv-t]"); if(t){ imvUI().tenant[t.dataset.imvT]=t.value; imvRefreshContract(); return; }
  const c=e.target.closest("[data-imv-c]"); if(c){ const k=c.dataset.imvC; imvUI().contract[k]=(k==="meses"||k==="diaVenc")?(parseInt(c.value)||0):c.value; imvRefreshContract(); return; }
});
