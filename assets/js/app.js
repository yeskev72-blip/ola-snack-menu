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
      const wa = !!p.whatsapp;
      box.append(el('a', {
        href: wa ? `https://wa.me/${p.whatsapp}` : `tel:${p.tel}`,
        className: wa ? 'wa' : '',
        target: wa ? '_blank' : '',
        rel: wa ? 'noopener' : '',
      }, [
        el('span', { textContent: p.display }),
        el('span', { className: 'op', textContent: wa ? `${p.label} · WhatsApp` : p.label }),
      ]));
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

    const send = $('[data-cart-send]');
    send.href = waLink();
    send.setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
  }

  function waLink() {
    const wa = (DATA?.restaurant.phones || []).find((p) => p.whatsapp);
    const lines = [`Bonjour ${DATA?.restaurant.name || ''}, je souhaite commander :`, ''];
    for (const l of cart.values()) {
      lines.push(`• ${l.qty} × ${l.name}${l.size ? ` (${l.size})` : ''} — ${money(l.price * l.qty)}`);
    }
    lines.push('', `Total : ${money(cartTotal())}`);
    const text = encodeURIComponent(lines.join('\n'));
    return wa ? `https://wa.me/${wa.whatsapp}?text=${text}` : `https://wa.me/?text=${text}`;
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
      const res = await fetch('data/menu.json');
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCart();
    });
  }

  init();
})();
