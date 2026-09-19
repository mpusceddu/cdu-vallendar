const search = document.querySelector('[data-example-search]');
const status = document.querySelector('[data-example-status]');
const empty = document.querySelector('[data-example-empty]');
const normalize = (value) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
const examples = [...document.querySelectorAll('[data-example]')].map((card) => ({
  card, text: normalize(`${card.textContent} ${card.dataset.searchKeywords || ''}`)
}));

function filterExamples() {
  const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  let count = 0;
  for (const { card, text } of examples) {
    card.hidden = !terms.every((term) => text.includes(term));
    if (!card.hidden) count += 1;
  }
  status.textContent = `${count} von ${examples.length} Beispielen angezeigt`;
  empty.hidden = count !== 0;
}

search?.addEventListener('input', filterExamples);
document.querySelector('[data-example-form]')?.addEventListener('submit', (event) => event.preventDefault());
document.querySelector('[data-example-reset]')?.addEventListener('click', () => {
  search.value = '';
  filterExamples();
  search.focus();
});
if (search) filterExamples();

document.querySelectorAll('.mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => link.closest('details')?.removeAttribute('open'));
});
document.querySelectorAll('.mobile-menu').forEach((menu) => {
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    menu.removeAttribute('open');
    menu.querySelector('summary')?.focus();
  });
});
