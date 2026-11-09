/* Totli baliq - admin paneli (v5.1) */
'use strict';
/* Totli baliq — admin paneli: statistika, buyurtmalar, menyu, adminlar, profil. */
const Admin = (function () {
  let C = null, view = null, tab = 'stats', orders = [], seenMax = 0, timer = null, filter = { status: 'all', day: 'today', q: '' };
  const STATUS = { yangi: 'Yangi', tasdiqlandi: 'Tasdiqlandi', tayyor: 'Tayyor', bajarildi: 'Bajarildi', bekor: 'Bekor qilindi' };
  const TABS = [['stats', 'Statistika'], ['orders', 'Buyurtmalar'], ['menu', 'Menyu'], ['admins', 'Adminlar'], ['me', 'Profil']];
  const WD = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

  function stop() { clearInterval(timer); timer = null; }
  function render(v, ctx) {
    C = ctx; view = v;
    if (!C.Auth.token) return loginView();
    dashboard();
  }

  /* ---------- Kirish ---------- */
  function loginView() {
    const { h } = C, err = h('p', { class: 'error', role: 'alert' });
    const phone = h('input', { type: 'tel', inputMode: 'numeric', autocomplete: 'username', placeholder: '90 123 45 67', id: 'aphone' });
    const pin = h('input', { type: 'password', inputMode: 'numeric', autocomplete: 'current-password', placeholder: 'Parol (6 ta raqam)', id: 'apin', maxLength: 10 });
    const btn = h('button', { type: 'submit', class: 'btn big' }, 'Kirish');
    const form = h('form', { class: 'panel loginbox', novalidate: true },
      h('h1', null, 'Admin kirishi'),
      h('p', { class: 'note' }, 'Faqat restoran xodimlari uchun.'),
      h('div', { class: 'field' }, h('label', { htmlFor: 'aphone' }, 'Telefon raqam (+998)'), phone),
      h('div', { class: 'field' }, h('label', { htmlFor: 'apin' }, 'Parol'), pin), err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const p = C.phoneDigits(phone.value);
      if (p.length !== 9) { err.textContent = 'Telefon raqamini to‘g‘ri yozing'; return; }
      btn.disabled = true; btn.textContent = 'Tekshirilmoqda…';
      try { const r = await C.api('login', { phone: p, pin: pin.value }); C.Auth.set({ token: r.token, name: r.name, phone: r.phone }); C.rerender(); }
      catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Kirish'; }
    });
    view.append(form);
  }

  /* ---------- Asosiy oyna ---------- */
  function dashboard() {
    const { h } = C;
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, TABS.map(([k, t]) =>
      h('button', { type: 'button', class: 'tab' + (tab === k ? ' on' : ''), role: 'tab', on: { click: () => { tab = k; dashboard(); } } }, t,
        k === 'orders' && newCount() ? h('span', { class: 'badge' }, newCount()) : null)));
    const body = h('div', { class: 'adm-body', id: 'admBody' });
    view.textContent = '';
    view.append(h('div', { class: 'adm-head' }, h('h1', { class: 'page-title' }, 'Salom, ' + (C.Auth.data.name || 'admin')), h('small', { class: 'note' }, 'Panel har 30 soniyada yangilanadi')), tabs, body);
    const draw = { stats: statsTab, orders: ordersTab, menu: menuTab, admins: adminsTab, me: meTab }[tab];
    if (tab === 'stats' || tab === 'orders') loadOrders().then(() => { if (document.body.contains(body)) draw(body); }).catch((e) => body.append(h('p', { class: 'error' }, e.message)));
    else draw(body);
    stop(); timer = setInterval(poll, 30000);
  }
  const newCount = () => orders.filter((o) => o.status === 'yangi').length;

  async function loadOrders() { orders = (await C.api('orders')).orders.filter((o) => Number.isFinite(+o.id) && +o.id > 0).map((o) => Object.assign(o, { items: Array.isArray(o.items) ? o.items.filter((i) => i && typeof i === 'object') : [] })); seenMax = Math.max(seenMax, ...orders.map((o) => o.id), 0); }
  async function poll() {
    try {
      const prev = seenMax; await loadOrders();
      if (seenMax > prev && prev > 0) { C.toast('🐟 Yangi buyurtma № ' + seenMax); beep(); }
      const body = document.getElementById('admBody');
      if (body && (tab === 'stats' || tab === 'orders')) { if (tab === 'stats') statsTab(body); else ordersTab(body, true); }
    } catch (e) { /* keyingi safar */ }
  }
  function beep() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.5);
    } catch (e) { /* ovoz bo'lmasa ham ishlayveradi */ }
  }
  const short = (n) => n >= 1e6 ? (Math.round(n / 1e5) / 10) + ' mln' : n >= 1000 ? Math.round(n / 1000) + ' ming' : String(n);

  /* ---------- Statistika ---------- */
  function statsTab(body) {
    const { h, money, todayStr, addDays } = C, t = todayStr();
    const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const live = orders.filter((o) => o.status !== 'bekor'), inWeek = live.filter((o) => days.includes(o.date));
    const sum = (l) => l.reduce((s, o) => s + o.total, 0);
    const done = sum(orders.filter((o) => o.status === 'bajarildi' && days.includes(o.date)));
    const waiting = sum(orders.filter((o) => ['yangi', 'tasdiqlandi', 'tayyor'].includes(o.status)));
    const cards = [
      ['Hafta daromadi', done, money, 'cc-green', 'Bajarilgan buyurtmalar, so‘nggi 7 kun'],
      ['Hafta buyurtmalari', inWeek.length, String, 'cc-blue', 'Bekor qilinmaganlar'],
      ['Bugungi buyurtmalar', live.filter((o) => o.date === t).length, String, 'cc-amber', 'Bugun keladiganlar'],
      ['Javob kutayotgan', newCount(), String, 'cc-red', 'Yangi buyurtmalar'],
    ];
    const grid = h('section', { class: 'cards' }, cards.map(([lab, val, f, cls, hint]) =>
      h('div', { class: 'card ' + cls }, h('small', null, lab), h('b', { dataset: { v: val, f: f === money ? 'm' : 'n' } }, f(0)), h('span', { class: 'hint' }, hint))));
    // diagramma
    const per = days.map((d) => sum(live.filter((o) => o.date === d))), max = Math.max(1, ...per);
    const W = 420, H = 210, base = H - 30, top = 28, bw = 38, gap = (W - 30 - bw * 7) / 6, NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Kunlik buyurtma summasi: ' + days.map((d, i) => d + ' ' + per[i]).join(', '));
    const add = (tag, at, text) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (text !== undefined) e.textContent = text; svg.appendChild(e); };
    add('line', { x1: 10, x2: W - 10, y1: base, y2: base, class: 'axis' });
    days.forEach((d, i) => {
      const x = 15 + i * (bw + gap), hh = (per[i] / max) * (base - top);
      add('rect', { x: x, y: base - hh, width: bw, height: Math.max(hh, 0), rx: 6, class: 'bar' + (d === t ? ' now' : '') });
      add('text', { x: x + bw / 2, y: base - hh - 6, class: 'val', 'text-anchor': 'middle' }, per[i] ? short(per[i]) : '0');
      add('text', { x: x + bw / 2, y: H - 10, class: 'lab', 'text-anchor': 'middle' }, WD[new Date(d + 'T00:00:00Z').getUTCDay()] + ' ' + +d.slice(8));
    });
    // eng ko'p buyurtma qilingan baliqlar
    const kg = {};
    inWeek.forEach((o) => (o.items || []).forEach((i) => { kg[i.name] = (kg[i.name] || 0) + i.kg; }));
    const top5 = Object.entries(kg).sort((a, b) => b[1] - a[1]).slice(0, 5), mk = Math.max(1, ...top5.map((x) => x[1]));
    body.textContent = '';
    body.append(grid,
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' }, h('h2', null, 'Kunlik buyurtma summasi ', h('small', null, '· 7 kun')), svg),
        h('div', { class: 'panel' }, h('h2', null, 'Eng ko‘p buyurtma qilingan baliq ', h('small', null, '· kg')),
          top5.length ? h('ol', { class: 'topfish' }, top5.map(([n, k]) => h('li', null, h('span', null, n), h('div', { class: 'meter' }, h('i', { style: 'width:' + (k / mk * 100) + '%' })), h('b', null, C.kgText(k)))))
            : h('p', { class: 'note' }, 'Hozircha ma’lumot yo‘q'))),
      h('div', { class: 'panel waiting' }, h('span', null, 'Kutilayotgan summa (hali bajarilmagan)'), h('b', null, money(waiting))));
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('in')));
    countUp(grid);
  }
  function countUp(grid) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    grid.querySelectorAll('b[data-v]').forEach((b) => {
      const to = +b.dataset.v, f = b.dataset.f === 'm' ? C.money : String, st = performance.now(), dur = 800;
      if (reduce) { b.textContent = f(to); return; }
      (function step(now) { const k = Math.min(1, (now - st) / dur); b.textContent = f(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); })(st);
    });
  }

  /* ---------- Buyurtmalar ---------- */
  function ordersTab(body, quiet) {
    const { h, money, todayStr, addDays, dayLabel, phoneShow } = C, t = todayStr();
    const q = h('input', { type: 'search', placeholder: 'Ism, telefon yoki №', value: filter.q, 'aria-label': 'Qidirish' });
    const chips = h('div', { class: 'chips' }, [['all', 'Hammasi'], ...Object.entries(STATUS)].map(([k, lab]) =>
      h('button', { type: 'button', class: 'chip' + (filter.status === k ? ' on' : ''), on: { click: () => { filter.status = k; ordersTab(body); } } }, lab)));
    const days = h('div', { class: 'chips' }, [['today', 'Bugun'], ['tomorrow', 'Ertaga'], ['all', 'Barcha kunlar']].map(([k, lab]) =>
      h('button', { type: 'button', class: 'chip' + (filter.day === k ? ' on' : ''), on: { click: () => { filter.day = k; ordersTab(body); } } }, lab)));
    const list = h('div', { class: 'olist' });
    const draw = () => {
      list.textContent = '';
      const s = filter.q.trim().toLowerCase();
      const rows = orders.filter((o) => (filter.status === 'all' || o.status === filter.status)
        && (filter.day === 'all' || o.date === (filter.day === 'today' ? t : addDays(t, 1)))
        && (!s || (o.name + ' ' + o.phone + ' ' + o.id).toLowerCase().includes(s)))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      if (!rows.length) list.append(h('p', { class: 'note' }, 'Buyurtma topilmadi'));
      rows.forEach((o) => list.append(orderCard(o)));
    };
    q.addEventListener('input', () => { filter.q = q.value; draw(); });
    body.textContent = ''; body.append(h('div', { class: 'panel' }, q, days, chips), list);
    draw();
  }
  function orderCard(o) {
    const { h, money, dayLabel, phoneShow } = C;
    const act = (label, status, cls) => h('button', { type: 'button', class: 'small ' + (cls || ''), on: { click: async (e) => {
      e.target.disabled = true;
      try { await C.api('setStatus', { id: o.id, status: status }); o.status = status; dashboard(); }
      catch (ex) { C.toast(ex.message); e.target.disabled = false; }
    } } }, label);
    const next = { yangi: [act('Tasdiqlash', 'tasdiqlandi'), act('Bekor', 'bekor', 'ghost')], tasdiqlandi: [act('Tayyor', 'tayyor'), act('Bekor', 'bekor', 'ghost')],
      tayyor: [act('Bajarildi', 'bajarildi'), act('Bekor', 'bekor', 'ghost')], bajarildi: [], bekor: [act('Qayta tiklash', 'yangi', 'ghost')] }[o.status] || [];
    return h('article', { class: 'order st-' + o.status },
      h('div', { class: 'o-head' }, h('b', null, '№' + o.id + ' · ' + o.name), h('span', { class: 'pill st-' + o.status }, STATUS[o.status] || o.status)),
      h('div', { class: 'o-meta' },
        h('span', null, '🕒 ' + dayLabel(o.date) + ', ' + o.time),
        h('span', null, o.mode === 'xona' ? '🏠 ' + o.room + '-xona' : '🛍 Olib ketadi'),
        h('a', { href: 'tel:+998' + o.phone }, '📞 ' + phoneShow(String(o.phone)))),
      h('ul', { class: 'o-items' }, (o.items || []).map((i) => h('li', null, i.name + ' — ' + C.kgText(i.kg), i.live ? h('span', { class: 'tag live' }, 'TIRIK') : null, h('b', null, money(i.sum))))),
      o.note ? h('p', { class: 'o-note' }, '💬 ' + o.note) : null,
      h('div', { class: 'o-foot' }, h('b', { class: 'o-total' }, money(o.total)), h('div', { class: 'btns' }, next)));
  }

  /* ---------- Menyu ---------- */
  async function menuTab(body) {
    const { h } = C;
    body.textContent = ''; body.append(h('p', { class: 'note' }, 'Yuklanmoqda…'));
    let items;
    try { items = (await C.api('menuAll')).items; } catch (e) { body.textContent = ''; body.append(h('p', { class: 'error' }, e.message)); return; }
    body.textContent = '';
    const form = (it) => {
      const name = h('input', { value: it.name || '', placeholder: 'Baliq nomi', maxLength: 60, 'aria-label': 'Nomi' });
      const price = h('input', { type: 'number', value: it.price || '', placeholder: 'Narx (1 kg)', min: 1000, step: 500, 'aria-label': 'Narx' });
      const desc = h('input', { value: it.desc || '', placeholder: 'Qisqa tavsif', maxLength: 160, 'aria-label': 'Tavsif' });
      const live = h('input', { type: 'checkbox', checked: it.live !== false && (it.live || !it.id) });
      const active = h('input', { type: 'checkbox', checked: it.id ? it.active : true });
      const err = h('p', { class: 'error', role: 'alert' });
      const f = h('form', { class: 'panel menuform', novalidate: true },
        h('div', { class: 'two' }, name, price), desc,
        h('div', { class: 'row' }, h('label', { class: 'check' }, live, 'Tirik holda olib ketish mumkin'), h('label', { class: 'check' }, active, 'Menyuda ko‘rinsin'),
          h('button', { type: 'submit', class: 'small' }, it.id ? 'Saqlash' : 'Qo‘shish')), err);
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); err.textContent = '';
        try { await C.api('menuSave', { item: { id: it.id, name: name.value, desc: desc.value, price: price.value, live: live.checked, active: active.checked } }); C.toast('Saqlandi'); menuTab(body); }
        catch (ex) { err.textContent = ex.message; }
      });
      return f;
    };
    body.append(h('h2', { class: 'sec' }, 'Yangi baliq qo‘shish'), form({}), h('h2', { class: 'sec' }, 'Menyudagi baliqlar'), items.map(form));
  }

  /* ---------- Adminlar ---------- */
  async function adminsTab(body) {
    const { h } = C;
    body.textContent = ''; body.append(h('p', { class: 'note' }, 'Yuklanmoqda…'));
    let list;
    try { list = (await C.api('adminsList')).admins; } catch (e) { body.textContent = ''; body.append(h('p', { class: 'error' }, e.message)); return; }
    body.textContent = '';
    const err = h('p', { class: 'error', role: 'alert' });
    const nm = h('input', { placeholder: 'Ism', maxLength: 40, 'aria-label': 'Ism' });
    const ph = h('input', { type: 'tel', inputMode: 'numeric', placeholder: 'Telefon 90 123 45 67', 'aria-label': 'Telefon' });
    const pin = h('input', { type: 'text', inputMode: 'numeric', placeholder: 'Parol (6 ta raqam)', maxLength: 10, autocomplete: 'off', 'aria-label': 'Parol' });
    const add = h('form', { class: 'panel', novalidate: true }, h('h2', null, 'Yangi admin qo‘shish'), h('div', { class: 'three' }, nm, ph, pin), h('button', { type: 'submit', class: 'small' }, 'Qo‘shish'), err,
      h('p', { class: 'note' }, 'Parolni yangi adminga o‘zingiz aytasiz. U keyin Profil bo‘limidan o‘zgartira oladi.'));
    add.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await C.api('adminAdd', { name: nm.value, phone: C.phoneDigits(ph.value), pin: pin.value }); C.toast('Admin qo‘shildi'); adminsTab(body); }
      catch (ex) { err.textContent = ex.message; }
    });
    body.append(add, h('div', { class: 'panel' }, h('h2', null, 'Adminlar'), h('ul', { class: 'list' }, list.map((a) =>
      h('li', null, h('div', null, h('b', null, a.name), h('br'), h('small', null, C.phoneShow(String(a.phone)))),
        String(a.phone) === String(C.Auth.data.phone) ? h('span', { class: 'pill ok' }, 'Siz')
          : h('button', { type: 'button', class: 'small ghost', on: { click: async () => {
            if (!confirm(a.name + ' ni adminlikdan o‘chiramizmi?')) return;
            try { await C.api('adminDel', { phone: a.phone }); adminsTab(body); } catch (ex) { C.toast(ex.message); }
          } } }, 'O‘chirish'))))));
  }

  /* ---------- Profil ---------- */
  function meTab(body) {
    const { h } = C, err = h('p', { class: 'error', role: 'alert' });
    const old = h('input', { type: 'password', inputMode: 'numeric', placeholder: 'Hozirgi parol', autocomplete: 'current-password', 'aria-label': 'Hozirgi parol' });
    const nw = h('input', { type: 'password', inputMode: 'numeric', placeholder: 'Yangi parol (6 ta raqam)', maxLength: 10, autocomplete: 'new-password', 'aria-label': 'Yangi parol' });
    const f = h('form', { class: 'panel', novalidate: true }, h('h2', null, 'Parolni almashtirish'), h('div', { class: 'two' }, old, nw), h('button', { type: 'submit', class: 'small' }, 'Almashtirish'), err);
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await C.api('changePin', { old: old.value, pin: nw.value }); C.toast('Parol almashtirildi'); old.value = nw.value = ''; }
      catch (ex) { err.textContent = ex.message; }
    });
    body.append(f, h('div', { class: 'panel' }, h('p', null, 'Siz ', h('b', null, C.Auth.data.name), ' (' + C.phoneShow(String(C.Auth.data.phone)) + ') sifatida kirgansiz.'),
      h('button', { type: 'button', class: 'ghost', on: { click: () => { C.Auth.clear(); stop(); orders = []; seenMax = 0; C.rerender(); } } }, 'Chiqish')));
  }

  return { render: render, stop: stop };
})();
