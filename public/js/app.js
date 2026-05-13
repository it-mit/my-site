'use strict';

document.addEventListener('DOMContentLoaded', function () {

  // ─────────────────────────────────────────── HELPERS
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  function lockScroll()   { document.body.style.overflow = 'hidden'; }
  function unlockScroll() { document.body.style.overflow = ''; }

  async function postJSON(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok && r.status === 404) throw new Error('API not found: ' + url);
    const text = await r.text();
    try { return JSON.parse(text); } catch { throw new Error('Bad response: ' + text.slice(0, 120)); }
  }

  // ─────────────────────────────────────────── TOAST
  const Toast = {
    container: qs('#toastContainer'),
    show(msg, type) {
      type = type || 'success';
      const t = document.createElement('div');
      t.className = 'toast toast-' + type;
      t.textContent = msg;
      this.container.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }
  };

  // ─────────────────────────────────────────── COOKIE BANNER
  (function initCookie() {
    const banner = qs('#cookieBanner');
    const btn    = qs('#cookieAccept');
    if (!banner) return;
    if (localStorage.getItem('cookie_ok')) {
      banner.classList.add('hidden-banner');
      return;
    }
    on(btn, 'click', function () {
      localStorage.setItem('cookie_ok', '1');
      banner.classList.add('hidden-banner');
    });
  })();

  // ─────────────────────────────────────────── HEADER — sticky + mobile menu
  const Header = {
    el:       qs('#header'),
    navWrap:  qs('#headerNavWrap'),
    burger:   qs('#burgerBtn'),
    menu:     qs('#mobileMenu'),
    isFixed:  false,
    threshold: 0,

    init() {
      if (!this.navWrap) return;
      this.threshold = this.navWrap.getBoundingClientRect().top + window.scrollY - 4;
      window.addEventListener('scroll', () => this.onScroll(), { passive: true });
      window.addEventListener('resize', () => {
        clearTimeout(this._rt);
        this._rt = setTimeout(() => {
          this.isFixed = false;
          this.navWrap.classList.remove('is-fixed');
          this.threshold = this.navWrap.getBoundingClientRect().top + window.scrollY - 4;
          this.onScroll();
        }, 120);
      });
      this.onScroll();

      on(this.burger, 'click', () => this.toggleMenu());

      // close mobile menu on nav link click
      qsa('.mobile-nav a, .mobile-contact .btn').forEach(a => {
        on(a, 'click', () => this.closeMenu());
      });
    },

    onScroll() {
      const past = window.scrollY >= this.threshold;
      if (past !== this.isFixed) {
        this.isFixed = past;
        this.navWrap.classList.toggle('is-fixed', past);
      }
    },

    toggleMenu() {
      const open = this.menu.classList.toggle('open');
      this.burger.classList.toggle('active', open);
      this.menu.setAttribute('aria-hidden', String(!open));
      this.burger.setAttribute('aria-expanded', String(open));
    },

    closeMenu() {
      this.menu.classList.remove('open');
      this.burger.classList.remove('active');
      this.menu.setAttribute('aria-hidden', 'true');
      this.burger.setAttribute('aria-expanded', 'false');
    }
  };
  Header.init();

  // ─────────────────────────────────────────── SMOOTH SCROLL
  on(document, 'click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = qs(id);
    if (!target) return;
    e.preventDefault();
    Header.closeMenu();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ─────────────────────────────────────────── HERO SLIDER
  const Hero = {
    bgs:     qsa('.hero-bg'),
    slides:  qsa('.hero-slide'),
    dots:    qsa('.hero-dot'),
    current: 0,
    timer:   null,
    delay:   5200,

    init() {
      if (!this.slides.length) return;
      this.dots.forEach((d, i) => on(d, 'click', () => { this.goto(i); this.restart(); }));
      this.start();
    },

    goto(i) {
      this.bgs[this.current]   && this.bgs[this.current].classList.remove('active');
      this.slides[this.current] && this.slides[this.current].classList.remove('active');
      this.dots[this.current]  && this.dots[this.current].classList.remove('active');
      this.current = i;
      this.bgs[i]   && this.bgs[i].classList.add('active');
      this.slides[i] && this.slides[i].classList.add('active');
      this.dots[i]  && this.dots[i].classList.add('active');
    },

    next()    { this.goto((this.current + 1) % this.slides.length); },
    start()   { this.timer = setInterval(() => this.next(), this.delay); },
    restart() { clearInterval(this.timer); this.start(); }
  };
  Hero.init();

  // ─────────────────────────────────────────── REVEAL ANIMATIONS
  (function initReveal() {
    const items = qsa('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('visible'));
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -44px 0px' });
    items.forEach(el => obs.observe(el));
  })();

  // ─────────────────────────────────────────── PRODUCTS CACHE
  let _products = null;
  async function loadProducts() {
    if (_products) return _products;
    try {
      const r = await fetch('/api/products');
      _products = await r.json();
    } catch { _products = []; }
    return _products;
  }

  // ─────────────────────────────────────────── SEARCH
  const Search = {
    modal:   qs('#searchModal'),
    input:   qs('#searchInput'),
    results: qs('#searchResults'),
    closeBtn: qs('#searchClose'),

    open() {
      this.modal.setAttribute('aria-hidden', 'false');
      lockScroll();
      setTimeout(() => this.input && this.input.focus(), 50);
      this.render([]);
    },

    close() {
      this.modal.setAttribute('aria-hidden', 'true');
      unlockScroll();
      if (this.input) this.input.value = '';
    },

    async query(q) {
      if (!q.trim()) { this.render([]); return; }
      const all = await loadProducts();
      const lq = q.toLowerCase();
      const res = all.filter(p =>
        (p.name || '').toLowerCase().includes(lq) ||
        (p.category || '').toLowerCase().includes(lq)
      );
      this.render(res, q);
    },

    render(items, q) {
      if (!this.results) return;
      if (!q || !items.length) {
        this.results.innerHTML = q
          ? '<p class="search-empty">Ничего не найдено по запросу «' + q + '»</p>'
          : '';
        return;
      }
      this.results.innerHTML = items.map(p => `
        <div class="search-result-item" data-id="${p.id}">
          <img src="${p.image}" alt="${p.name}" />
          <div>
            <div class="sr-name">${p.name}</div>
            <div class="sr-price">${p.price}</div>
          </div>
        </div>
      `).join('');
      qsa('.search-result-item', this.results).forEach(item => {
        on(item, 'click', () => {
          this.close();
          const target = qs('#popular') || qs('#catalog');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    },

    init() {
      on(qs('#searchBtn'), 'click', () => this.open());
      on(this.closeBtn, 'click', () => this.close());
      on(qs('[data-close="search"]', this.modal), 'click', () => this.close());

      let debounce;
      on(this.input, 'input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.query(this.input.value), 200);
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.modal.getAttribute('aria-hidden') === 'false') {
          this.close();
        }
      });
    }
  };
  Search.init();

  // ─────────────────────────────────────────── CART
  const Cart = {
    STORAGE_KEY: 'lumber_cart',
    sidebar:  qs('#cartSidebar'),
    backdrop: qs('#cartBackdrop'),
    body:     qs('#cartBody'),
    footer:   qs('#cartFooter'),
    countEl:  qs('#cartCount'),
    headerCountEl: qs('#cartHeaderCount'),
    items: [],

    load() {
      try { this.items = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; }
      catch { this.items = []; }
    },

    save() {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
    },

    add(product) {
      const existing = this.items.find(i => i.id === product.id);
      if (existing) { existing.qty += 1; }
      else { this.items.push({ ...product, qty: 1 }); }
      this.save();
      this.updateBadge();
      Toast.show('Товар добавлен в корзину', 'success');
    },

    remove(id) {
      this.items = this.items.filter(i => i.id !== id);
      this.save();
      this.updateBadge();
      this.render();
    },

    setQty(id, qty) {
      qty = Math.max(1, parseInt(qty) || 1);
      const item = this.items.find(i => i.id === id);
      if (item) { item.qty = qty; this.save(); this.render(); }
    },

    getTotal() {
      return this.items.reduce((s, i) => s + i.priceNum * i.qty, 0);
    },

    getCount() {
      return this.items.reduce((s, i) => s + i.qty, 0);
    },

    updateBadge() {
      const n = this.getCount();
      if (this.countEl) {
        this.countEl.textContent = n;
        this.countEl.classList.toggle('hidden', n === 0);
      }
      if (this.headerCountEl) {
        this.headerCountEl.textContent = n > 0 ? '(' + n + ')' : '';
      }
    },

    render() {
      if (!this.body) return;
      if (!this.items.length) {
        this.body.innerHTML = '<div class="cart-empty"><span>🪵</span><p>Корзина пуста</p></div>';
        if (this.footer) this.footer.innerHTML = '';
        return;
      }
      this.body.innerHTML = this.items.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price}</div>
            <div class="cart-qty">
              <button class="js-qty-minus" data-id="${item.id}" aria-label="Уменьшить">−</button>
              <span>${item.qty}</span>
              <button class="js-qty-plus" data-id="${item.id}" aria-label="Увеличить">+</button>
            </div>
          </div>
          <button class="cart-item-remove js-remove" data-id="${item.id}" aria-label="Удалить">×</button>
        </div>
      `).join('');

      const total = this.getTotal();
      if (this.footer) {
        this.footer.innerHTML = `
          <div class="cart-total">
            <span class="cart-total-label">Итого</span>
            <span class="cart-total-value">от ${total.toLocaleString('ru')} ₽</span>
          </div>
          <button class="btn btn-dark btn-full js-cart-order">Оформить заявку</button>
          <button class="btn btn-outline btn-full js-cart-continue" style="margin-top:8px">Продолжить покупки</button>
        `;
        on(qs('.js-cart-order', this.footer), 'click', () => {
          const list = this.items.map(i => `${i.name} × ${i.qty} (${i.price})`).join('\n');
          this.close();
          LeadForm.open('Корзина', 'Состав заказа:\n' + list);
        });
        on(qs('.js-cart-continue', this.footer), 'click', () => this.close());
      }

      // qty buttons & remove
      qsa('.js-qty-minus', this.body).forEach(b =>
        on(b, 'click', () => this.setQty(b.dataset.id, (this.items.find(i => i.id === b.dataset.id)?.qty || 1) - 1))
      );
      qsa('.js-qty-plus', this.body).forEach(b =>
        on(b, 'click', () => this.setQty(b.dataset.id, (this.items.find(i => i.id === b.dataset.id)?.qty || 1) + 1))
      );
      qsa('.js-remove', this.body).forEach(b =>
        on(b, 'click', () => this.remove(b.dataset.id))
      );
    },

    open() {
      this.render();
      this.sidebar.setAttribute('aria-hidden', 'false');
      this.backdrop.classList.add('open');
      lockScroll();
    },

    close() {
      this.sidebar.setAttribute('aria-hidden', 'true');
      this.backdrop.classList.remove('open');
      unlockScroll();
    },

    init() {
      this.load();
      this.updateBadge();
      on(qs('#cartBtn'), 'click', () => this.open());
      on(qs('#cartClose'), 'click', () => this.close());
      on(this.backdrop, 'click', () => this.close());
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.sidebar.getAttribute('aria-hidden') === 'false') this.close();
      });
    }
  };
  Cart.init();

  // ─────────────────────────────────────────── LEAD FORM
  const LeadForm = {
    popup:     qs('#leadPopup'),
    form:      qs('#leadForm'),
    titleEl:   qs('#leadTitle'),
    subtitleEl: qs('#leadSubtitle'),
    sourceEl:  qs('#leadSource'),
    productEl: qs('#leadProduct'),
    statusEl:  qs('#leadStatus'),
    submitBtn: null,

    open(source, comment) {
      if (!this.popup) return;
      if (this.sourceEl) this.sourceEl.value = source || '';
      if (this.subtitleEl) this.subtitleEl.textContent = source ? source : '';
      if (this.productEl) this.productEl.value = comment || '';

      const commentArea = qs('textarea[name="comment"]', this.form);
      if (commentArea && comment) commentArea.value = comment;

      this.clearStatus();
      this.popup.setAttribute('aria-hidden', 'false');
      lockScroll();
      setTimeout(() => {
        const first = qs('.form-field', this.form);
        if (first) first.focus();
      }, 60);
    },

    close() {
      if (!this.popup) return;
      this.popup.setAttribute('aria-hidden', 'true');
      unlockScroll();
    },

    clearStatus() {
      if (!this.statusEl) return;
      this.statusEl.textContent = '';
      this.statusEl.className = 'form-status';
    },

    setStatus(msg, type) {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      this.statusEl.className = 'form-status ' + (type || '');
    },

    async submit(e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(this.form));
      if (!data.name || !data.name.trim()) {
        this.setStatus('Пожалуйста, введите имя.', 'error');
        qs('[name="name"]', this.form)?.focus();
        return;
      }
      if (!data.phone || !data.phone.trim()) {
        this.setStatus('Пожалуйста, введите телефон.', 'error');
        qs('[name="phone"]', this.form)?.focus();
        return;
      }
      if (!data.policy) {
        this.setStatus('Необходимо согласие с политикой конфиденциальности.', 'error');
        return;
      }
      const btn = qs('[type="submit"]', this.form);
      if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }
      try {
        const res = await postJSON('/api/lead', { ...data, type: 'Заявка', page: location.href });
        if (res.success) {
          this.setStatus('Спасибо! Заявка отправлена. Мы свяжемся с вами в ближайшее время.', 'success');
          this.form.reset();
          Toast.show('Заявка отправлена!', 'success');
          setTimeout(() => this.close(), 2200);
        } else {
          this.setStatus('Ошибка отправки. Попробуйте ещё раз.', 'error');
        }
      } catch {
        this.setStatus('Ошибка соединения. Проверьте интернет и попробуйте снова.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Отправить заявку'; }
      }
    },

    init() {
      if (!this.popup) return;
      on(qs('#leadClose'), 'click', () => this.close());
      on(qs('[data-close="lead"]', this.popup), 'click', () => this.close());
      on(this.form, 'submit', e => this.submit(e));
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.popup.getAttribute('aria-hidden') === 'false') this.close();
      });
    }
  };
  LeadForm.init();

  // ─────────────────────────────────────────── "Заказать звонок" / "Получить расчёт" triggers
  on(document, 'click', function (e) {
    const trigger = e.target.closest('.js-open-lead');
    if (!trigger) return;
    const source  = trigger.dataset.source  || '';
    const product = trigger.dataset.product || '';
    const comment = product ? `Интересует: ${product}` : '';
    LeadForm.open(source, comment);
  });

  // ─────────────────────────────────────────── "В корзину" triggers
  on(document, 'click', function (e) {
    const btn = e.target.closest('.js-add-cart');
    if (!btn) return;
    const card = btn.closest('[data-id]');
    if (!card) return;
    Cart.add({
      id:       card.dataset.id,
      name:     card.dataset.name,
      price:    card.dataset.name + ' — ' + (card.dataset.price ? 'от ' + Number(card.dataset.price).toLocaleString('ru') + ' ₽/' + (card.dataset.unit || 'шт') : ''),
      priceNum: parseInt(card.dataset.price) || 0,
      unit:     card.dataset.unit || 'шт',
      image:    card.dataset.image || ''
    });
  });

  // ─────────────────────────────────────────── SUBSCRIBE FORM
  (function initSubscribe() {
    const form = qs('#subscribeForm');
    if (!form) return;
    on(form, 'submit', async function (e) {
      e.preventDefault();
      const email = (qs('input[name="email"]', form)?.value || '').trim();
      if (!email) { Toast.show('Введите e-mail', 'error'); return; }
      const btn = qs('button[type="submit"]', form);
      if (btn) { btn.disabled = true; btn.textContent = 'Отправляем...'; }
      try {
        const res = await postJSON('/api/lead', {
          type:  'Подписка на рассылку',
          email,
          page:  location.href,
          date:  new Date().toISOString()
        });
        if (res.success) {
          Toast.show('Спасибо! Вы подписаны на рассылку.', 'success');
          form.reset();
        } else {
          Toast.show('Ошибка. Попробуйте ещё раз.', 'error');
        }
      } catch {
        Toast.show('Ошибка соединения.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Подписаться'; }
      }
    });
  })();

  // ─────────────────────────────────────────── Delivery "Рассчитать" button fix (it's a button not a link)
  qsa('.js-open-lead').forEach(el => {
    if (el.tagName === 'BUTTON') on(el, 'click', function (e) { e.preventDefault(); });
  });

});
