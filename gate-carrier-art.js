/* AlinyFlow — arte individual por transportadora para gates não assinados.
   Apenas apresentação de impressão; nenhuma alteração no Excel, totais ou banco. */
(function(){
'use strict';
function element(tag, className, value){
  var el=document.createElement(tag);
  if(className)el.className=className;
  if(value!==undefined)el.textContent=String(value);
  return el;
}
function themeFor(name){
  var colors=['#5e3c94','#155a86','#116c67','#9a4c62','#755293','#89622b','#394a82'];
  var hash=0;
  for(var i=0;i<name.length;i++)hash=((hash*31+name.charCodeAt(i))>>>0);
  return colors[hash%colors.length];
}
function acronym(name){
  var tokens=name.replace(/\b(LTDA|EIRELI|S A|ME|LOGISTICA|TRANSPORTES|TRANSPORTE)\b/gi,'').trim().split(/\s+/);
  return (tokens.slice(0,2).map(function(w){return w.slice(0,1)}).join('')||name.slice(0,2)).toUpperCase();
}
function signature(){
  var section=element('section','af-carrier-sign');
  section.append(element('p','af-sign-title','CONFERÊNCIA DA TRANSPORTADORA'));
  var sign=element('div','af-sign-rule');
  sign.setAttribute('aria-hidden','true');
  section.append(sign);
  section.append(element('p','af-sign-helper','Assinatura do conferente'));
  var info=element('p','af-sign-details','Nome: ___________________________________   Data: ____/____/________   Hora: ____:____');
  section.append(info);
  return section;
}
function makeArt(group,thead,stamp,filterLabel,title){
  var page=element('article','af-carrier-page');
  page.style.setProperty('--af-accent',themeFor(group.name));
  page.setAttribute('aria-label','Folha de '+title.toLowerCase()+' da transportadora '+group.name);
  var top=element('div','af-carrier-topline');
  top.append(element('span',null,'ALINY FLOW  •  CONTROLE LOGÍSTICO'));
  top.append(element('span',null,'EXPEDIÇÃO  /  CONFERÊNCIA'));
  page.append(top);
  var hero=element('header','af-carrier-hero');
  var heading=element('div','af-carrier-heading');
  heading.append(element('span','af-carrier-kicker','RELATÓRIO POR TRANSPORTADORA'));
  heading.append(element('h2','af-carrier-title',title));
  heading.append(element('p','af-carrier-name',group.name));
  hero.append(heading);
  var mark=element('div','af-carrier-brand');
  if(group.logo){
    var img=document.createElement('img');
    img.src=group.logo;
    img.alt='Logo cadastrada da transportadora '+group.name;
    img.className='af-carrier-brand-logo';
    mark.append(img);
  } else {
    mark.append(element('div','af-carrier-monogram',acronym(group.name)));
    mark.append(element('small','af-no-logo','LOGO NÃO CADASTRADA'));
  }
  hero.append(mark);
  page.append(hero);
  var ornaments=element('div','af-carrier-ornaments');
  ornaments.setAttribute('aria-hidden','true');
  ornaments.append(element('span',null,'✦'));
  ornaments.append(element('span',null,'──────────  ◇  ──────────'));
  ornaments.append(element('span',null,'✧'));
  page.append(ornaments);
  var watermark=element('div','af-carrier-watermark',acronym(group.name));
  watermark.setAttribute('aria-hidden','true');
  page.append(watermark);
  var counts=element('div','af-carrier-metrics');
  counts.append(element('div','af-carrier-metric','REGISTROS NA FOLHA: '+group.rows.length));
  counts.append(element('div','af-carrier-metric','SITUAÇÃO: '+filterLabel));
  counts.append(element('div','af-carrier-metric','GERADO: '+new Date().toLocaleDateString('pt-BR')));
  page.append(counts);
  var note=element('p','af-carrier-source',stamp);
  page.append(note);
  var table=element('table','af-carrier-table');
  table.append(thead.cloneNode(true));
  var tbody=document.createElement('tbody');
  group.rows.forEach(function(row){tbody.append(row.cloneNode(true))});
  table.append(tbody);
  page.append(table);
  var disclaimer=element('p','af-carrier-disclaimer','Status conforme a última planilha importada. Confira os manifestos no Wiser antes de concluir a assinatura.');
  page.append(disclaimer);
  page.append(signature());
  var foot=element('footer','af-carrier-foot');
  foot.append(element('span',null,'ALINYFLOW  ✦  ORGANIZAÇÃO E CONFERÊNCIA'));
  foot.append(element('span',null,'DOCUMENTO OPERACIONAL'));
  page.append(foot);
  return page;
}
/* A arte aprovada fica intacta numa capa A4; os dados da transportadora
   ficam nas páginas seguintes, sem cobrir o desenho original. */
var artAssets={
  no:'./assets/gates-nao-assinados-original.webp',
  yes:'./assets/gates-assinados-original.webp'
};
var printSnapshot=null;
function makeOriginalCover(status){
  var cover=element('section','af-original-cover');
  cover.setAttribute('aria-label',status==='no'?'Arte original: gates não assinados':'Arte original: gates assinados');
  var img=document.createElement('img');
  img.src=artAssets[status];
  img.alt=status==='no'?'AlinyFlow — Gates não assinados, arte anime original':'AlinyFlow — Gates assinados, arte anime original';
  cover.append(img);
  return cover;
}
function restoreCarrierArt(){
  if(!printSnapshot)return;
  var snapshot=printSnapshot;
  printSnapshot=null;
  if(snapshot.report && snapshot.report.classList.contains('af-branded')){
    snapshot.report.replaceChildren.apply(snapshot.report,snapshot.nodes);
    snapshot.report.classList.remove('af-branded');
  }
}
function prepareCarrierArt(){
  var body=document.body;
  if(!body||body.dataset.print!=='gates')return;
  var status=document.getElementById('gStatus');
  if(!status||(status.value!=='no'&&status.value!=='yes'))return;
  var report=document.getElementById('gatePrintReport');
  if(!report||report.classList.contains('af-branded'))return;
  var table=report.querySelector('table'),thead=table&&table.querySelector('thead');
  if(!thead)return;
  var trs=Array.from(table.querySelectorAll('tbody > tr'));
  var groups=[],current=null;
  trs.forEach(function(tr){
    if(tr.classList.contains('carrier-title')){
      var c=tr.querySelector('.print-carrier'),nameNode=c&&c.querySelector('span');
      var name=nameNode?nameNode.textContent.trim():'';
      if(!name){current=null;return;}
      var carrierImage=c.querySelector('img.print-carrier-logo');
      current={name:name,logo:carrierImage?carrierImage.src:'',rows:[]};
      groups.push(current);
    }else if(current){current.rows.push(tr);}
  });
  var filtered=groups.filter(function(g){return g.rows.length>0;});
  if(!filtered.length)return;
  var stamp=(document.getElementById('importStamp')||{}).textContent||'';
  var signed=status.value==='yes';
  var title=signed?'GATES ASSINADOS':'GATES NÃO ASSINADOS';
  var pages=[makeOriginalCover(status.value)];
  filtered.forEach(function(g){
    pages.push(makeArt(g,thead,stamp,signed?'ASSINADO':'NÃO ASSINADO',title));
  });
  printSnapshot={report:report,nodes:Array.from(report.childNodes)};
  report.replaceChildren.apply(report,pages);
  report.classList.add('af-branded');
}
function init(){
  var style=document.createElement('style');
  style.id='af-carrier-art-style';
  style.textContent=[
    '#gatePrintReport .af-carrier-page,#gatePrintReport .af-original-cover{display:none}',
    '@page afCarrierGates{size:A4 portrait;margin:0}',
    '@media print{',
    'body[data-print="gates"] #printWatermark{display:none!important}',
    '#gatePrintReport.af-branded .af-original-cover{display:block!important;width:210mm!important;height:297mm!important;max-width:none!important;overflow:hidden;break-after:page;page-break-after:always;background:#fff!important;padding:0!important;margin:0!important;box-sizing:border-box!important}',
    '#gatePrintReport.af-branded .af-original-cover img{display:block!important;width:210mm!important;height:297mm!important;max-width:none!important;object-fit:fill!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}',
    'body[data-print="gates"] #gatePrintReport.af-branded{display:block!important;width:100%;max-width:none!important;page:afCarrierGates!important;padding:0!important;margin:0!important}',
    '#gatePrintReport.af-branded .af-carrier-page{display:block!important;position:relative;isolation:isolate;break-after:page;page-break-after:always;padding:8mm 11mm 10mm;color:#1c1b23;background:white;min-height:297mm;box-sizing:border-box}',
    '#gatePrintReport.af-branded .af-carrier-page:last-child{break-after:auto;page-break-after:auto}',
    '#gatePrintReport .af-carrier-page *{box-sizing:border-box}',
    '#gatePrintReport .af-carrier-topline,#gatePrintReport .af-carrier-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:7px;letter-spacing:1px;color:#55506a;font-weight:700}',
    '#gatePrintReport .af-carrier-topline{border-top:2px solid var(--af-accent);padding:6mm 1mm 3mm}',
    '#gatePrintReport .af-carrier-hero{display:flex;align-items:center;justify-content:space-between;min-height:43mm;padding:5mm 6mm;margin-bottom:3mm;border:2px solid var(--af-accent);border-left:6mm solid var(--af-accent);border-radius:5mm;background:#faf8fd;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '#gatePrintReport .af-carrier-heading{min-width:0;max-width:75%}',
    '#gatePrintReport .af-carrier-kicker{display:block;font-size:8px;font-weight:800;letter-spacing:1.4px;color:var(--af-accent);margin-bottom:3mm}',
    '#gatePrintReport .af-carrier-hero .af-carrier-title{font-family:Arial,sans-serif;font-weight:900;font-size:22px;line-height:1.08;letter-spacing:.2px;color:#21182c;margin:0 0 3mm!important}',
    '#gatePrintReport .af-carrier-name{font-size:13px;line-height:1.25;overflow-wrap:anywhere;font-weight:800;color:var(--af-accent);margin:0}',
    '#gatePrintReport .af-carrier-brand{display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;width:36mm;min-height:27mm;padding:2mm;border:1px solid #d5cfe0;border-radius:3mm;background:white}',
    '#gatePrintReport .af-carrier-brand-logo{display:block;width:31mm;height:22mm;object-fit:contain}',
    '#gatePrintReport .af-carrier-monogram{font-size:24px;line-height:1.2;font-weight:900;color:var(--af-accent)}',
    '#gatePrintReport .af-no-logo{font-size:5px;color:#595367;text-align:center;letter-spacing:.4px}',
    '#gatePrintReport .af-carrier-ornaments{display:flex;justify-content:center;align-items:center;gap:6mm;color:var(--af-accent);font-size:12px;margin-bottom:5mm;opacity:.8}',
    '#gatePrintReport .af-carrier-watermark{position:absolute;z-index:-1;top:82mm;right:0;font-size:120px;line-height:1;font-weight:900;letter-spacing:-12px;color:var(--af-accent);opacity:.075;transform:rotate(-13deg);pointer-events:none}',
    '#gatePrintReport .af-carrier-metrics{display:flex;justify-content:space-between;gap:2mm;flex-wrap:wrap;margin:0 0 4mm}',
    '#gatePrintReport .af-carrier-metric{display:block;padding:3mm 4mm;border:1px solid var(--af-accent);border-radius:2mm;color:#292338;font-size:8px;font-weight:800;min-width:25%}',
    '#gatePrintReport .af-carrier-source{font-size:8px;color:#555;margin:0 0 4mm;overflow-wrap:anywhere}',
    '#gatePrintReport .af-carrier-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}',
    '#gatePrintReport .af-carrier-table thead{display:table-header-group}',
    '#gatePrintReport .af-carrier-table th{background:#ede6f7!important;color:#21182c!important;font-size:8px;padding:8px 5px;border:1px solid #9c8daf}',
    '#gatePrintReport .af-carrier-table td{font-size:8px;line-height:1.35;padding:8px 5px;border:1px solid #b4aabb;overflow-wrap:anywhere;white-space:normal;vertical-align:top}',
    '#gatePrintReport .af-carrier-table tr{break-inside:avoid;page-break-inside:avoid}',
    '#gatePrintReport .af-carrier-table .manual{min-height:26px;height:26px}',
    '#gatePrintReport .af-carrier-disclaimer{font-size:8px;color:#56505c;line-height:1.45;margin:5mm 0}',
    '#gatePrintReport .af-carrier-sign{position:relative;break-inside:avoid;page-break-inside:avoid;border:1px solid #ac99bf;border-radius:3mm;padding:4mm 5mm;margin-top:6mm}',
    '#gatePrintReport .af-sign-title{color:var(--af-accent);font-weight:900;letter-spacing:1px;font-size:9px;margin:0 0 3mm}',
    '#gatePrintReport .af-sign-rule{height:12mm;width:88mm;max-width:100%;border-bottom:1px solid #4d4457}',
    '#gatePrintReport .af-sign-helper{font-size:8px;color:#413748;margin:1mm 0 3mm}',
    '#gatePrintReport .af-sign-details{font-size:9px;color:#27222e;margin:0 0 1mm;line-height:1.8}',
    '#gatePrintReport .af-carrier-foot{border-top:1px solid var(--af-accent);padding-top:4mm;margin-top:7mm}',
    '}'
  ].join('');
  document.head.append(style);
  /* Carrega as capas cedo para a prévia de impressão não ficar vazia. */
  Object.keys(artAssets).forEach(function(status){var preview=new Image();preview.src=artAssets[status];});
  window.addEventListener('beforeprint',prepareCarrierArt);
  window.addEventListener('afterprint',restoreCarrierArt);
}
if(window.alinyAuth&&window.alinyAuth.ready){
  window.alinyAuth.ready.then(init).catch(function(){});
}else{
  document.addEventListener('DOMContentLoaded',init,{once:true});
}
})();
