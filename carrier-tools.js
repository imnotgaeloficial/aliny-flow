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
  function printLogo(carrier) {
    var api = window.alinyCarriers;
    var src = api && api.logo(carrier);
    if (!src) { alert('Cadastre primeiro a logo de ' + carrier + '.'); return; }
    var sheet = document.getElementById('afCarrierPrintSheet');
    sheet.replaceChildren();
    var img = document.createElement('img');
    img.src = src;
    img.alt = 'Logo da transportadora ' + carrier;
    sheet.appendChild(img);
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
    Promise.resolve(typeof img.decode === 'function' ? img.decode().catch(function(){}) : null)
      .then(function() { return window.print(); })
      .catch(function(e) { reset(); alert('Falha ao abrir a impressão: ' + e.message); });
  }
  function renderCarriers() {
    var api = window.alinyCarriers;
    if (!api) return;
    carrierNames = api.list();
    var text = normalize(document.getElementById('afCarrierSearch').value);
    var matches = carrierNames.map(function(name, index){ return {name:name,index:index}; })
      .filter(function(item){ return normalize(item.name).includes(text); });
    document.getElementById('afCarrierCount').textContent =
      matches.length + ' transportadora(s) • ' + (api.mode()==='demo' ? 'modo demonstração' : 'relatório importado') + ' + logos cadastradas';
    document.getElementById('afCarrierList').innerHTML = matches.map(function(item) {
      var src = api.logo(item.name);
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
    document.getElementById('afSelectedCarrierPrint').disabled = !api.logo(selection);
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
      '@media print{body[data-print="carrier-logo"] .shell,body[data-print="carrier-logo"] #toast,body[data-print="carrier-logo"] #authGate,body[data-print="carrier-logo"] #printWatermark{display:none!important}',
      'body[data-print="carrier-logo"] #afCarrierPrintSheet{display:flex!important;align-items:center;justify-content:center;background:white!important;width:100%;height:250mm;overflow:hidden;page-break-after:avoid}',
      'body[data-print="carrier-logo"] #afCarrierPrintSheet img{display:block!important;width:auto;height:auto;max-width:180mm;max-height:225mm;object-fit:contain;page-break-inside:avoid}}'
    ].join('');
    document.head.appendChild(style);
    var listPanel = document.createElement('div');
    listPanel.className = 'panel af-carrier-tools hideprint';
    listPanel.innerHTML = '<h2>Transportadoras e impressão individual</h2>' +
      '<p>Lista das transportadoras do relatório carregado e das logos cadastradas. Clique em <b>Imprimir só a logo</b> para imprimir uma folha sem informações de gates.</p>' +
      '<div class="toolbar"><input id="afCarrierSearch" type="search" placeholder="Buscar transportadora" aria-label="Buscar transportadora">' +
      '<button type="button" class="btn primary" id="afSelectedCarrierPrint">Imprimir logo selecionada</button></div>' +
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
