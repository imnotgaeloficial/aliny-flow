/* Aliny Flow — ferramentas de transportadoras e conferência (27/10/2026) */
(function () {
  'use strict';
  var initialized = false;
  var carrierNames = [];
  var currentPending = [];
  var reviewKey = 'alinyflow_gate_review_v1';
  var review = {};
  try {
    var saved = JSON.parse(window.localStorage.getItem(reviewKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) review = saved;
  } catch (e) {}
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function normalize(v) {
    return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function keyFor(g) { return normalize(g.carrier) + '|' + String(g.gate); }
  function saveReview() {
    try { window.localStorage.setItem(reviewKey, JSON.stringify(review)); return true; }
    catch (e) { alert('Não foi possível guardar a classificação neste navegador.'); return false; }
  }
  function groupFor(g) {
    if (g.closedEvidence) return 'closed';
    var manual = review[keyFor(g)];
    return manual === 'closed' || manual === 'nr' ? manual : 'check';
  }
  function logoFor(carrier) {
    var api=window.alinyCarriers;
    var original=api&&api.logo(carrier);
    if(original)return original;
    // Compartilha imagens cadastradas na página de impressão com a tela de logística.
    try {
      var saved=JSON.parse(localStorage.getItem('alinyflow_logos_individuais_v1')||'{}');
      var map=saved&&saved.logos||{};
      var name=normalize(carrier).trim().replace(/\s+/g,' ');
      var found=Object.keys(map).find(function(k){
        return normalize(k).trim().replace(/\s+/g,' ')===name;
      });
      var src=found&&map[found];
      if(src&&(/^data:image\/(png|jpeg|webp);base64,/i.test(src)||/^https:\/\//i.test(src)))return src;
    }catch(e){}
    return null;
  }
  function printLogo(carrier) {
    var api = window.alinyCarriers;
    var src = logoFor(carrier);
    if (!src) { alert('Cadastre primeiro a logo de ' + carrier + '.'); return; }
    var sheet = document.getElementById('afCarrierPrintSheet');
    sheet.innerHTML =
      '<div class="af-logo-page">' +
        '<header class="af-logo-page-header">' +
          '<div class="af-logo-page-brand"><span class="af-logo-brand-emblem">AF</span>' +
            '<div><strong>ALINY FLOW</strong><small>CONTROLE LOGÍSTICO</small></div></div>' +
          '<div class="af-logo-page-tag">IDENTIFICAÇÃO</div>' +
        '</header>' +
        '<div class="af-logo-page-line" aria-hidden="true"></div>' +
        '<main class="af-logo-page-main">' +
          '<p class="af-logo-page-eyebrow">TRANSPORTADORA</p>' +
          '<div class="af-logo-page-photo"><img class="af-logo-page-image" src="' +
            esc(src) + '" alt="Logo da transportadora ' + esc(carrier) + '"></div>' +
          '<div class="af-logo-page-name-label">IDENTIFICAÇÃO DA TRANSPORTADORA</div>' +
          '<h1 class="af-logo-page-name">' + esc(carrier) + '</h1>' +
          '<div class="af-logo-page-dash" aria-hidden="true"></div>' +
        '</main>' +
        '<footer class="af-logo-page-footer"><span>ALINY FLOW <i>·</i> EXPEDIÇÃO</span>' +
          '<span>IDENTIFICAÇÃO VISUAL</span></footer>' +
      '</div>';
    var img = sheet.querySelector('.af-logo-page-image');
    var previous = document.body.dataset.print || 'gates';
    document.body.dataset.print = 'carrier-logo';
    var done = false;
    function reset() {
      if (done) return;
      done = true;
      document.body.dataset.print = previous;
      sheet.replaceChildren();
      window.removeEventListener('afterprint', reset);
    }
    window.addEventListener('afterprint', reset);
    Promise.resolve(typeof img.decode === 'function' ? img.decode() : (img.complete && img.naturalWidth ? null : Promise.reject(new Error('Logo não carregada'))))
      .then(function() { return window.print(); })
      .catch(function(e) { reset(); alert('A logo não carregou. Confira a imagem antes de imprimir.'); });
  }
  function renderCarriers() {
    var api = window.alinyCarriers;
    if (!api) return;
    carrierNames = api.list();
    if (api.mode() !== 'demo') {
      try { window.localStorage.setItem('alinyflow_carrier_catalog_v1', JSON.stringify(carrierNames)); } catch (e) {}
    }
    var text = normalize(document.getElementById('afCarrierSearch').value);
    var matches = carrierNames.map(function(name, index){ return {name:name,index:index}; })
      .filter(function(item){ return normalize(item.name).includes(text); });
    document.getElementById('afCarrierCount').textContent =
      matches.length + ' transportadora(s) • ' + (api.mode()==='demo' ? 'modo demonstração' : 'relatório importado') + ' + logos cadastradas';
    document.getElementById('afCarrierList').innerHTML = matches.map(function(item) {
      var src = logoFor(item.name);
      var photo = src
        ? '<img class="af-carrier-logo-thumb" src="' + esc(src) + '" alt="Logo ' + esc(item.name) + '">'
        : '<span class="af-logo-empty">Sem logo</span>';
      return '<div class="af-carrier-item">' + photo +
        '<div class="af-carrier-name"><b>' + esc(item.name) + '</b><small>' +
        (src ? 'Logo cadastrada' : 'Envie uma logo para imprimir') + '</small></div>' +
        '<div class="af-carrier-actions"><button type="button" class="btn" data-af-select="' +
        item.index + '">Escolher logo</button><button type="button" class="btn primary" data-af-print="' +
        item.index + '"' + (src ? '' : ' disabled') + '>Imprimir só a logo</button></div></div>';
    }).join('') || '<p class="muted">Nenhuma transportadora encontrada. Importe um relatório de gates ou cadastre uma logo.</p>';
    var selection = document.getElementById('logoCarrier').value;
    document.getElementById('afSelectedCarrierPrint').disabled = !logoFor(selection);
  }
  function renderPending() {
    var api = window.alinyCarriers;
    if (!api) return;
    var area = document.getElementById('afPendingArea');
    currentPending = api.pending();
    var groups = {closed:[],nr:[],check:[]};
    currentPending.forEach(function(g){ groups[groupFor(g)].push(g); });
    document.getElementById('afPendingCounts').innerHTML =
      '<span><b>' + currentPending.length + '</b> sem assinatura no Excel</span>' +
      '<span><b>' + groups.closed.length + '</b> encerrados / marcados</span>' +
      '<span><b>' + groups.nr.length + '</b> aguardando NR’s (manual)</span>' +
      '<span><b>' + groups.check.length + '</b> sem classificação</span>';
    if (api.mode()==='demo') {
      area.innerHTML = '<div class="empty">Dados demonstrativos. Importe o Excel para conferir os gates reais.</div>';
      return;
    }
    if (!currentPending.length) {
      area.innerHTML = '<div class="empty">Nenhum gate não assinado no relatório carregado.</div>';
      return;
    }
    var heading = {closed:'Encerrados sem assinatura', nr:'Aguardando NR’s', check:'Encerramento / NR a conferir'};
    var help = {closed:'Fechamento explícito no complemento ou classificação manual',
                nr:'Classificados manualmente; não confirmados automaticamente no Wiser',
                check:'O Excel não informa se estão encerrados ou aguardando NR’s'};
    area.innerHTML = ['closed','nr','check'].map(function(group) {
      var rows = groups[group];
      return '<section class="af-pending-group"><h3>' + heading[group] + ' <small>(' +
        rows.length + ')</small></h3><p class="mini muted">' + help[group] + '</p>' +
        (rows.length ? '<div class="af-pending-list">' + rows.map(function(g) {
          var index = currentPending.indexOf(g);
          var label = g.closedEvidence ? 'Fechamento documentado' :
            review[keyFor(g)] ? 'Classificação manual' : 'Aguardando conferência';
          var selected = groupFor(g);
          return '<div class="af-pending-item"><div><strong>Gate ' + esc(g.gate) +
            '</strong> · ' + esc(g.carrier) + '<small>' + esc(label) + ' · ' + g.count +
            ' pedido(s)</small></div><div class="af-pending-actions">' +
            '<select aria-label="Situação do gate ' + esc(g.gate) +
            '" data-af-review="' + index + '"' + (g.closedEvidence ? ' disabled' : '') + '>' +
            '<option value="check"' + (selected === 'check' ? ' selected' : '') + '>A conferir</option>' +
            '<option value="closed"' + (selected === 'closed' ? ' selected' : '') + '>Encerrado</option>' +
            '<option value="nr"' + (selected === 'nr' ? ' selected' : '') + '>Aguardando NR’s</option>' +
            '</select><button type="button" class="btn" data-af-open="' + index +
            '">Ver gate</button></div></div>';
        }).join('') + '</div>' : '<p class="mini muted">Nenhum gate nesta categoria.</p>') +
        '</section>';
    }).join('');
  }
  function init() {
    if (initialized || !window.alinyCarriers || !document.getElementById('logos')) return;
    initialized = true;
    var api = window.alinyCarriers;
    // Um atalho visível evita que a impressão individual fique escondida na navegação.
    ['dashboard', 'gates'].forEach(function(pageId) {
      var page = document.getElementById(pageId);
      if (!page || page.querySelector('[data-af-logos-shortcut]')) return;
      var shortcut = document.createElement('div');
      shortcut.className = 'panel hideprint';
      shortcut.style.cssText = 'margin:14px 0;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;border:1px solid #8558c4';
      var copy = document.createElement('div');
      copy.innerHTML = '<strong style="font-size:15px">🖨️ Logos das transportadoras</strong>' +
        '<p class="mini muted" style="margin:5px 0 0">Selecione a transportadora, visualize a logo e imprima sua identificação em folha A4.</p>';
      var action = document.createElement('button');
      action.type = 'button';
      action.className = 'btn primary';
      action.textContent = 'Abrir impressão de logos';
      action.setAttribute('data-af-logos-shortcut', '');
      action.addEventListener('click', function() {
        window.location.href = './imprimir-logos.html';
      });
      shortcut.appendChild(copy);
      var links = document.createElement('div');
      links.style.cssText = 'display:flex;gap:9px;flex-wrap:wrap;align-items:center';
      links.appendChild(action);
      var signAction = document.createElement('a');
      signAction.className = 'btn';
      signAction.href = './placas.html';
      signAction.textContent = '🪧 Imprimir placas dos gates e pedidos';
      links.appendChild(signAction);
      shortcut.appendChild(links);
      var heading = page.querySelector('h2');
      if (heading) heading.after(shortcut);
      else page.prepend(shortcut);
    });
    var style = document.createElement('style');
    style.textContent = [
      '.af-carrier-tools{margin-top:16px}.af-carrier-list{display:grid;gap:9px;margin-top:14px}',
      '.af-carrier-item{display:flex;align-items:center;gap:14px;padding:12px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}',
      '.af-carrier-logo-thumb,.af-logo-empty{width:100px;height:54px;flex-shrink:0;object-fit:contain;background:#fff;color:#555;border-radius:7px;padding:5px}',
      '.af-logo-empty{display:grid;place-items:center;background:#241a34;color:var(--muted);font-size:11px;border:1px dashed var(--line)}',
      '.af-carrier-name{flex:1;min-width:130px;overflow-wrap:anywhere}.af-carrier-name small,.af-pending-item small{display:block;color:var(--muted);margin-top:5px}',
      '.af-carrier-actions,.af-pending-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.af-pending-group{margin-top:18px}.af-pending-group h3{font-size:15px;margin:0 0 7px}.af-pending-group h3 small{color:var(--muted)}',
      '.af-pending-list{display:grid;gap:9px}.af-pending-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line);background:var(--panel2);border-radius:9px}',
      '.af-pending-item strong{color:#f5efff}.af-pending-actions select{min-width:158px}.af-pending-counts{display:flex;gap:10px;flex-wrap:wrap}',
      '.af-pending-counts span{padding:9px 12px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;font-size:12px}',
      '.af-pending-counts b{color:var(--blue);font-size:16px}.af-print-sheet{display:none}',
      '@media(max-width:690px){.af-carrier-item,.af-pending-item{align-items:flex-start;flex-wrap:wrap}.af-carrier-actions{width:100%}.af-carrier-logo-thumb,.af-logo-empty{width:78px}}',
      '@media print{@page{size:A4 portrait;margin:8mm}',
      'body[data-print="carrier-logo"]{margin:0!important;padding:0!important;background:#fff!important;color:#231b2b!important}',
      'body[data-print="carrier-logo"]>:not(#afCarrierPrintSheet){display:none!important}',
      'body[data-print="carrier-logo"] #afCarrierPrintSheet{display:block!important;width:194mm;height:281mm;margin:0!important;padding:0!important;background:#fff!important;overflow:hidden;page-break-inside:avoid;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}',
      '#afCarrierPrintSheet .af-logo-page{box-sizing:border-box;position:relative;display:flex;flex-direction:column;width:194mm;height:281mm;padding:13mm 13mm 9mm;border:1.5px solid #ad8dd5;background:#fff;color:#20172c;overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact}',
      '#afCarrierPrintSheet .af-logo-page:before{content:"";position:absolute;left:0;right:0;top:0;height:4mm;background:#7648bb;print-color-adjust:exact;-webkit-print-color-adjust:exact}',
      '#afCarrierPrintSheet .af-logo-page-header{display:flex;justify-content:space-between;align-items:center;gap:6mm;padding:3mm 0 7mm}',
      '#afCarrierPrintSheet .af-logo-page-brand{display:flex;align-items:center;gap:3mm;font:700 13pt Arial,sans-serif;letter-spacing:1.2px}',
      '#afCarrierPrintSheet .af-logo-page-brand small{display:block;margin-top:1mm;font:500 7pt Arial,sans-serif;letter-spacing:2px;color:#645372}',
      '#afCarrierPrintSheet .af-logo-brand-emblem{display:grid;place-items:center;flex-shrink:0;width:15mm;height:15mm;border:1.8px solid #7648bb;border-radius:4mm;color:#7648bb;font:800 16pt Arial,sans-serif;letter-spacing:-1px}',
      '#afCarrierPrintSheet .af-logo-page-tag{border:1px solid #b9a2d6;color:#66428d;padding:3mm;font:700 7.5pt Arial,sans-serif;letter-spacing:1.6px;border-radius:1.6mm}',
      '#afCarrierPrintSheet .af-logo-page-line{height:1mm;background:#7648bb;width:100%;flex-shrink:0}',
      '#afCarrierPrintSheet .af-logo-page-main{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:10mm 0 13mm}',
      '#afCarrierPrintSheet .af-logo-page-eyebrow{font:700 9pt Arial,sans-serif;letter-spacing:3px;color:#755598;margin:0 0 9mm}',
      '#afCarrierPrintSheet .af-logo-page-photo{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;height:128mm;flex-shrink:0;padding:12mm;border:1.2px solid #c9b2e5;background:white}',
      '#afCarrierPrintSheet .af-logo-page-image{display:block!important;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;filter:none!important;opacity:1!important}',
      '#afCarrierPrintSheet .af-logo-page-name-label{margin-top:12mm;color:#806b97;font:600 8pt Arial,sans-serif;letter-spacing:2px;text-align:center}',
      '#afCarrierPrintSheet .af-logo-page-name{margin:4mm 0 5mm;max-width:162mm;max-height:39mm;overflow:hidden;color:#20172c;font:800 22pt/1.2 Arial,sans-serif;letter-spacing:.2px;text-align:center;white-space:normal;overflow-wrap:anywhere;text-transform:uppercase}',
      '#afCarrierPrintSheet .af-logo-page-dash{height:1.2mm;width:20mm;background:#7648bb;flex-shrink:0}',
      '#afCarrierPrintSheet .af-logo-page-footer{display:flex;justify-content:space-between;align-items:center;gap:6mm;padding-top:6mm;border-top:1px solid #c9b2e5;font:700 7pt Arial,sans-serif;letter-spacing:1.1px;color:#665477}',
      '#afCarrierPrintSheet .af-logo-page-footer i{font-style:normal;color:#7648bb}}'
    ].join('');
    document.head.appendChild(style);
    var listPanel = document.createElement('div');
    listPanel.className = 'panel af-carrier-tools hideprint';
    listPanel.innerHTML = '<h2>Transportadoras e impressão individual</h2>' +
      '<p>Escolha uma transportadora e imprima uma identificação elegante em A4: logo centralizada e em destaque, nome grande e acabamento ultravioleta do AlinyFlow, sem dados dos gates.</p>' +
      '<div class="toolbar"><input id="afCarrierSearch" type="search" placeholder="Buscar transportadora" aria-label="Buscar transportadora">' +
      '<button type="button" class="btn primary" id="afSelectedCarrierPrint">Imprimir logo selecionada</button>' +
      '<a class="btn" href="./imprimir-logos.html">Abrir página exclusiva de impressão</a>' +
      '<a class="btn" href="./placas.html">🪧 Placas da expedição</a></div>' +
      '<p id="afCarrierCount" class="mini muted" role="status"></p><div id="afCarrierList" class="af-carrier-list"></div>';
    document.getElementById('logos').appendChild(listPanel);
    var pendingPanel = document.createElement('div');
    pendingPanel.className = 'panel hideprint';
    pendingPanel.style.marginBottom = '16px';
    pendingPanel.innerHTML = '<h2>Conferência de assinatura — gates pendentes</h2>' +
      '<p class="mini muted">A falta de data em “Manifesto Assinado Em” no Excel não prova a situação atual no Wiser. Os encerramentos só são confirmados com o campo explícito “Gate Encerrado Em”; “Aguardando NR’s” é uma classificação manual.</p>' +
      '<div id="afPendingCounts" class="af-pending-counts"></div><div id="afPendingArea"></div>' +
      '<p class="mini muted">Classificações manuais são guardadas somente neste navegador; não alteram o Wiser. Faça nova exportação para atualizar as assinaturas.</p>';
    document.getElementById('gates').querySelector('h2').after(pendingPanel);
    var sheet = document.createElement('div');
    sheet.className = 'af-print-sheet';
    sheet.id = 'afCarrierPrintSheet';
    document.body.appendChild(sheet);
    document.getElementById('afCarrierSearch').addEventListener('input', renderCarriers);
    document.getElementById('afCarrierList').addEventListener('click', function(e) {
      var select = e.target.closest('[data-af-select]');
      var print = e.target.closest('[data-af-print]');
      if (select) { api.selectLogo(carrierNames[Number(select.dataset.afSelect)]); renderCarriers(); }
      if (print) printLogo(carrierNames[Number(print.dataset.afPrint)]);
    });
    document.getElementById('afSelectedCarrierPrint').addEventListener('click', function() {
      printLogo(document.getElementById('logoCarrier').value);
    });
    document.getElementById('logoCarrier').addEventListener('change', renderCarriers);
    new MutationObserver(renderCarriers).observe(document.getElementById('logoPreview'), {childList:true,subtree:true});
    document.getElementById('afPendingArea').addEventListener('click', function(e) {
      var button = e.target.closest('[data-af-open]');
      if (button) {
        var g = currentPending[Number(button.dataset.afOpen)];
        if (g) api.openGate(g.carrier, g.gate);
      }
    });
    document.getElementById('afPendingArea').addEventListener('change', function(e) {
      var select = e.target.closest('[data-af-review]');
      if (!select) return;
      var g = currentPending[Number(select.dataset.afReview)];
      if (!g || g.closedEvidence) return;
      if (select.value === 'check') delete review[keyFor(g)];
      else review[keyFor(g)] = select.value;
      saveReview();
      renderPending();
    });
    window.addEventListener('aliny-carriers-updated', function() {
      renderCarriers();
      renderPending();
    });
    renderCarriers();
    renderPending();
  }
  if (window.alinyCarriers) init();
  else window.addEventListener('aliny-carriers-ready', init, {once:true});
})();


/* AlinyFlow: impressão anime para gates, preservando o relatório e os dados existentes. */
;(function(){
  'use strict';
  if(document.getElementById('alinyAnimeGatePrintStyle')) return;
  var style=document.createElement('style');
  style.id='alinyAnimeGatePrintStyle';
  style.textContent="@media print{\n@page{size:A4 portrait;margin:12mm 11mm}\nbody[data-print=\"gates\"]{background:#fff!important}\nbody[data-print=\"gates\"]::before{content:\"\";position:fixed;inset:4mm;border:1.2px solid #8c57c5;border-radius:11px;box-shadow:inset 0 0 0 2px #f0e3ff,0 0 0 .6px #c5a6ed;pointer-events:none;z-index:7}\nbody[data-print=\"gates\"] #gatePrintReport{font-family:Georgia,\"Times New Roman\",serif!important;color:#281640!important;max-width:188mm!important;padding:3mm 4mm!important;isolation:isolate;position:relative}\nbody[data-print=\"gates\"] #gatePrintReport::before{content:\"\";position:fixed;top:93mm;left:25mm;width:160mm;height:106mm;background-image:url(\"data:image/webp;base64,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\");background-position:center;background-repeat:no-repeat;background-size:contain;opacity:.16;pointer-events:none;z-index:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody[data-print=\"gates\"] #gatePrintReport::after{content:\"✦  🦋   ✧   ♡   ✧   🦋  ✦\";display:block;text-align:center;font-family:Georgia,serif;letter-spacing:4px;font-size:11px;color:#8a54bd;border-top:1px solid #cfb4ed;padding-top:7px;margin-top:15px}\nbody[data-print=\"gates\"] #gatePrintReport>:not(.anime-watermark){position:relative;z-index:1}\nbody[data-print=\"gates\"] #gatePrintReport .gate-report-heading{border:2px double #8a51c3!important;border-radius:14px;background:linear-gradient(120deg,#fbf7ff,#f3eaff)!important;padding:14px 17px!important;margin:0 0 12px!important;display:flex;align-items:center;gap:10px;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody[data-print=\"gates\"] #gatePrintReport .gate-report-heading::after{content:\"🦋 ✦\";font-size:25px;color:#8445bc;white-space:nowrap}\nbody[data-print=\"gates\"] #gatePrintReport .gate-report-kicker{font-family:Arial,sans-serif;color:#77509e!important;font-size:8px!important;letter-spacing:2.1px!important}\nbody[data-print=\"gates\"] #gatePrintReport h1{font-family:Georgia,\"Times New Roman\",serif!important;color:#4b167c!important;font-size:24px!important;line-height:1.05!important;letter-spacing:.4px;margin:4px 0 2px!important;text-shadow:1px 1px 0 #e9d5fa}\nbody[data-print=\"gates\"] #gatePrintReport .gate-report-badge{font-family:Arial,sans-serif;font-weight:700;color:#683592!important;border-color:#b18ad7!important;border-radius:100px!important;background:#f8f1ff!important}\nbody[data-print=\"gates\"] #gatePrintReport .gate-print-summary{display:flex!important;flex-wrap:wrap!important;justify-content:space-around!important;background:#f7f0ff!important;border:1px solid #c7a5e7!important;border-radius:11px!important;padding:10px!important;gap:6px 10px!important;font:700 10px Arial,sans-serif!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody[data-print=\"gates\"] #gatePrintReport p{font-family:Arial,sans-serif!important;color:#2b2240!important;line-height:1.45!important}\nbody[data-print=\"gates\"] #gatePrintReport>p{padding:3px 2px!important;font-size:9px!important}\nbody[data-print=\"gates\"] #gatePrintReport table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;margin:10px 0!important;background:transparent!important}\nbody[data-print=\"gates\"] #gatePrintReport thead{display:table-header-group!important}\nbody[data-print=\"gates\"] #gatePrintReport th{font-family:Arial,sans-serif!important;font-weight:800!important;letter-spacing:.12px;color:#35135d!important;background:#e8d7f9!important;border:1px solid #8b5abb!important;font-size:8px!important;padding:7px 4px!important;text-align:left!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody[data-print=\"gates\"] #gatePrintReport td{font-family:Arial,sans-serif!important;font-size:8.5px!important;line-height:1.4!important;color:#171021!important;border:1px solid #bfa7d4!important;background:rgba(255,255,255,.78)!important;padding:7px 5px!important;overflow-wrap:anywhere!important;white-space:normal!important}\nbody[data-print=\"gates\"] #gatePrintReport tbody tr:not(.carrier-title):nth-child(even) td{background:rgba(245,238,251,.75)!important}\nbody[data-print=\"gates\"] #gatePrintReport .carrier-title td{background:#f1e7fc!important;border-top:2px solid #8c56b7!important;color:#4e2376!important;font-weight:800!important;padding:6px 7px!important}\nbody[data-print=\"gates\"] #gatePrintReport .print-carrier{display:flex!important;align-items:center!important;gap:9px!important}\nbody[data-print=\"gates\"] #gatePrintReport .print-carrier-logo{width:122px!important;height:47px!important;object-fit:contain!important;background:white!important;border-radius:5px!important;padding:2px!important}\nbody[data-print=\"gates\"] #gatePrintReport tr{break-inside:avoid!important}\nbody[data-print=\"gates\"] #gatePrintReport .manual{height:32px!important}\nbody[data-print=\"gates\"] #gatePrintReport .carrier-checker-signature{margin-top:16px!important;padding:11px 12px!important;border:1px solid #b994db!important;border-radius:11px!important;background:#faf6ff!important;max-width:none!important;break-inside:avoid!important}\nbody[data-print=\"gates\"] #gatePrintReport .carrier-checker-signature b{font-family:Arial,sans-serif!important;color:#542483!important;letter-spacing:.4px}\nbody[data-print=\"gates\"] #gatePrintReport .carrier-checker-signature .carrier-sign-line{border-bottom:1px solid #642f91!important;height:11mm!important}\nbody[data-print=\"gates\"] #gatePrintReport .carrier-checker-signature p{font-size:9px!important;line-height:1.9!important}\n}";
  document.head.appendChild(style);
  var report=document.getElementById('gatePrintReport');
  if(!report)return;
  function tuneGatePrint(){
    var heading=report.querySelector('.gate-report-heading h1');
    if(!heading)return;
    var state=document.getElementById('gStatus');
    heading.textContent=state&&state.value==='no'?'GATES NÃO ASSINADOS':state&&state.value==='yes'?'GATES ASSINADOS':'CONTROLE DE GATES';
    var kicker=report.querySelector('.gate-report-kicker');
    if(kicker)kicker.textContent='ALINYFLOW · EXPEDIÇÃO · CONTROLE LOGÍSTICO';
    var badge=report.querySelector('.gate-report-badge');
    if(badge)badge.textContent='CONFERÊNCIA E ACOMPANHAMENTO';
  }
  new MutationObserver(tuneGatePrint).observe(report,{childList:true});
  window.addEventListener('beforeprint',tuneGatePrint);
})();
