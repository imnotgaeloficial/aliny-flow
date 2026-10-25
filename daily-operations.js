/* Daily workspace UI. Imported records remain read-only. */
window.createDailyOperations = function (api) {
  'use strict';
  const el = id => document.getElementById(id);
  const labels = ['Atualizar o relatório do Wiser', 'Conferir os gates sem assinatura', 'Revisar pedidos parados', 'Conferir BBAGs pendentes', 'Registrar pendências para o próximo turno'];
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const panel = document.createElement('section');
  panel.className = 'panel daily-workspace hideprint';
  panel.innerHTML = `<div class="daily-heading"><div><span class="eyebrow">SEU TURNO EM FOCO</span><h2>Resumo do dia</h2></div><button type="button" class="btn" id="dailyOpenSummary">Resumo completo →</button></div><p id="dailySource" class="mini muted"></p><div class="daily-metrics" id="dailyMetrics"></div><div class="daily-columns"><section aria-labelledby="quickFindTitle"><h3 id="quickFindTitle">Busca rápida</h3><label for="dailySearch">Número do pedido ou gate</label><input type="search" id="dailySearch" placeholder="Ex.: 74618 ou 79221134" autocomplete="off"><p id="dailySearchCount" class="mini muted" role="status"></p><div id="dailySearchResults" class="daily-results"></div></section><section aria-labelledby="dailyChecklistTitle"><div class="daily-heading"><h3 id="dailyChecklistTitle">Checklist de fechamento</h3><input type="date" id="dailyChecklistDate" aria-label="Data do checklist"></div><p class="mini muted">Marque o que você conferiu. A marcação não altera pedidos ou assinaturas.</p><p id="dailyChecklistProgress" role="status"></p><progress id="dailyChecklistBar" max="5" value="0" aria-label="Progresso do fechamento"></progress><div id="dailyChecklistItems"></div><p id="dailyChecklistStatus" class="mini muted" role="status"></p><button type="button" class="btn" id="dailyChecklistDownload">Baixar checklist</button></section></div>`;
  el('dashboard').prepend(panel);
  el('dailyChecklistDate').value = today();
  let index = [], searchTimer, lastResults = [];
  const escape = api.escape;
  function updateChecklist() {
    const day = el('dailyChecklistDate').value;
    const state = api.checklist()[day] || [];
    el('dailyChecklistItems').innerHTML = labels.map((label,i) => `<label class="daily-check"><input type="checkbox" data-check-index="${i}" ${state.includes(i)?'checked':''}><span>${label}</span></label>`).join('');
    el('dailyChecklistProgress').textContent = `${state.length} de ${labels.length} etapas concluídas`;
    el('dailyChecklistBar').value = state.length;
    el('dailyChecklistDownload').disabled = !day;
    panel.querySelectorAll('[data-check-index]').forEach(input => input.disabled = !day);
  }
  function search() {
    const q = api.norm(el('dailySearch').value);
    if (!q) {lastResults=[];el('dailySearchCount').textContent='Busque nos dados do relatório aberto.';el('dailySearchResults').replaceChildren();return;}
    const found = index.filter(x=>api.norm(x.id).includes(q));
    found.sort((a,b)=>(a.id===q?0:1)-(b.id===q?0:1)||a.id.localeCompare(b.id,'pt-BR',{numeric:true}));
    lastResults=found.slice(0,30);
    el('dailySearchCount').textContent = found.length ? `${found.length.toLocaleString('pt-BR')} resultados${found.length>30?' · mostrando os primeiros 30; refine a busca':''}` : 'Nenhum pedido ou gate encontrado no relatório aberto.';
    el('dailySearchResults').innerHTML=lastResults.map((r,i)=>`<button type="button" class="daily-result" data-result="${i}"><span><b>${r.kind==='gate'?'Gate':'Pedido'} ${escape(r.id)}</b><small>${escape(r.carrier)}</small></span><span>${escape(r.status)}<small>Abrir ${r.kind==='gate'?'gate':'pedido'} →</small></span></button>`).join('');
  }
  function refresh() {
    const data = api.data(), orders=api.orders(data.records);
    index=[...data.gates.map(g=>({kind:'gate',id:g.gate,carrier:g.carrier,status:({yes:'Assinado',no:'Não assinado',mix:'Divergente',unknown:'Para conferir'})[g.status]})),...orders.map(o=>({kind:'order',id:o.id,carrier:[...o.carriers].join(' / '),status:api.status(o)}))];
    el('dailySource').textContent=(el('importStamp').textContent||'Importe um relatório para começar.')+' · Totais do arquivo aberto; sem atualização ao vivo.';
    const waiting=orders.filter(o=>o.status.size===1&&['aguardando conferencia','aguardando carregamento'].includes([...o.status.keys()][0])&&o.wait!==null&&o.wait>=1);
    const bbagOrders=api.orders(data.records.filter(api.isBbag));
    const hasStatus=data.records.some(r=>Object.hasOwn(r,'Status')),hasClass=data.records.some(r=>Object.hasOwn(r,'Classificacao do Tipo de Pedido'));
    const metrics=[[orders.length,'Pedidos únicos','orders'],[data.gates.length,'Gates no relatório','gates'],[data.gates.filter(g=>g.status==='no').length,'Gates sem assinatura','unsigned'],[hasStatus?waiting.length:'—','Pedidos parados ≥ 1h','stalled'],[hasStatus&&hasClass?bbagOrders.filter(o=>api.kind(o)==='pending').length:'—','BBAGs pendentes','bbags']];
    el('dailyMetrics').innerHTML=metrics.map(([n,label,target])=>`<button type="button" class="daily-metric" data-daily-target="${target}"><strong>${n.toLocaleString('pt-BR')}</strong><span>${label}</span></button>`).join('');
    search();updateChecklist();
  }
  panel.addEventListener('click',e=>{
    const result=e.target.closest('[data-result]');
    if(result){const r=lastResults[Number(result.dataset.result)];if(r)api.openResult(r);return;}
    const target=e.target.closest('[data-daily-target]');if(target)api.openMetric(target.dataset.dailyTarget);
  });
  el('dailySearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,120);});
  el('dailyChecklistDate').addEventListener('change',updateChecklist);
  el('dailyChecklistItems').addEventListener('change',e=>{
    const box=e.target.closest('[data-check-index]');if(!box)return;
    const day=el('dailyChecklistDate').value;if(!day)return;
    const checked=[...panel.querySelectorAll('[data-check-index]:checked')].map(x=>Number(x.dataset.checkIndex));
    api.saveChecklist(day,checked);updateChecklist();
  });
  el('dailyOpenSummary').onclick=()=>api.go('summary');
  el('dailyChecklistDownload').onclick=()=>{
    const day=el('dailyChecklistDate').value,checked=api.checklist()[day]||[];
    const text=`Aliny Flow — Fechamento de ${day}\n\n`+labels.map((label,i)=>`[${checked.includes(i)?'x':' '}] ${label}`).join('\n')+'\n\n'+el('dailySource').textContent;
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`aliny-fechamento-${day}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  new MutationObserver(()=>el('dailyChecklistStatus').textContent=el('cloudNotesStatus').textContent).observe(el('cloudNotesStatus'),{childList:true,characterData:true,subtree:true});
  const menu = document.createElement('button');menu.type='button';menu.id='dailyMobileMenu';menu.className='btn';menu.textContent='☰ Menu';menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','dailySideNav');
  const side=document.querySelector('.shell>.side');side.id='dailySideNav';document.querySelector('.main>.top').prepend(menu);
  menu.onclick=()=>{const open=document.body.classList.toggle('daily-menu-open');menu.setAttribute('aria-expanded',String(open));};
  side.addEventListener('click',e=>{if(e.target.closest('.nav')){document.body.classList.remove('daily-menu-open');menu.setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('daily-menu-open')){document.body.classList.remove('daily-menu-open');menu.setAttribute('aria-expanded','false');menu.focus();}});
  document.querySelectorAll('.nav').forEach(button=>button.setAttribute('aria-label',button.textContent.trim()));
  refresh();
  return {refresh,updateChecklist};
};
