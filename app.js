'use strict';
/* Totli baliq — mijoz qismi: menyu, savat, buyurtma, xonalar, tema, ilova o'rnatish. */

/* ▼▼▼ Apps Script "Web app URL" manzilini shu qo'shtirnoq ichiga qo'ying ▼▼▼ */
const API_URL = 'https://script.google.com/macros/s/AKfycbxrRZFDhJ2IjK7nAEdnA_ude0s4LdVYbjqvDb0LJhnlBdrE5PYT-oxFOfM1BFd1r_Cr/exec';
/* ▲▲▲ Masalan: 'https://script.google.com/macros/s/AKfy.../exec' ▲▲▲ */

const App = (function () {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const WEEK = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const FALLBACK = {
    items: [
      { id: 1, name: 'Oq baliq (amur)', desc: 'Mayin go‘shtli, yog‘i kam. Qovurish va dimlash uchun juda yaxshi.', price: 85000, live: true },
      { id: 2, name: 'Sazan', desc: 'Yirik va to‘yimli. Sho‘rva va qovurma uchun.', price: 70000, live: true },
      { id: 3, name: 'Qora baliq (chorni)', desc: 'Qora (chorni) baliq: zich go‘shtli, mazasi o‘ziga xos.', price: 95000, live: true },
      { id: 4, name: 'Pyostr baliq', desc: 'Dog‘li, rangdor baliq. Tandirda yoki pechda juda mazali.', price: 110000, live: true },
    ],
    rooms: 10, open: 10, close: 23, hours: 2,
  };

  /* ---------- Yordamchilar ---------- */
  function h(tag, attrs) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'on') for (const ev in v) e.addEventListener(ev, v[ev]);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k.indexOf('-') > 0) e.setAttribute(k, v);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).flat(9).forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    }
    return e;
  }
  const money = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so‘m';
  const kgText = (n) => String(n).replace('.', ',') + ' kg';
  function tzNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: p.year + '-' + p.month + '-' + p.day, min: +p.hour * 60 + +p.minute };
  }
  const todayStr = () => tzNow().date;
  function addDays(ds, n) { const a = ds.split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)).toISOString().slice(0, 10); }
  const dayName = (ds) => WEEK[new Date(ds + 'T00:00:00Z').getUTCDay()];
  function dayLabel(ds) {
    const t = todayStr();
    if (ds === t) return 'Bugun';
    if (ds === addDays(t, 1)) return 'Ertaga';
    return +ds.slice(8) + '-' + MONTHS[+ds.slice(5, 7) - 1];
  }
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  function phoneDigits(s) { let p = String(s || '').replace(/\D/g, ''); if (p.length === 12 && p.indexOf('998') === 0) p = p.slice(3); return p; }
  const phoneShow = (p) => '+998 ' + p.slice(0, 2) + ' ' + p.slice(2, 5) + ' ' + p.slice(5, 7) + ' ' + p.slice(7);
  function save(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* saqlanmasa ham ishlayveradi */ } }
  function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; clearTimeout(toastTimer);
    if (msg) toastTimer = setTimeout(() => { t.textContent = ''; }, 4500);
  }

  /* ---------- Server bilan aloqa ---------- */
  const Auth = {
    data: load('tb-auth', null),
    get token() { return this.data && this.data.token; },
    set(d) { this.data = d; save('tb-auth', d); },
    clear() { this.data = null; try { localStorage.removeItem('tb-auth'); } catch (e) { /* hech narsa */ } },
  };
  async function api(a, data) {
    if (!API_URL) throw new Error('Server hali ulanmagan (app.js dagi API_URL bo‘sh)');
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ a: a, t: Auth.token }, data || {})), signal: ctl.signal });
      const j = await r.json();
      if (!j.ok) {
        if (j.error === 'AUTH') { Auth.clear(); throw new Error('Qaytadan kiring'); }
        throw new Error(j.error || 'Xatolik');
      }
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Server javob bermadi, qayta urinib ko‘ring');
      if (e instanceof TypeError || e instanceof SyntaxError) throw new Error('Internetga ulanib bo‘lmadi');
      throw e;
    } finally { clearTimeout(tm); }
  }

  /* ---------- Menyu va savat ---------- */
  let MENU = load('tb-menu', FALLBACK);
  async function loadMenu() {
    try { MENU = await api('menu'); save('tb-menu', MENU); } catch (e) { if (!API_URL) MENU = FALLBACK; }
    Cart.prune();
  }
  const Cart = {
    items: load('tb-cart', []),
    save() { save('tb-cart', this.items); updateBar(); },
    get(id) { return this.items.find((x) => x.id === id); },
    set(id, kg) {
      const it = this.get(id);
      if (kg <= 0) this.items = this.items.filter((x) => x.id !== id);
      else if (it) it.kg = Math.min(20, kg);
      else this.items.push({ id: id, kg: kg, live: false });
      this.save();
    },
    setLive(id, v) { const it = this.get(id); if (it) { it.live = v; this.save(); } },
    clear() { this.items = []; this.save(); },
    prune() { this.items = this.items.filter((x) => MENU.items.some((m) => m.id === x.id)); this.save(); },
    lines() { return this.items.map((x) => ({ it: x, m: MENU.items.find((m) => m.id === x.id) })).filter((x) => x.m); },
    total() { return this.lines().reduce((s, x) => s + Math.round(x.m.price * x.it.kg), 0); },
  };
  function updateBar() {
    const n = Cart.items.length, route = currentRoute();
    const b = $('#cartBadge'); b.hidden = !n; b.textContent = n;
    $('#cartBar').hidden = !n || route === 'buyurtma' || route === 'admin';
    $('#cartInfo').textContent = n + ' xil · ' + money(Cart.total());
  }

  /* ---------- Tema, konfetti, o'rnatish ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t; save('tb-tema', t);
    $('#themeBtn use').setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
    document.querySelector('meta[name=theme-color]').setAttribute('content', t === 'dark' ? '#06141b' : '#eef7f9');
  }
  function confetti() {
    if (reduceMotion) return;
    const cv = $('#fx'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight; cv.classList.add('on');
    const colors = ['#14b8c9', '#ff7a45', '#fbbf24', '#34d399', '#60a5fa'];
    const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 13 - 4,
      s: 5 + Math.random() * 6, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * 5) | 0], life: 1 }));
    (function frame() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = false;
      ps.forEach((p) => {
        p.vy += 0.36; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.99; p.life -= 0.011;
        if (p.life > 0 && p.y < cv.height + 20) {
          alive = true; ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
        }
      });
      if (alive) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
    })();
  }
  let deferredInstall = null;
  function setupInstall() {
    const btn = $('#installBtn');
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; btn.hidden = false; });
    window.addEventListener('appinstalled', () => { btn.hidden = true; });
    btn.addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) { /* e'tibor bermaymiz */ }
      deferredInstall = null; btn.hidden = true;
    });
  }

  /* ---------- Baliq rasmi ---------- */
  function hue(s) { let x = 0; for (const c of String(s)) x = (x * 31 + c.codePointAt(0)) % 360; return x; }
  function fishArt(name) {
    const hh = 170 + (hue(name) % 70);
    const d = h('div', { class: 'fish-art', style: 'background:linear-gradient(160deg,hsl(' + hh + ' 70% 38%),hsl(' + ((hh + 40) % 360) + ' 70% 20%))' });
    d.innerHTML = '<svg class="fish" viewBox="0 0 80 48" aria-hidden="true"><use href="#i-fish"/></svg><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i>';
    return d;
  }
  function stepper(id, onChange) {
    const val = h('b', { class: 'qty' });
    const minus = h('button', { type: 'button', class: 'step', 'aria-label': 'Kamaytirish' }, '−');
    const plus = h('button', { type: 'button', class: 'step', 'aria-label': 'Ko‘paytirish' }, '+');
    const upd = () => { const it = Cart.get(id); val.textContent = it ? kgText(it.kg) : '0 kg'; minus.disabled = !it; plus.disabled = !!it && it.kg >= 20; };
    minus.addEventListener('click', () => { const it = Cart.get(id); Cart.set(id, (it ? it.kg : 0) - 0.5); upd(); onChange && onChange(); });
    plus.addEventListener('click', () => { const it = Cart.get(id); Cart.set(id, (it ? it.kg : 0) + 0.5); upd(); onChange && onChange(); });
    upd();
    return h('div', { class: 'stepper' }, minus, val, plus);
  }

  /* ---------- Sahifa: Menyu ---------- */
  function viewHome(v) {
    v.append(h('section', { class: 'hero' },
      h('div', { class: 'hero-txt' },
        h('span', { class: 'chip-live' }, '● Tirik baliq hovuzdan'),
        h('h1', null, 'Totli baliq'),
        h('p', null, 'Hovuzdan stolingizgacha: tirik baliq ham, issiq tayyor taom ham. Oldindan buyurtma bering — kelganingizda hammasi tayyor.'),
        h('div', { class: 'cta' },
          h('a', { class: 'btn', href: '#buyurtma' }, 'Buyurtma berish'),
          h('a', { class: 'btn ghost', href: '#xonalar' }, 'Xona band qilish'))),
      (() => { const a = h('div', { class: 'hero-art', 'aria-hidden': 'true' });
        a.innerHTML = '<svg class="fish big" viewBox="0 0 80 48"><use href="#i-fish"/></svg><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i><i class="b b4"></i>'; return a; })()));
    v.append(h('h2', { class: 'sec' }, 'Bizning baliqlar ', h('small', null, '· narx 1 kg uchun')));
    const grid = h('div', { class: 'menu' });
    MENU.items.forEach((m) => {
      grid.append(h('article', { class: 'dish' },
        fishArt(m.name),
        h('div', { class: 'dish-body' },
          h('h3', null, m.name),
          h('p', null, m.desc),
          m.live ? h('span', { class: 'tag' }, 'Tirik ham olib ketish mumkin') : null,
          h('div', { class: 'dish-foot' }, h('b', { class: 'price' }, money(m.price)), stepper(m.id)))));
    });
    if (!MENU.items.length) grid.append(h('p', { class: 'note' }, 'Hozircha menyu bo‘sh.'));
    v.append(grid);
    v.append(h('section', { class: 'how' },
      h('div', null, h('b', null, '1'), h('span', null, 'Baliqni tanlang')),
      h('div', null, h('b', null, '2'), h('span', null, 'Vaqt va xonani belgilang')),
      h('div', null, h('b', null, '3'), h('span', null, 'Keling — hammasi tayyor!'))));
  }

  /* ---------- Sahifa: Buyurtma ---------- */
  let preset = null;                       // «Xonalar» sahifasidan keladi: { room, date }
  function viewOrder(v) {
    const f = Object.assign({ mode: 'xona', date: todayStr(), time: '', room: 0, busy: [] }, preset || {});
    preset = null;
    const lines = h('div', { class: 'lines' }), roomsBox = h('div', { class: 'roomgrid' }), err = h('p', { class: 'error', role: 'alert' });
    const totalEl = h('b', { class: 'big-total' });
    const timeSel = h('select', { id: 'timeSel', 'aria-label': 'Soat' });
    const dateSel = h('select', { id: 'dateSel', 'aria-label': 'Sana' });
    for (let i = 0; i < 8; i++) { const d = addDays(todayStr(), i); dateSel.append(h('option', { value: d }, dayLabel(d) + ' · ' + dayName(d))); }
    dateSel.value = f.date;
    const name = h('input', { id: 'oname', autocomplete: 'name', placeholder: 'Ismingiz', maxLength: 60, value: load('tb-name', '') });
    const phone = h('input', { id: 'ophone', type: 'tel', inputMode: 'numeric', autocomplete: 'tel', placeholder: '90 123 45 67', maxLength: 17, value: load('tb-phone', '') });
    const note = h('textarea', { id: 'onote', rows: 2, maxLength: 200, placeholder: 'Izoh (ixtiyoriy): masalan, baliq tozalab berilsin' });
    const trap = h('input', { name: 'site', tabIndex: -1, autocomplete: 'off', class: 'trap', 'aria-hidden': 'true' });
    const submit = h('button', { type: 'submit', class: 'btn big' }, 'Buyurtmani yuborish');
    const modeBtns = ['xona', 'olib ketish'].map((m) => h('button', { type: 'button', class: 'seg-btn', dataset: { m: m } }, m === 'xona' ? 'Restoranda (xona)' : 'Olib ketaman'));
    const roomWrap = h('div', { class: 'field' }, h('label', null, 'Xona (1–' + MENU.rooms + ')'), roomsBox);

    function fillTimes() {
      const now = tzNow(), keep = timeSel.value;
      timeSel.textContent = '';
      for (let m = MENU.open * 60; m < MENU.close * 60; m += 30) {
        const o = h('option', { value: hhmm(m) }, hhmm(m));
        if (f.date === now.date && m < now.min + 30) o.disabled = true;
        timeSel.append(o);
      }
      const first = [...timeSel.options].find((o) => !o.disabled);
      timeSel.value = keep && [...timeSel.options].some((o) => o.value === keep && !o.disabled) ? keep : (f.time && [...timeSel.options].some((o) => o.value === f.time && !o.disabled) ? f.time : (first ? first.value : ''));
      f.time = timeSel.value;
    }
    function drawRooms() {
      roomWrap.hidden = f.mode !== 'xona';
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === f.mode));
      roomsBox.textContent = '';
      for (let r = 1; r <= MENU.rooms; r++) {
        const taken = f.busy.some((b) => b.room === r && Math.abs(toMin(b.time) - toMin(f.time || '00:00')) < MENU.hours * 60);
        const b = h('button', { type: 'button', class: 'room' + (f.room === r ? ' on' : '') + (taken ? ' taken' : ''), disabled: taken }, String(r), h('small', null, taken ? 'band' : 'bo‘sh'));
        b.addEventListener('click', () => { f.room = r; drawRooms(); });
        roomsBox.append(b);
      }
      if (f.room && f.busy.some((b) => b.room === f.room && Math.abs(toMin(b.time) - toMin(f.time || '00:00')) < MENU.hours * 60)) f.room = 0;
    }
    async function loadBusy() {
      try { f.busy = (await api('busy', { date: f.date })).busy; } catch (e) { f.busy = []; }
      drawRooms();
    }
    function drawLines() {
      lines.textContent = '';
      const L = Cart.lines();
      if (!L.length) {
        lines.append(h('div', { class: 'empty' }, 'Savat bo‘sh. ', h('a', { href: '#bosh' }, 'Menyuga o‘ting')));
      }
      L.forEach(({ it, m }) => {
        const live = m.live && f.mode === 'olib ketish'
          ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: it.live, on: { change: (e) => { Cart.setLive(m.id, e.target.checked); } } }), 'Tirik holda olib ketaman') : null;
        lines.append(h('div', { class: 'line' },
          h('div', { class: 'line-main' }, h('b', null, m.name), h('small', null, money(m.price) + ' / kg'), live),
          stepper(m.id, drawLines),
          h('b', { class: 'line-sum' }, money(Math.round(m.price * it.kg)))));
      });
      totalEl.textContent = money(Cart.total());
      submit.disabled = !L.length;
    }
    modeBtns.forEach((b) => b.addEventListener('click', () => { f.mode = b.dataset.m; drawRooms(); drawLines(); }));
    dateSel.addEventListener('change', () => { f.date = dateSel.value; fillTimes(); loadBusy(); });
    timeSel.addEventListener('change', () => { f.time = timeSel.value; drawRooms(); });

    const form = h('form', { class: 'panel orderform', novalidate: true },
      h('h2', null, 'Buyurtmangiz'), lines,
      h('div', { class: 'total-row' }, h('span', null, 'Jami'), totalEl),
      h('div', { class: 'field' }, h('label', null, 'Qanday olasiz?'), h('div', { class: 'seg' }, modeBtns)),
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { htmlFor: 'dateSel' }, 'Sana'), dateSel),
        h('div', { class: 'field' }, h('label', { htmlFor: 'timeSel' }, 'Soat'), timeSel)),
      roomWrap,
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { htmlFor: 'oname' }, 'Ismingiz'), name),
        h('div', { class: 'field' }, h('label', { htmlFor: 'ophone' }, 'Telefon (+998)'), phone)),
      h('div', { class: 'field' }, h('label', { htmlFor: 'onote' }, 'Izoh'), note),
      trap, err, submit,
      h('p', { class: 'note' }, 'Buyurtma qabul qilingach restoran xodimlariga darhol xabar boradi. Zarur bo‘lsa, siz bilan bog‘lanamiz.'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const p = phoneDigits(phone.value);
      if (name.value.trim().length < 2) { err.textContent = 'Ismingizni yozing'; name.focus(); return; }
      if (p.length !== 9) { err.textContent = 'Telefon raqami 9 ta raqamdan iborat bo‘lsin (masalan 90 123 45 67)'; phone.focus(); return; }
      if (!f.time) { err.textContent = 'Bugun uchun vaqt qolmadi, boshqa kunni tanlang'; return; }
      if (f.mode === 'xona' && !f.room) { err.textContent = 'Xonani tanlang'; return; }
      submit.disabled = true; submit.textContent = 'Yuborilmoqda…';
      try {
        const r = await api('order', { name: name.value, phone: p, mode: f.mode, date: f.date, time: f.time, room: f.room, note: note.value, site: trap.value,
          items: Cart.items.map((x) => ({ id: x.id, kg: x.kg, live: !!x.live })) });
        save('tb-name', name.value); save('tb-phone', phone.value);
        const sum = { id: r.id, date: f.date, time: f.time, room: f.mode === 'xona' ? f.room : 0, total: r.total };
        Cart.clear(); confetti(); viewDone(v, sum);
      } catch (ex) {
        err.textContent = ex.message; submit.disabled = false; submit.textContent = 'Buyurtmani yuborish';
        if (/band/.test(ex.message)) loadBusy();
      }
    });
    v.append(h('h1', { class: 'page-title' }, 'Buyurtma'), form);
    fillTimes(); drawRooms(); drawLines(); loadBusy();
  }
  function viewDone(v, s) {
    v.textContent = '';
    v.append(h('section', { class: 'panel done' },
      h('div', { class: 'done-ic' }, '✓'),
      h('h1', null, 'Buyurtma qabul qilindi!'),
      h('p', null, '№' + s.id + ' · ' + dayLabel(s.date) + ', soat ' + s.time + (s.room ? ' · ' + s.room + '-xona' : ' · olib ketasiz')),
      h('p', { class: 'big-total' }, money(s.total)),
      h('p', { class: 'note' }, 'Restoran xodimlariga xabar yuborildi. Rahmat, sizni kutamiz!'),
      h('a', { class: 'btn', href: '#bosh' }, 'Menyuga qaytish')));
    window.scrollTo(0, 0);
  }

  /* ---------- Sahifa: Xonalar ---------- */
  function viewRooms(v) {
    let date = todayStr(), busy = [];
    const grid = h('div', { class: 'roomcards' }), dateSel = h('select', { 'aria-label': 'Sana' });
    for (let i = 0; i < 8; i++) { const d = addDays(todayStr(), i); dateSel.append(h('option', { value: d }, dayLabel(d) + ' · ' + dayName(d))); }
    function draw(loading) {
      grid.textContent = '';
      for (let r = 1; r <= MENU.rooms; r++) {
        const mine = busy.filter((b) => b.room === r).sort((a, b) => a.time.localeCompare(b.time));
        grid.append(h('div', { class: 'roomcard' + (mine.length ? ' has' : '') },
          h('div', { class: 'rn' }, String(r)), h('div', { class: 'rinfo' },
            h('b', null, r + '-xona'),
            h('small', null, loading ? 'Yuklanmoqda…' : mine.length ? 'Band: ' + mine.map((b) => b.time + '–' + hhmm(toMin(b.time) + MENU.hours * 60)).join(', ') : 'Kun bo‘yi bo‘sh')),
          h('button', { type: 'button', class: 'small', on: { click: () => { preset = { mode: 'xona', room: r, date: date }; location.hash = '#buyurtma'; } } }, 'Band qilish')));
      }
    }
    async function load() { draw(true); try { busy = (await api('busy', { date: date })).busy; } catch (e) { busy = []; toast(e.message); } draw(false); }
    dateSel.addEventListener('change', () => { date = dateSel.value; load(); });
    v.append(h('h1', { class: 'page-title' }, 'Xonalar'),
      h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', null, 'Qaysi kun uchun?'), dateSel),
        h('p', { class: 'note' }, 'Har bir buyurtma xonani ' + MENU.hours + ' soatga band qiladi. Ish vaqti: ' + MENU.open + ':00–' + MENU.close + ':00.'), grid));
    load();
  }

  /* ---------- Yo'naltirish ---------- */
  const ROUTES = { bosh: viewHome, buyurtma: viewOrder, xonalar: viewRooms, admin: (v) => Admin.render(v, ctx) };
  function currentRoute() { const r = location.hash.slice(1); return ROUTES[r] ? r : 'bosh'; }
  async function render() {
    Admin.stop();
    const r = currentRoute(), v = $('#view');
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.go === r));
    v.textContent = ''; v.className = 'page';
    ROUTES[r](v);
    updateBar();
    if (r !== 'buyurtma') window.scrollTo(0, 0);
  }
  const ctx = { h: h, $: $, api: api, Auth: Auth, money: money, kgText: kgText, toast: toast, confetti: confetti, todayStr: todayStr, addDays: addDays, dayName: dayName, dayLabel: dayLabel,
    phoneDigits: phoneDigits, phoneShow: phoneShow, MONTHS: MONTHS, getMenu: () => MENU, rerender: render };

  async function start() {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    $('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    setupInstall();
    if (!API_URL) {
      const b = $('#banner'); b.hidden = false;
      b.textContent = 'Namuna rejimi: server hali ulanmagan. Menyuni ko‘rishingiz mumkin, buyurtma yuborilmaydi.';
    }
    window.addEventListener('hashchange', render);
    await loadMenu();
    render();
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  return { start: start };
})();
