const cache = new Map<string, Promise<string>>();

/** Fetches and inlines an SVG (rather than <img>) so its shapes can use
 *  `currentColor` / CSS variables and pick up the active theme automatically. */
export async function loadInlineSvgMarkup(url: string): Promise<string> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => r.text())
        .catch(() => "")
    );
  }
  return cache.get(url)!;
}

export async function mountInlineSvg(container: HTMLElement, url: string) {
  const markup = await loadInlineSvgMarkup(url);
  container.innerHTML = markup;
}
