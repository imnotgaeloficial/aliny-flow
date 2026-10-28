/* AlinyFlow — recuperação automática e conservadora de logos (2026-10-27).
   Prefere logos já incorporadas ao próprio app; só usa Wikidata/Commons com nome correspondente. */
(function () {
  'use strict';
  function clean(s) { return String(s || '').trim().replace(/\s+/g, ' '); }
  function norm(s) { return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function businessName(s) { return norm(s).replace(/\s+(?:LTDA|LIMITADA|SA|S A|EIRELI|ME|EPP)$/g, '').trim(); }
  function valid(src) { return typeof src === 'string' && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(src) || /^https:\/\//i.test(src)); }
  var bundledPromise;
  function bundled() {
    if (!bundledPromise) bundledPromise = fetch('./index.html', {cache:'force-cache'})
      .then(function(r) { if (!r.ok) throw new Error('Site indisponível'); return r.text(); })
      .then(function(html) {
        var m = /<script\b(?=[^>]*\bid\s*=\s*["']embeddedLogos["'])[^>]*>([\s\S]*?)<\/script>/i.exec(html);
        if (!m) return {};
        var obj = JSON.parse(m[1]);
        var data = obj && obj.logos;
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
      }).catch(function() { return {}; });
    return bundledPromise;
  }
  function api(url) {
    return fetch(url, {mode:'cors', credentials:'omit'})
      .then(function(r) { if (!r.ok) throw new Error('Consulta indisponível'); return r.json(); });
  }
  function wdUrl(params, domain) {
    return 'https://' + domain + '/w/api.php?' + new URLSearchParams(Object.assign({format:'json',origin:'*'},params)).toString();
  }
  async function commonsLogo(name) {
    var full = norm(name), short = businessName(name);
    if (short.length < 5) return null;
    var queries = [clean(name)];
    if (short !== full) queries.push(clean(name).replace(/\s+(?:LTDA|LIMITADA|S\.?A\.?|EIRELI|ME|EPP)\s*$/i, ''));
    var matches = [];
    for (var q=0; q<queries.length && !matches.length; q++) {
      var found = await api(wdUrl({action:'wbsearchentities',search:queries[q],language:'pt',uselang:'pt',limit:'8'},'www.wikidata.org'));
      matches = (found.search || []).filter(function(x) {
        return [x.label, x.match && x.match.text].some(function(value) {
          var n = businessName(value);
          return n && (n === short || n === full);
        });
      });
    }
    if (!matches.length) return null;
    // Verifica o identificador da entidade antes de pedir a imagem: não escolhe a primeira imagem de uma busca genérica.
    for (var i=0; i<Math.min(matches.length,3); i++) {
      var id = matches[i].id;
      if (!/^Q\d+$/.test(id)) continue;
      var data = await api(wdUrl({action:'wbgetentities',ids:id,props:'claims|labels|aliases',languages:'pt|en'},'www.wikidata.org'));
      var entity = data.entities && data.entities[id];
      if (!entity || !entity.claims || !entity.claims.P154) continue;
      var names = [].concat(Object.values(entity.labels || {}).map(function(x) { return x.value; }),
        Object.values(entity.aliases || {}).flat().map(function(x) { return x.value; }));
      if (!names.some(function(value) { var n=businessName(value); return n && (n===short || n===full); })) continue;
      var claim = entity.claims.P154.find(function(c) {
        return c.mainsnak && c.mainsnak.datavalue && typeof c.mainsnak.datavalue.value === 'string';
      });
      if (!claim) continue;
      var file = claim.mainsnak.datavalue.value;
      var imageData = await api(wdUrl({action:'query',titles:'File:'+file,prop:'imageinfo',iiprop:'url',iiurlwidth:'1200'},'commons.wikimedia.org'));
      var pages = Object.values(imageData.query && imageData.query.pages || {});
      var info = pages.length && pages[0].imageinfo && pages[0].imageinfo[0];
      var url = info && (info.thumburl || info.url);
      if (valid(url) && !/\.(?:svg)(?:$|\?)/i.test(url)) return {src:url,source:'Wikimedia Commons'};
      // SVG também é exibível em <img> quando vem de arquivo já hospedado em HTTPS.
      if (valid(url)) return {src:url,source:'Wikimedia Commons'};
    }
    return null;
  }
  window.afAutoLogos = {bundled:bundled, lookup:commonsLogo, norm:norm, businessName:businessName};
})();