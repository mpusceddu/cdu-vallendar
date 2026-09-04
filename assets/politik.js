const filters = document.querySelectorAll('[data-filter]');
const motions = document.querySelectorAll('[data-council]');
const emptyState = document.querySelector('[data-empty-state]');
const emptyTitle = document.querySelector('[data-empty-title]');
const emptyCopy = document.querySelector('[data-empty-copy]');
const resultCount = document.querySelector('[data-result-count]');

const emptyMessages = {
  urbar: {
    title: 'Urbarer Anträge werden ergänzt',
    copy: 'Konkrete Anträge der CDU-Fraktion veröffentlichen wir hier, sobald Vorgang und Originalquelle abschließend geprüft sind.'
  },
  niederwerth: {
    title: 'Keine klassische CDU-Fraktion',
    copy: 'Im Ortsgemeinderat Niederwerth erfolgt die Ratsarbeit über die gemeinsame Wählergruppe. Deshalb weisen wir hier keine Anträge als CDU-Fraktionsanträge aus.'
  },
  weitersburg: {
    title: 'Derzeit keine CDU-Vertretung im Rat',
    copy: 'In Weitersburg gibt es aktuell keine CDU-Ratsfraktion. Die politische Arbeit vor Ort befindet sich im Neuaufbau.'
  }
};

function applyFilter(filter) {
  let visible = 0;

  motions.forEach((motion) => {
    const show = filter === 'all' || motion.dataset.council === filter;
    motion.hidden = !show;
    if (show) visible += 1;
  });

  filters.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  });

  resultCount.textContent = String(visible);
  emptyState.hidden = visible !== 0;

  if (visible === 0) {
    const message = emptyMessages[filter] || {
      title: 'Noch keine belegten Einträge',
      copy: 'Für diesen Rat sind auf der neuen Seite noch keine abschließend geprüften CDU-Anträge veröffentlicht.'
    };
    emptyTitle.textContent = message.title;
    emptyCopy.textContent = message.copy;
  }
}

filters.forEach((button) => {
  button.addEventListener('click', () => applyFilter(button.dataset.filter));
});
