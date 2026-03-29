import {
  FetchTitlesResponse,
  MessageType,
  SUPPORTED_DOMAINS
} from '../shared/types';

interface ProcessedLink {
  headline: HTMLElement;
  link: HTMLAnchorElement;
  url: string;
  originalText: string;
}

const processedHeadlines = new WeakSet<HTMLElement>();

function isSupportedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_DOMAINS.some(domain => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

function findHeadlineLinks(headlines: HTMLElement[]): ProcessedLink[] {

  const links: ProcessedLink[] = headlines
    .filter(headline => !processedHeadlines.has(headline))
    .map(headline => {
      const link = headline.closest<HTMLAnchorElement>('a[itemprop="url"]');
      const href = link?.getAttribute('href');
      if (!link || !href) return null;

      try {
        const absoluteUrl = new URL(href, window.location.href).href;
        const text = headline.textContent?.trim() || '';

        if (!isSupportedUrl(absoluteUrl)) {
          return null;
        }

        return { headline, link, url: absoluteUrl, originalText: text };
      } catch {
        return null;
      }
    })
    .filter((item): item is ProcessedLink => item !== null);

  return links;
}

function replaceLinkText(headline: HTMLElement, link: HTMLAnchorElement, newTitle: string, description: string | null): void {
  if (processedHeadlines.has(headline)) return;

  const currentText = headline.textContent?.trim() || '';
  if (!currentText || currentText === newTitle) return;

  headline.textContent = newTitle;
  processedHeadlines.add(headline);

  link.style.borderBottom = '1px dotted #666';
  link.title = description || `Original: "${currentText}"`;
}

async function fetchTitles(urls: string[]): Promise<Map<string, { title: string | null; description: string | null }>> {
  const results = new Map<string, { title: string | null; description: string | null }>();

  if (urls.length === 0) return results;

  return new Promise((resolve) => {
    const message: MessageType = {
      type: 'FETCH_TITLES',
      payload: { urls }
    };

    chrome.runtime.sendMessage(message, (response: FetchTitlesResponse | undefined) => {
      if (response?.results) {
        for (const result of response.results) {
          results.set(result.url, { title: result.title, description: result.description });
        }
      }
      resolve(results);
    });

    setTimeout(() => resolve(results), 3000);
  });
}

async function processLinks(headlines: HTMLElement[]): Promise<void> {
  const headlineLinks = findHeadlineLinks(headlines);

  if (headlineLinks.length === 0) return;

  console.log(`Processing ${headlineLinks.length} links on dagbladet.no`, headlineLinks);

  const urls = headlineLinks.map(link => link.url);
  const titles = await fetchTitles(urls);

  console.log('Fetched titles for dagbladet.no:', titles);
  
  for (const item of headlineLinks) {
    const data = titles.get(item.url);
    if (data?.title) {
      replaceLinkText(item.headline, item.link, data.title, data.description);
    }
  }
}

async function start() {
  const headlines = Array.from(document.querySelectorAll<HTMLElement>(
    'a[itemprop="url"] h2[itemprop="headline"]'
  ));

  const intersectionObserver = new IntersectionObserver((entries) => {
    const visibleHeadlines = entries.filter(entry => entry.isIntersecting).map(entry => entry.target as HTMLElement);
    if (visibleHeadlines.length === 0) return;
    processLinks(visibleHeadlines);
    visibleHeadlines.forEach(entry => {
      intersectionObserver.unobserve(entry);
    });
  }, {});

  for (const headline of headlines) {
    intersectionObserver.observe(headline);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        const nodes = Array.from(mutation.addedNodes)
          .flatMap(node => node instanceof HTMLElement ? Array.from(node.querySelectorAll<HTMLElement>('a[itemprop="url"] h2[itemprop="headline"]')) : []);
        for (const headline of nodes) {
          intersectionObserver.observe(headline);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function init(): void {
  if (document.readyState === 'complete') {
    setTimeout(start, 100);
  } else {
    window.addEventListener('load', () => setTimeout(start, 100));
  }
}

init();
