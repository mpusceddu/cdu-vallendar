// Native selects stay keyboard-accessible. Repeat long choices below the
// control on narrow screens, where the operating system clips their text.
const choiceCaptions = [...document.querySelectorAll('.field-group select')].map(select => {
  const caption = document.createElement('small');
  caption.className = 'selected-choice';
  caption.setAttribute('aria-hidden', 'true');
  select.after(caption);
  return { select, caption };
});
function updateChoiceCaptions() {
  for (const { select, caption } of choiceCaptions) {
    const text = select.selectedOptions[0]?.textContent || '';
    caption.textContent = select.value && select.value !== 'unknown' && text.length > 28 ? `Auswahl: ${text}` : '';
    caption.hidden = !caption.textContent;
  }
}
document.addEventListener('change', updateChoiceCaptions);
updateChoiceCaptions();
