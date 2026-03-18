const apikey = 'f2320fafdc747ccce60bd05a8b659135';
const baseUrl = 'https://api.themoviedb.org/3';

const searchInput = document.getElementById('search-input');
const resultList = document.getElementById('result-list');
const resultHeader = document.getElementById('results-header');
const statusBar = document.getElementById('status-bar');
const template = document.getElementById('result-template');
const searchWrap = searchInput.closest('[data-loading]');
const detailEmpty = document.getElementById('detail-empty');
const detailContent = document.getElementById('detail-content');

let debounceTimer = null;
let controller = null;
let activeIndex = -1;

// ─── Helpers ──────────────────────────────────────────────
function buildHighlightedTitle(title, query) {
  const container = document.createElement('span');
  if (!query) { container.textContent = title; return container; }
  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) { container.textContent = title; return container; }
  container.appendChild(document.createTextNode(title.slice(0, idx)));
  const mark = document.createElement('span');
  mark.className = 'highlight';
  mark.textContent = title.slice(idx, idx + query.length);
  container.appendChild(mark);
  container.appendChild(document.createTextNode(title.slice(idx + query.length)));
  return container;
}

function renderResults(results, query) {
  const frag = document.createDocumentFragment();
  results.forEach((movie, i) => {
    const clone = template.content.cloneNode(true);
    const item = clone.querySelector('.result-item');
    const titleEl = clone.querySelector('.result-title');
    const meta = clone.querySelector('.result-meta');
    const rating = clone.querySelector('.result-rating');

    titleEl.appendChild(buildHighlightedTitle(movie.title, query));
    meta.textContent = `${movie.release_date?.slice(0,4)||'N/A'} · ${movie.genre_ids?.join(', ') || ''}`;
    rating.textContent = movie.vote_average ? `★ ${movie.vote_average}` : '';

    item.dataset.id = movie.id;
    item.dataset.idx = i;
    item.addEventListener('click', () => selectMovie(movie.id));
    frag.appendChild(clone);
  });

  resultList.innerHTML = '';
  resultList.appendChild(frag);
  resultHeader.textContent = `${results.length} RESULT${results.length!==1?'S':''}`;
}

function setActive(idx) {
  activeIndex = idx;
  document.querySelectorAll('.result-item').forEach((el,i) => el.classList.toggle('active', i===idx));
}

// ─── Fetch Movies ─────────────────────────────────────────
function searchMovies(query) {
  searchWrap.dataset.loading = 'true';
  statusBar.textContent = 'FETCHING…';

  if (controller) controller.abort();
  controller = new AbortController();

  fetch(`${baseUrl}/search/movie?api_key=${apikey}&query=${encodeURIComponent(query)}`, {signal: controller.signal})
    .then(res => res.json())
    .then(data => {
      renderResults(data.results || [], query);
      searchWrap.dataset.loading = 'false';
      statusBar.textContent = `${data.results?.length || 0} RESULTS · NETWORK`;
    })
    .catch(err => {
      if (err.name === 'AbortError') console.log('Previous request cancelled');
      else console.error(err);
      searchWrap.dataset.loading = 'false';
      statusBar.textContent = 'ERROR';
    });
}

// ─── Select Movie ─────────────────────────────────────────
async function selectMovie(movieId) {
  detailEmpty.style.display = 'none';
  detailContent.classList.remove('visible');
  void detailContent.offsetWidth;
  detailContent.classList.add('visible');

  const urls = [
    `${baseUrl}/movie/${movieId}?api_key=${apikey}`,      // details
    `${baseUrl}/movie/${movieId}/credits?api_key=${apikey}`, // credits
    `${baseUrl}/movie/${movieId}/videos?api_key=${apikey}`   // trailers
  ];

  const results = await Promise.allSettled(urls.map(url => fetch(url).then(r=>r.json())));

  const [details, credits, videos] = results;

  if(details.status==='fulfilled') renderDetails(details.value);
  if(credits.status==='fulfilled') renderCredits(credits.value);
  if(videos.status==='fulfilled') renderVideos(videos.value);

  results.forEach((res,i)=>{
    if(res.status==='rejected') console.warn(`Request ${i} failed`, res.reason);
  });
}

// ─── Render Panels ────────────────────────────────────────
function renderDetails(d) {
  document.getElementById('detail-title').textContent = d.title;
  document.getElementById('detail-tagline').textContent = d.tagline || '';
  document.getElementById('detail-overview').textContent = d.overview;

  const badges = document.getElementById('detail-badges');
  badges.innerHTML = '';
  const yearBadge = document.createElement('span');
  yearBadge.className = 'badge accent';
  yearBadge.textContent = d.release_date?.slice(0,4) || '';
  badges.appendChild(yearBadge);
}

function renderCredits(c) {
  const castGrid = document.getElementById('detail-cast');
  castGrid.innerHTML = '';
  c.cast?.slice(0,10).forEach(member=>{
    const item = document.createElement('div'); item.className='cast-item';
    const avatar = document.createElement('div'); avatar.className='cast-avatar';
    avatar.textContent = member.name[0] || '👤';
    const name = document.createElement('div'); name.className='cast-name'; name.textContent = member.name;
    const char = document.createElement('div'); char.className='cast-char'; char.textContent = member.character;
    item.appendChild(avatar); item.appendChild(name); item.appendChild(char);
    castGrid.appendChild(item);
  });
}

function renderVideos(v) {
  const trailerEl = document.getElementById('detail-trailer');
  trailerEl.innerHTML = '';
  const trailer = v.results?.find(t=>t.type==='Trailer');
  if(trailer){
    const btn = document.createElement('button');
    btn.className='trailer-btn';
    btn.textContent='▶ Watch Trailer';
    btn.onclick=()=>window.open(`https://www.youtube.com/watch?v=${trailer.key}`,'_blank');
    trailerEl.appendChild(btn);
  } else {
    const msg = document.createElement('p');
    msg.className='trailer-failed';
    msg.textContent='Trailer unavailable.';
    trailerEl.appendChild(msg);
  }
}

// ─── Event Listeners ─────────────────────────────────────
searchInput.addEventListener('input', e=>{
  clearTimeout(debounceTimer);
  const q = e.target.value.trim();
  if(!q){ resultList.innerHTML=''; statusBar.textContent='READY'; return; }
  debounceTimer = setTimeout(()=>searchMovies(q),300);
});

// ─── Keyboard Navigation ─────────────────────────────────
searchInput.addEventListener('keydown', e=>{
  const items = document.querySelectorAll('.result-item');
  if(e.key==='ArrowDown'){ e.preventDefault(); setActive(Math.min(activeIndex+1, items.length-1)); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(Math.max(activeIndex-1,0)); }
  else if(e.key==='Enter'){ if(activeIndex>=0){ selectMovie(items[activeIndex].dataset.id); } }
});