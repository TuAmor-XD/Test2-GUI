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

// ✅ CACHE (Requirement 4)
const cache = new Map();

// ─── Highlight ─────────────────────────
function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, `<span class="highlight">$1</span>`);
}

// ─── Render Results (Fragment Pattern) ─────────────────
function renderResults(results, query) {
  const frag = document.createDocumentFragment();

  results.forEach((movie, i) => {
    const clone = template.content.cloneNode(true);

    const item = clone.querySelector('.result-item');
    const titleEl = clone.querySelector('.result-title');
    const meta = clone.querySelector('.result-meta');
    const rating = clone.querySelector('.result-rating');
    const poster = clone.querySelector('.result-poster-placeholder');

    // 🎬 SMALL IMAGE (fixed size)
    const imgUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
      : '';

    poster.innerHTML = imgUrl
      ? `<img src="${imgUrl}" class="poster-small">`
      : '🎬';

    // 🎯 TITLE + DESCRIPTION
    titleEl.innerHTML = highlight(movie.title, query);

    const overview = movie.overview
      ? movie.overview.slice(0, 80) + '...'
      : 'No description available';

    meta.textContent = overview;

    rating.textContent = movie.vote_average
      ? `★ ${movie.vote_average}`
      : '';

    item.dataset.id = movie.id;
    item.dataset.idx = i;

    item.addEventListener('click', () => selectMovie(movie.id));

    frag.appendChild(clone);
  });

  resultList.innerHTML = '';
  resultList.appendChild(frag); // ✅ ONE DOM WRITE

  resultHeader.textContent = `${results.length} RESULTS`;
}

// ─── Search Movies (Debounce + Abort + Cache) ───────────
function searchMovies(query) {
  // ✅ CACHE HIT
  if (cache.has(query)) {
    renderResults(cache.get(query), query);
    statusBar.textContent = 'FROM CACHE';
    return;
  }

  searchWrap.dataset.loading = 'true';
  statusBar.textContent = 'FETCHING…';

  if (controller) controller.abort(); // ✅ Abort previous
  controller = new AbortController();

  fetch(`${baseUrl}/search/movie?api_key=${apikey}&query=${query}`, {
    signal: controller.signal
  })
    .then(res => res.json())
    .then(data => {
      const results = data.results || [];

      cache.set(query, results); // ✅ SAVE CACHE

      renderResults(results, query);

      searchWrap.dataset.loading = 'false';
      statusBar.textContent = `${results.length} RESULTS`;
    })
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err);
      searchWrap.dataset.loading = 'false';
      statusBar.textContent = 'ERROR';
    });
}

// ─── Select Movie (Promise.allSettled) ────────────────
async function selectMovie(movieId) {
  detailEmpty.style.display = 'none';
  detailContent.classList.add('visible');

  const urls = [
    `${baseUrl}/movie/${movieId}?api_key=${apikey}`,
    `${baseUrl}/movie/${movieId}/credits?api_key=${apikey}`,
    `${baseUrl}/movie/${movieId}/videos?api_key=${apikey}`
  ];

  const [details, credits, videos] = await Promise.allSettled(
    urls.map(url => fetch(url).then(r => r.json()))
  );

  if (details.status === 'fulfilled') renderDetails(details.value);
  if (credits.status === 'fulfilled') renderCredits(credits.value);
  if (videos.status === 'fulfilled') renderVideos(videos.value);
}

// ─── Details UI ─────────────────────────
function renderDetails(d) {
  document.getElementById('detail-title').textContent = d.title;
  document.getElementById('detail-overview').textContent = d.overview;

  const posterWrap = document.getElementById('detail-poster-wrap');
  posterWrap.innerHTML = d.poster_path
    ? `<img src="https://image.tmdb.org/t/p/w300${d.poster_path}" class="poster-big">`
    : '';
}

// ─── Cast ─────────────────────────
function renderCredits(c) {
  const castGrid = document.getElementById('detail-cast');
  castGrid.innerHTML = '';

  c.cast?.slice(0, 6).forEach(actor => {
    const el = document.createElement('div');
    el.className = 'cast-item';

    el.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w185${actor.profile_path}" class="cast-img">
      <div>${actor.name}</div>
    `;

    castGrid.appendChild(el);
  });
}

// ─── Trailer ─────────────────────────
function renderVideos(v) {
  const trailerEl = document.getElementById('detail-trailer');
  trailerEl.innerHTML = '';

  const trailer = v.results?.find(t => t.type === 'Trailer');

  if (trailer) {
    trailerEl.innerHTML = `
      <button class="trailer-btn"
        onclick="window.open('https://youtube.com/watch?v=${trailer.key}')">
        ▶ Watch Trailer
      </button>
    `;
  }
}

// ─── Input (Debounce 300ms) ─────────────
searchInput.addEventListener('input', e => {
  clearTimeout(debounceTimer);

  const q = e.target.value.trim();

  if (!q) {
    resultList.innerHTML = '';
    statusBar.textContent = 'READY';
    return;
  }

  debounceTimer = setTimeout(() => searchMovies(q), 300); // ✅ REQUIRED
});

// ─── Keyboard Navigation ───────────────
searchInput.addEventListener('keydown', e => {
  const items = document.querySelectorAll('.result-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
  }

  if (e.key === 'Enter' && activeIndex >= 0) {
    selectMovie(items[activeIndex].dataset.id);
  }

  items.forEach((el, i) =>
    el.classList.toggle('active', i === activeIndex)
  );
});