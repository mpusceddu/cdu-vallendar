const mobileMenus = document.querySelectorAll('.mobile-menu');

function closeMobileMenus(except = null) {
  mobileMenus.forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

mobileMenus.forEach((menu) => {
  const summary = menu.querySelector('summary');

  function updateMenuLabel() {
    summary.setAttribute('aria-label', menu.open ? 'Menü schließen' : 'Menü öffnen');
  }

  updateMenuLabel();
  menu.addEventListener('toggle', () => {
    if (menu.open) closeMobileMenus(menu);
    updateMenuLabel();
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.open = false;
    });
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMobileMenus();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.mobile-menu')) closeMobileMenus();
});

document.querySelectorAll('.quote-mark, .team-initials, .topic-number, .policy-topic-grid article > span').forEach((element) => {
  element.setAttribute('aria-hidden', 'true');
});

document.querySelectorAll('.breadcrumb > span:last-child').forEach((currentPage) => {
  currentPage.setAttribute('aria-current', 'page');
});
