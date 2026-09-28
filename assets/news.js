const select=document.getElementById('news-area');
const cards=[...document.querySelectorAll('[data-news-area]')];
const valid=new Set([...select.options].map(o=>o.value));
function render(value){select.value=valid.has(value)?value:'';let count=0;for(const card of cards){card.hidden=!!select.value&&card.dataset.newsArea!==select.value;if(!card.hidden)count++;}document.getElementById('news-count').textContent=count+' von '+cards.length+' Beiträgen';document.getElementById('news-empty').hidden=count>0;}
function fromUrl(){render(new URL(location.href).searchParams.get('ort')||'');}
select.closest('.news-filter').hidden=false;
select.addEventListener('change',()=>{const url=new URL(location.href);if(select.value)url.searchParams.set('ort',select.value);else url.searchParams.delete('ort');history.pushState({},'',url);render(select.value);});
window.addEventListener('popstate',fromUrl);fromUrl();

