class SearchComp {
  constructor() {
    this.apikey = "f2320fafdc747ccce60bd05a8b659135";
    this.baseUrl = "https://api.themoviedb.org/3";

    this.cache = new Map();
    this.debounceTimer = null;
    this.controller = null; // for AbortController

    this.input = document.getElementById("search-input");
    this.resultsCont = document.getElementById("results");

    this.init();
  }

  init() {
    this.input.addEventListener("input", (e) => {
      this.handleInput(e.target.value);
    });
  }

  handleInput(value) {
    this.debounceSearch(value);
  }

  debounceSearch(value) {
    clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.searchMovies(value);
    }, 300);
  }

  async searchMovies(query) {
    if (!query) {
      this.resultsCont.innerHTML = "";
      return;
    }

    // ✅ CACHE CHECK
    if (this.cache.has(query)) {
      console.log("CACHE HIT");
      this.renderResults(this.cache.get(query));
      return;
    }

    // ✅ ABORT PREVIOUS REQUEST
    if (this.controller) {
      this.controller.abort();
    }

    this.controller = new AbortController();

    try {
      const res = await fetch(
        `${this.baseUrl}/search/movie?api_key=${this.apikey}&query=${query}`,
        { signal: this.controller.signal }
      );

      const data = await res.json();

      const results = data.results || [];

      // ✅ SAVE TO CACHE
      this.cache.set(query, results);

      this.renderResults(results);

    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Request cancelled");
      } else {
        console.error("Error:", err);
      }
    }
  }

  renderResults(movies) {
    const frag = new DocumentFragment();

    movies.forEach((movie) => {
      const item = document.createElement("div");
      item.className = "movie-item";

      const title = document.createElement("p");
      title.textContent = movie.title;

      const year = document.createElement("small");
      year.textContent = movie.release_date
        ? movie.release_date.split("-")[0]
        : "N/A";

      item.appendChild(title);
      item.appendChild(year);

      frag.appendChild(item);
    });

    this.resultsCont.innerHTML = "";
    this.resultsCont.appendChild(frag);
  }
}

// start app
new SearchComp();