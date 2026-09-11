/* Ola'Snack — rendu du menu, recherche et panier WhatsApp */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, props = {}, kids = []) => {
    const { dataset, ...rest } = props;
    const n = Object.assign(document.createElement(tag), rest);
    if (dataset) Object.assign(n.dataset, dataset);
    for (const k of [].concat(kids)) if (k != null) n.append(k);
    return n;
  };

  const WA_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97' +
    '-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48' +
    '-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5' +
    '.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37' +
    '-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62' +
    '.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.27-.2-.57-.35M12.05 21.79' +
    'a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26' +
    'c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99' +
    'c0 5.45-4.43 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89' +
    'c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.89' +
    'a11.82 11.82 0 0 0-3.48-8.41Z"/></svg>';

  let DATA = null;
  let SUFFIX = 'F';
  const cart = new Map();   // key -> { id, name, size, price, qty }

  const money = (n) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' ' + SUFFIX;

  /* ---------- en-tête ---------- */
  function renderHeader(r) {
    $('[data-tagline]').textContent = r.tagline || '';
    $('[data-address]').textContent = r.address || '';
    if (r.logo) $('.logo').src = r.logo;

    const box = $('[data-phones]');
    box.textContent = '';
    for (const p of r.phones || []) {
      // un numéro joignable sur WhatsApp ouvre la discussion ; sinon il compose l'appel
      const link = el('a', {
        href: p.whatsapp ? `https://wa.me/${p.whatsapp}` : `tel:${p.tel}`,
        className: p.whatsapp ? 'wa' : '',
        title: p.whatsapp ? `Écrire au ${p.display} sur WhatsApp` : `Appeler le ${p.display}`,
      });
      if (p.whatsapp) {
        link.append(el('span', { className: 'wa-ico', innerHTML: WA_ICON, ariaHidden: 'true' }));
      }
      link.append(
        el('span', { textContent: p.display }),
        // sur mobile il n'y a pas de survol : le canal doit se lire dans le libellé
        el('span', { className: 'op', textContent: p.whatsapp ? `${p.label} · WhatsApp` : p.label }),
      );
      box.append(link);
    }
  }

  /* ---------- navigation par catégorie ---------- */
  function renderNav(cats) {
    const nav = $('[data-catnav]');
    nav.textContent = '';
    for (const c of cats) {
      nav.append(el('a', { href: `#cat-${c.id}`, textContent: c.name, dataset: { cat: c.id } }));
    }
  }

  /* ---------- une ligne de plat ---------- */
  function priceBlock(item) {
    const buy = el('div', { className: 'buy' });

    if (item.prices) {
      const sizes = el('div', { className: 'sizes' });
      for (const [code, val] of Object.entries(item.prices)) {
        sizes.append(el('div', { className: 'sizerow' }, [
          el('span', { className: 'tag', textContent: code, title: (DATA.sizes || {})[code] || code }),
          el('span', { className: 'price', textContent: money(val) }),
          addButton(item, code, val),
        ]));
      }
      buy.append(sizes);
      return buy;
    }

    const price = el('span', { className: 'price', textContent: money(item.price) });
    if (item.priceAlt) price.append(el('span', { className: 'alt', textContent: ` / ${money(item.priceAlt)}` }));
    buy.append(price, addButton(item, null, item.price));
    return buy;
  }

  function addButton(item, size, price) {
    const label = size ? `Ajouter ${item.name} (${size})` : `Ajouter ${item.name}`;
    const b = el('button', {
      type: 'button', className: 'add', textContent: '+',
      title: label, ariaLabel: label,
    });
    b.addEventListener('click', () => addToCart(item, size, price));
    return b;
  }

  const PLACEHOLDER =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10"/>' +
    '<path d="M17 3c-1.5 1.5-2 3.5-2 5.5 0 1.4.6 2.5 2 2.5V3zM17 11v10"/>' +
    '</svg>';

  function renderItem(item) {
    const li = el('li', { className: 'item', dataset: { id: item.id } });

    if (item.image) {
      li.append(el('img', {
        className: 'thumb', src: item.image, alt: item.name,
        loading: 'lazy', decoding: 'async', width: 68, height: 68,
      }));
    } else {
      li.append(el('div', {
        className: 'thumb thumb-ph', innerHTML: PLACEHOLDER,
        title: 'Pas de photo sur le menu d\u2019origine', ariaHidden: 'true',
      }));
    }

    const h = el('h3', { textContent: item.name });
    if (item.unconfirmed) h.append(el('span', { className: 'flag', textContent: 'à confirmer' }));

    const body = el('div', {}, [h]);
    if (item.description) body.append(el('p', { className: 'desc', textContent: item.description }));

    li.append(body, priceBlock(item));
    return li;
  }

  function renderMenu(cats) {
    const main = $('[data-menu]');
    main.textContent = '';

    for (const c of cats) {
      const sec = el('section', { className: 'cat', id: `cat-${c.id}` });
      sec.append(el('div', { className: 'cat-head' }, [
        el('h2', { textContent: c.name }),
        el('span', { className: 'n', textContent: `${c.items.length} article${c.items.length > 1 ? 's' : ''}` }),
      ]));

      if (c.image) {
        sec.append(el('img', {
          className: 'cat-banner', src: c.image, alt: c.name,
          loading: 'lazy', decoding: 'async',
        }));
      }
      if (c.note) sec.append(el('p', { className: 'cat-note', textContent: c.note }));

      const ul = el('ul', { className: 'items' });
      for (const it of c.items) ul.append(renderItem(it));
      sec.append(ul);
      main.append(sec);
    }
  }

  /* ---------- recherche ---------- */
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function applySearch(raw) {
    const terms = norm(raw).split(/\s+/).filter(Boolean);
    const counter = $('[data-count]');
    $('[data-clear]').hidden = !raw;

    if (!terms.length) {
      for (const n of document.querySelectorAll('.item, .cat')) n.hidden = false;
      $('.empty')?.remove();
      counter.textContent = '';
      return;
    }

    let shown = 0;
    for (const sec of document.querySelectorAll('.cat')) {
      const catName = norm(sec.querySelector('h2').textContent);
      let visible = 0;
      for (const li of sec.querySelectorAll('.item')) {
        const hay = catName + ' ' + norm(li.textContent);
        const hit = terms.every((t) => hay.includes(t));
        li.hidden = !hit;
        if (hit) visible++;
      }
      sec.hidden = visible === 0;
      shown += visible;
    }

    counter.textContent = shown
      ? `${shown} article${shown > 1 ? 's' : ''} trouvé${shown > 1 ? 's' : ''}`
      : '';

    $('.empty')?.remove();
    if (!shown) {
      $('[data-menu]').append(el('p', {
        className: 'empty', textContent: `Aucun article ne correspond à « ${raw} ».`,
      }));
    }
  }

  /* ---------- panier ---------- */
  const keyOf = (item, size) => item.id + (size ? '|' + size : '');

  function addToCart(item, size, price) {
    const key = keyOf(item, size);
    const line = cart.get(key);
    if (line) line.qty++;
    else cart.set(key, { id: item.id, name: item.name, size, price, qty: 1 });
    drawCart();
  }

  function setQty(key, delta) {
    const line = cart.get(key);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) cart.delete(key);
    drawCart();
  }

  const cartTotal = () => [...cart.values()].reduce((s, l) => s + l.price * l.qty, 0);
  const cartCount = () => [...cart.values()].reduce((s, l) => s + l.qty, 0);

  function drawCart() {
    const n = cartCount();
    const total = cartTotal();

    const fab = $('[data-cart-open]');
    fab.hidden = n === 0;
    $('[data-cart-count]').textContent = n;
    $('[data-cart-fab-total]').textContent = money(total);

    const ul = $('[data-cart-lines]');
    ul.textContent = '';

    if (!n) {
      ul.append(el('li', { className: 'cart-empty', textContent: 'Votre commande est vide.' }));
      closeCart();
    } else {
      for (const [key, l] of cart) {
        const minus = el('button', { type: 'button', textContent: '−', ariaLabel: `Retirer un ${l.name}` });
        const plus = el('button', { type: 'button', textContent: '+', ariaLabel: `Ajouter un ${l.name}` });
        minus.addEventListener('click', () => setQty(key, -1));
        plus.addEventListener('click', () => setQty(key, +1));

        const sub = [l.size ? `${l.size} · ` : '', money(l.price), ' × ', String(l.qty), ' = ', money(l.price * l.qty)].join('');
        ul.append(el('li', {}, [
          el('div', {}, [
            el('div', { className: 'nm', textContent: l.name }),
            el('div', { className: 'sub', textContent: sub }),
          ]),
          el('div', { className: 'qty' }, [minus, el('span', { textContent: String(l.qty) }), plus]),
        ]));
      }
    }

    $('[data-cart-total]').textContent = money(total);

    const links = orderLinks();
    const wa = $('[data-cart-wa]');
    wa.hidden = !links.whatsapp;
    if (links.whatsapp) wa.href = links.whatsapp;
    $('[data-cart-call]').href = links.call;
    $('[data-cart-sms]').href = links.sms;
    for (const sel of ['[data-cart-call]', '[data-cart-sms]', '[data-cart-wa]']) {
      $(sel).setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
    }
  }

  function orderSummary() {
    const lines = [`Bonjour ${DATA?.restaurant.name || ''}, je souhaite commander :`, ''];
    for (const l of cart.values()) {
      lines.push(`• ${l.qty} × ${l.name}${l.size ? ` (${l.size})` : ''} — ${money(l.price * l.qty)}`);
    }
    lines.push('', `Total : ${money(cartTotal())}`);
    return lines.join('\n');
  }

  /* Canal de commande : piloté par « ordering » dans menu.json.
     Si un jour le restaurant ouvre un compte WhatsApp, il suffit d'y renseigner
     « whatsapp » pour que le bouton correspondant réapparaisse. */
  function orderLinks() {
    const o = DATA?.ordering || {};
    const tel = o.tel || DATA?.restaurant.phones?.[0]?.tel || '';
    const text = orderSummary();
    return {
      call: `tel:${tel}`,
      sms: `sms:${tel}?body=${encodeURIComponent(text)}`,
      whatsapp: o.whatsapp ? `https://wa.me/${o.whatsapp}?text=${encodeURIComponent(text)}` : null,
    };
  }

  async function copySummary(btn) {
    const text = orderSummary();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard indisponible (http, permission refusée) : sélection manuelle
      const ta = el('textarea', { value: text, style: 'position:fixed;opacity:0' });
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* rien de plus à tenter */ }
      ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = 'Commande copiée';
    setTimeout(() => { btn.textContent = old; }, 1800);
  }

  function openCart() {
    $('[data-cart]').hidden = false;
    $('[data-cart-backdrop]').hidden = false;
    $('[data-cart-open]').hidden = true;
    $('[data-cart-close]').focus();
  }
  function closeCart() {
    $('[data-cart]').hidden = true;
    $('[data-cart-backdrop]').hidden = true;
    $('[data-cart-open]').hidden = cartCount() === 0;
  }

  /* ---------- catégorie active dans la nav ---------- */
  function watchSections() {
    const links = new Map(
      [...document.querySelectorAll('.catnav a')].map((a) => [a.dataset.cat, a])
    );
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = e.target.id.replace(/^cat-/, '');
        for (const a of links.values()) a.classList.remove('on');
        links.get(id)?.classList.add('on');
      }
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const s of document.querySelectorAll('.cat')) io.observe(s);
  }

  /* ---------- démarrage ---------- */
  async function init() {
    try {
      // no-cache force la revalidation auprès du serveur : sans cela un navigateur
      // peut resservir un menu.json périmé (prix, numéros) longtemps après une mise à jour
      const res = await fetch('data/menu.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      DATA = await res.json();
    } catch (err) {
      $('[data-menu]').innerHTML =
        '<p class="err">Impossible de charger le menu. ' +
        'Si vous avez ouvert le fichier directement, lancez un serveur local ' +
        '(<code>python3 -m http.server</code>) puis rechargez la page.</p>';
      console.error(err);
      return;
    }

    SUFFIX = DATA.currency?.suffix || 'F';
    renderHeader(DATA.restaurant);
    renderNav(DATA.categories);
    renderMenu(DATA.categories);
    watchSections();
    drawCart();

    document.title = `${DATA.restaurant.name} — Menu`;
    if (DATA.ordering?.note) $('.cart-hint').textContent = DATA.ordering.note;
    $('[data-foot-note]').textContent = DATA.source?.note || '';
    $('[data-foot-src]').textContent = DATA.source?.document
      ? `Source : ${DATA.source.document}`
      : '';

    const q = $('#q');
    let t;
    q.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => applySearch(q.value.trim()), 120);
    });
    $('[data-clear]').addEventListener('click', () => {
      q.value = '';
      applySearch('');
      q.focus();
    });

    $('[data-cart-open]').addEventListener('click', openCart);
    $('[data-cart-close]').addEventListener('click', closeCart);
    $('[data-cart-backdrop]').addEventListener('click', closeCart);
    $('[data-cart-clear]').addEventListener('click', () => { cart.clear(); drawCart(); });
    $('[data-cart-copy]').addEventListener('click', (e) => copySummary(e.currentTarget));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCart();
    });
  }

  init();
})();
