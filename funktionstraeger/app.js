// Öffentliche Konzeptvorschau: Zustand nur für diesen Seitenaufruf.
const steps = [...document.querySelectorAll('[data-onboarding-step]')];
const progressCount = document.querySelector('[data-progress-count]');
const progressBar = document.querySelector('[data-progress-bar]');
const progressTitle = document.querySelector('[data-progress-title]');
const progressCopy = document.querySelector('[data-progress-copy]');
const resetButton = document.querySelector('[data-reset-progress]');
const searchInput = document.querySelector('[data-module-search]');
const moduleCards = [...document.querySelectorAll('[data-module-card]')];
const searchStatus = document.querySelector('[data-search-status]');
const emptySearch = document.querySelector('[data-empty-search]');

function progressMessage(count) {
  if (count === 0) return ['Los geht’s.', 'Beginnen Sie mit Ihrer Funktion und den wichtigsten Ansprechpartnern.'];
  if (count < 4) return ['Der Anfang ist gemacht.', 'Die wichtigsten Grundlagen nehmen Form an.'];
  if (count < steps.length) return ['Gut unterwegs.', 'Nur noch wenige Punkte bis zum vollständigen Einstieg.'];
  return ['Vorschau ausprobiert.', 'Alle acht Schritte in der Vorschau ausprobiert. Es wurden keine Zugänge eingerichtet.'];
}

function updateProgress() {
  const count = steps.filter((step) => step.checked).length;
  const [title, copy] = progressMessage(count);
  const percentage = steps.length ? (count / steps.length) * 100 : 0;

  progressCount.textContent = String(count);
  progressTitle.textContent = title;
  progressCopy.textContent = copy;
  progressBar.setAttribute('aria-valuenow', String(count));
  progressBar.querySelector('span').style.width = `${percentage}%`;
}

function initializePreview() {
  steps.forEach((step) => {
    step.checked = false;
    step.addEventListener('change', () => updateProgress());
  });
  updateProgress();
}

resetButton?.addEventListener('click', () => {
  if (!steps.some((step) => step.checked)) return;
  steps.forEach((step) => { step.checked = false; });
  updateProgress();
});

function normalize(value) {
  return value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const searchableModules = moduleCards.map((card) => {
  const targetId = card.getAttribute('href')?.replace(/^#/, '');
  const section = targetId ? document.getElementById(targetId) : null;
  return {
    card,
    text: normalize(`${card.textContent} ${section?.textContent || ''} ${card.dataset.searchKeywords || ''}`)
  };
});

searchInput?.addEventListener('input', () => {
  const terms = normalize(searchInput.value.trim()).split(/\s+/).filter(Boolean);
  let visible = 0;

  searchableModules.forEach(({ card, text }) => {
    const matches = terms.every((term) => text.includes(term));
    card.hidden = !matches;
    if (matches) visible += 1;
  });

  emptySearch.hidden = visible !== 0;
  searchStatus.textContent = visible === 1 ? '1 Bereich gefunden' : `${visible} Bereiche gefunden`;
});

document.querySelectorAll('.mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => link.closest('details')?.removeAttribute('open'));
});

document.querySelectorAll('[data-total-steps]').forEach((element) => {
  element.textContent = String(steps.length);
});

const year = document.querySelector('[data-current-year]');
if (year) year.textContent = String(new Date().getFullYear());

initializePreview();
