(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.mobile-nav');
  var goTop = document.querySelector('.go-top');
  var yearEl = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function onScroll() {
    var scrolled = window.scrollY > 12;
    header.classList.toggle('is-scrolled', scrolled);
    if (goTop) goTop.classList.toggle('is-visible', window.scrollY > 500);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var isOpen = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (goTop) {
    goTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Dynamic events ──────────────────────────────────────────────────────────

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return ('0' + d.getDate()).slice(-2) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatDay(iso) {
    if (!iso) return '--';
    var d = new Date(iso);
    return isNaN(d) ? '--' : ('0' + d.getDate()).slice(-2);
  }

  function formatMonYear(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /** Renders the upcoming highlight card */
  function renderHighlight(event) {
    var container = document.getElementById('event-highlight-container');
    if (!container || !event) return;

    var dateLabel = event.date || formatDate(event.parsed_date);
    container.innerHTML =
      '<a class="event-highlight" href="' + event.url + '" target="_blank" rel="noopener"' +
      ' style="display:flex;align-items:center;justify-content:space-between;gap:24px;">' +
      '  <div class="event-highlight__body">' +
      '    <span class="spotlight__badge spotlight__badge--live">Upcoming &mdash; ' + dateLabel + '</span>' +
      '    <h3>' + event.title + '</h3>' +
      '    <p>' + (event.description || 'The most awaited DevOps conference of the year is back. Save the date and grab your ticket.') + '</p>' +
      '  </div>' +
      '  <span class="btn btn--gold event-highlight__cta" style="flex-shrink:0;">Get tickets</span>' +
      '</a>';
  }

  /** Renders past events list */
  function renderPastEvents(events) {
    var list = document.getElementById('events-list-container');
    if (!list || !events || !events.length) return;

    list.innerHTML = events.slice(0, 6).map(function (e) {
      return (
        '<a class="event-row" href="' + e.url + '" target="_blank" rel="noopener">' +
        '  <div class="event-row__date"><span>' + formatDay(e.parsed_date) + '</span>' + formatMonYear(e.parsed_date) + '</div>' +
        '  <div class="event-row__body">' +
        '    <h3>' + e.title + '</h3>' +
        (e.location ? '<p>' + e.location + '</p>' : '') +
        '  </div>' +
        '  <svg class="icon event-row__go"><use href="#icon-external"></use></svg>' +
        '</a>'
      );
    }).join('');
  }

  /** Main: fetch events.json and render */
  function loadEvents() {
    fetch('assets/data/events.json?v=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject('not found'); })
      .then(function (data) {
        if (data.upcoming && data.upcoming.length) {
          renderHighlight(data.upcoming[0]);
        }
        if (data.past && data.past.length) {
          renderPastEvents(data.past);
        }
      })
      .catch(function (err) {
        console.info('Events JSON not available, using static fallback.', err);
      });
  }

  loadEvents();
})();

