const filters = document.querySelectorAll('[data-filter]');
const motions = document.querySelectorAll('[data-council]');
const emptyState = document.querySelector('[data-empty-state]');
const emptyTitle = document.querySelector('[data-empty-title]');
const emptyCopy = document.querySelector('[data-empty-copy]');
const resultCount = document.querySelector('[data-result-count]');
const filterParameter = 'rat';
const defaultFilter = 'all';

const availableFilters = new Set(
  Array.from(filters, (button) => button.dataset.filter)
);

const emptyMessages = {
  urbar: {
    title: 'Urbarer Anträge werden ergänzt',
    copy: 'Konkrete Anträge der CDU-Fraktion veröffentlichen wir hier, sobald Vorgang und Originalquelle abschließend geprüft sind.'
  },
  niederwerth: {
    title: 'Keine klassische CDU-Fraktion',
    copy: 'Im Ortsgemeinderat Niederwerth erfolgt die Ratsarbeit über die Wählergruppe Horst Klöckner. Deshalb weisen wir hier keine Anträge als CDU-Fraktionsanträge aus.'
  },
  weitersburg: {
    title: 'Derzeit keine CDU-Vertretung im Rat',
    copy: 'In Weitersburg gibt es aktuell keine CDU-Ratsfraktion. Die politische Arbeit vor Ort befindet sich im Neuaufbau.'
  }
};

function getFilterFromUrl() {
  const requestedFilter = new URL(window.location.href).searchParams
    .get(filterParameter)
    ?.trim()
    .toLowerCase();

  return availableFilters.has(requestedFilter) ? requestedFilter : defaultFilter;
}

function updateFilterUrl(filter) {
  const url = new URL(window.location.href);

  if (filter === defaultFilter) {
    url.searchParams.delete(filterParameter);
  } else {
    url.searchParams.set(filterParameter, filter);
  }

  url.hash = 'antraege';
  if (url.href !== window.location.href) {
    window.history.pushState(null, '', url);
  }
}

function formatResultCount(visibleMotions) {
  const sourced = visibleMotions.filter((motion) => motion.querySelector('a[href]')).length;
  const drafts = visibleMotions.length - sourced;
  const parts = [];
  if (sourced) parts.push(`${sourced} ${sourced === 1 ? 'Eintrag' : 'Einträge'} mit öffentlicher Quelle`);
  if (drafts) parts.push(`${drafts} ${drafts === 1 ? 'ausgearbeitete Initiative' : 'ausgearbeitete Initiativen'} (Einreichung öffentlich noch nicht belegt)`);
  return parts.length ? parts.join(' · ') : 'Keine Einträge für diesen Rat.';
}

function applyFilter(filter, { updateUrl = false } = {}) {
  const activeFilter = availableFilters.has(filter) ? filter : defaultFilter;

  motions.forEach((motion) => {
    const show = activeFilter === defaultFilter || motion.dataset.council === activeFilter;
    motion.hidden = !show;
  });

  filters.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter));
  });

  const visibleMotions = Array.from(motions).filter((motion) => !motion.hidden);
  const visible = visibleMotions.length;
  resultCount.textContent = formatResultCount(visibleMotions);
  emptyState.hidden = visible !== 0;

  if (visible === 0) {
    const message = emptyMessages[activeFilter] || {
      title: 'Noch keine Einträge',
      copy: 'Für diesen Rat sind derzeit keine CDU-Anträge oder ausgearbeiteten Initiativen veröffentlicht.'
    };
    emptyTitle.textContent = message.title;
    emptyCopy.textContent = message.copy;
  }

  if (updateUrl) updateFilterUrl(activeFilter);
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    applyFilter(button.dataset.filter, { updateUrl: true });
  });
});

window.addEventListener('popstate', () => applyFilter(getFilterFromUrl()));

applyFilter(getFilterFromUrl());
