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
let activeElement = null;

const cache = new Map();

function highlight(text, query) {
  const container = document.createElement('span');

  if (!query) {
    container.textContent = text;
    return container;
  }

  const idx = text.toLowerCase().indexOf(query.toLowerCase());

  if (idx === -1) {
    container.textContent = text;
    return container;
  }

  const before = document.createTextNode(text.slice(0, idx));

  const match = document.createElement('span');
  match.className = 'highlight';
  match.textContent = text.slice(idx, idx + query.length);

  const after = document.createTextNode(text.slice(idx + query.length));

  container.appendChild(before);
  container.appendChild(match);
  container.appendChild(after);

  return container;
}

function showEmptyState() {
  detailContent.innerHTML = '';
  const empty = document.createElement('div');
  empty.textContent = '🎬 Search for a movie';
  detailContent.appendChild(empty);
}

function renderResults(results, query) {
  const frag = document.createDocumentFragment();

  results.forEach((movie, i) => {
    const clone = template.content.cloneNode(true);

    const item = clone.querySelector('.result-item');
    const titleEl = clone.querySelector('.result-title');
    const meta = clone.querySelector('.result-meta');
    const rating = clone.querySelector('.result-rating');
    const poster = clone.querySelector('.result-poster-placeholder');

    const imgUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
      : '';

    poster.textContent = '';
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.className = 'poster-small';
      poster.appendChild(img);
    } else {
      poster.textContent = '🎬';
    }

    titleEl.textContent = '';
    titleEl.appendChild(highlight(movie.title, query));

    meta.textContent = movie.release_date
      ? movie.release_date.slice(0, 4)
      : 'No year';

    rating.textContent = movie.vote_average
      ? `★ ${movie.vote_average.toFixed(1)}`
      : '';

    item.addEventListener('click', () => selectMovie(movie, item));

    frag.appendChild(clone);
  });

  resultList.innerHTML = '';
  resultList.appendChild(frag);

  resultHeader.textContent = `${results.length} RESULTS`;
}

function searchMovies(query) {
  if (cache.has(query)) {
    renderResults(cache.get(query), query);
    statusBar.textContent = 'FROM CACHE';
    return;
  }

  searchWrap.dataset.loading = 'true';

  if (controller) controller.abort();
  controller = new AbortController();

  fetch(`${baseUrl}/search/movie?api_key=${apikey}&query=${query}`, {
    signal: controller.signal
  })
    .then(res => res.json())
    .then(data => {
      const results = data.results || [];
      cache.set(query, results);
      renderResults(results, query);
      statusBar.textContent = `${results.length} RESULTS`;
    })
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err);
    })
    .finally(() => {
      searchWrap.dataset.loading = 'false';
    });
}

async function selectMovie(movie, element) {
  if (activeElement) activeElement.classList.remove('active');

  activeElement = element;
  element.classList.add('active');

  detailEmpty.style.display = 'none';
  detailContent.innerHTML = '';

  const urls = [
    `${baseUrl}/movie/${movie.id}?api_key=${apikey}`,
    `${baseUrl}/movie/${movie.id}/credits?api_key=${apikey}`,
    `${baseUrl}/movie/${movie.id}/videos?api_key=${apikey}`
  ];

  const [detailsRes, creditsRes, videosRes] = await Promise.allSettled(
    urls.map(url => fetch(url).then(r => r.json()))
  );

  const details = detailsRes.status === 'fulfilled' ? detailsRes.value : null;
  const credits = creditsRes.status === 'fulfilled' ? creditsRes.value : null;
  const videos = videosRes.status === 'fulfilled' ? videosRes.value : null;

  if (details) {
    const title = document.createElement('h2');
    title.textContent = details.title;

    const overview = document.createElement('p');
    overview.textContent = details.overview;

    detailContent.appendChild(title);
    detailContent.appendChild(overview);
  }

  if (credits) {
    const cast = document.createElement('p');
    cast.textContent = credits.cast
      .slice(0, 5)
      .map(c => c.name)
      .join(', ');

    detailContent.appendChild(cast);
  }

  if (videos) {
    const trailer = videos.results?.find(v => v.type === 'Trailer');

    if (trailer) {
      const btn = document.createElement('button');
      btn.textContent = '▶ Watch Trailer';

      btn.addEventListener('click', () => {
        window.open(`https://youtube.com/watch?v=${trailer.key}`);
      });

      detailContent.appendChild(btn);
    }
  }
}

searchInput.addEventListener('input', e => {
  clearTimeout(debounceTimer);

  const q = e.target.value.trim();

  if (!q) {
    resultList.innerHTML = '';
    showEmptyState();
    return;
  }

  debounceTimer = setTimeout(() => {
    activeIndex = -1;

    if (cache.has(q)) {
      renderResults(cache.get(q), q);
    } else {
      searchMovies(q);
    }
  }, 300);
});

searchInput.addEventListener('keydown', e => {
  const items = document.querySelectorAll('.result-item');

  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
  } else if (e.key === 'Enter') {
    if (activeIndex >= 0) {
      items[activeIndex].click();
    }
    return;
  } else return;

  items.forEach(item => item.classList.remove('active'));

  items[activeIndex].classList.add('active');
  items[activeIndex].scrollIntoView({ block: 'nearest' });
});

showEmptyState();