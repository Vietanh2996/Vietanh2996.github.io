/* EN / VI switch (button .lang-toggle in the top-right combo, css/base/theme.css). The <head> script already set <html lang> before
   first paint (saved choice, else en). Static text: elements with data-i18n="key" get innerHTML from DICT[lang][key]; the English
   original is read from the page the first time, so DICT.en only needs keys whose English is NOT in the HTML.
   Text built by other scripts (chips, work cards, intro, experience quotes) listens for the "langchange" event on document
   and reads window.I18N.lang / I18N.t(key, fallback).
   Other pages (work/*.html) add their own copy via window.I18N_PAGE = { vi: {...} } loaded before this file;
   key 'page.title' there also switches document.title. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'lang';
  var DICT = {
    vi: {
      'card.title': 'Kết nối với tôi nhé!',
      'about.note': 'Xin&nbsp;chào, mình là Việt&nbsp;Anh, Design&nbsp;Engineer&nbsp;Lead tại Hà&nbsp;Nội. Mình có 9&nbsp;năm kinh&nbsp;nghiệm ngành design, trong&nbsp;đó hơn&nbsp;5&nbsp;năm gần&nbsp;đây làm vị&nbsp;trí Product&nbsp;Design và Design&nbsp;Engineering. Hiện mình đang xây Design&nbsp;System và đưa AI vào quy&nbsp;trình làm&nbsp;việc của team&nbsp;product, để tăng&nbsp;năng&nbsp;suất cho cả&nbsp;team và rút&nbsp;ngắn đường từ thiết&nbsp;kế đến sản&nbsp;phẩm&nbsp;thật.',
      'about.hi1': 'Hêy! Cẩn thận,',
      'about.hi2': 'đang tới để',
      'about.design': 'thiết kế',
      'about.build': 'xây dựng',
      'about.ship': 'và ship bằng',
      'exp.now': 'nay',
      'cursor.mode': 'Bấm vào đây đổi chế độ thử xem',
      'intro.toast': 'Đã chuyển bộ gõ sang English (US)',
      'work.a.l2': 'Từ app tích điểm lên nền tảng lifestyle',
      'work.a.note': 'VinID khi đó là một super app tích điểm. Khi chuyển hướng thành cánh tay nối dài của hệ sinh thái Techcombank, OneU phải trông như một lifestyle app thời thượng',
      'work.b.l2': 'Nội dung cá nhân hoá bằng AI',
      'work.b.note': 'Kết nối với người dùng đúng lúc họ cần, một cách thông minh, tự động và linh hoạt hơn'
    },
    en: {}
  };
  var PAGE = window.I18N_PAGE || {};
  Object.keys(PAGE).forEach(function (l) { DICT[l] = DICT[l] || {}; Object.keys(PAGE[l]).forEach(function (k) { DICT[l][k] = PAGE[l][k]; }); });
  if (DICT.vi['page.title']) DICT.en['page.title'] = document.title;
  var nodes = [].slice.call(document.querySelectorAll('[data-i18n]'));
  nodes.forEach(function (el) { DICT.en[el.dataset.i18n] = el.innerHTML; });
  var btn = document.querySelector('.lang-toggle');

  /* durations like "x2 years" / "1+ years" / "<1 year" */
  function dur(s) { return I18N.lang === 'vi' ? String(s).replace(/\byears?\b/g, 'năm') : s; }
  function t(key, fallback) { var d = DICT[I18N.lang] || {}; return key in d ? d[key] : key in DICT.en ? DICT.en[key] : fallback; }
  function apply(l) {
    root.lang = l; I18N.lang = l;
    nodes.forEach(function (el) { var v = t(el.dataset.i18n); if (v != null && el.innerHTML !== v) el.innerHTML = v; });
    if (DICT.en['page.title']) document.title = t('page.title');
    if (btn) btn.setAttribute('aria-label', l === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt');
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
  }
  var I18N = window.I18N = { lang: 'en', t: t, dur: dur, dict: DICT };
  apply(root.lang === 'vi' ? 'vi' : 'en');
  if (btn) btn.addEventListener('click', function () {
    var l = I18N.lang === 'vi' ? 'en' : 'vi';
    apply(l);
    try { localStorage.setItem(KEY, l); } catch (e) {}
  });
})();
