'use strict';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menu = document.querySelector('.menu-toggle');
const navigation = document.getElementById('site-nav');
function closeMenu() {
  navigation?.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', '메뉴 열기');
}
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
});
navigation?.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
});
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.documentElement.classList.add('js-motion');
  const observer = new IntersectionObserver((entries, owner) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); owner.unobserve(entry.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}
// Previews download only after the visitor requests them by hover or focus.
document.querySelectorAll('.project-visual').forEach((card) => {
  const preview = card.querySelector('.hover-video');
  let engaged = false;
  function start() {
    if (!preview || reducedMotion.matches || !window.matchMedia('(hover: hover)').matches) return;
    engaged = true;
    if (!preview.src) preview.src = preview.dataset.src;
    preview.play().then(() => { if (engaged) card.classList.add('is-playing'); else preview.pause(); }).catch(() => {});
  }
  function stop() { engaged = false; card.classList.remove('is-playing'); preview?.pause(); }
  card.addEventListener('mouseenter', start); card.addEventListener('mouseleave', stop);
  card.addEventListener('focus', start); card.addEventListener('blur', stop);
});
document.querySelectorAll('.video-player video').forEach((video) => {
  const fallback = video.parentElement.querySelector('.video-fallback');
  video.addEventListener('error', () => { if (fallback) fallback.hidden = false; });
  video.querySelectorAll('source').forEach((source) => source.addEventListener('error', () => { if (fallback) fallback.hidden = false; }));
  if (reducedMotion.matches && video.autoplay) { video.autoplay = false; video.pause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video').forEach((video) => video.pause()); });
const tocLinks = [...document.querySelectorAll('.detail-toc nav a')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const sections = tocLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver(() => {
    const active = [...sections].reverse().find((section) => section.getBoundingClientRect().top < window.innerHeight * 0.4) || sections[0];
    tocLinks.forEach((link) => {
      const selected = link.getAttribute('href') === '#' + active.id;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
  sections.forEach((section) => observer.observe(section));
}
