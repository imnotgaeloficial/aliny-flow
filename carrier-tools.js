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
        var tab = document.querySelector('[data-page="logos"]');
        if (tab) tab.click();
        else {
          var logosPage = document.getElementById('logos');
          if (logosPage) {
            document.querySelectorAll('[id="dashboard"],[id="gates"],[id="logos"]').forEach(function(p) { p.hidden = p !== logosPage; });
            logosPage.scrollIntoView({block:'start'});
          }
        }
      });
      shortcut.appendChild(copy);
      shortcut.appendChild(action);
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
