import {
  FetchTitlesResponse,
  MessageType,
  SUPPORTED_DOMAINS
} from '../shared/types';

interface ProcessedLink {
  span: HTMLElement;
  link: HTMLAnchorElement;
  url: string;
  originalText: string;
}

const processedSpans = new WeakSet<HTMLElement>();

function isSupportedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_DOMAINS.some(domain => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

function findHeadlineLinks(spans: HTMLElement[]): ProcessedLink[] {

  const links: ProcessedLink[] = spans
    .filter(span => !processedSpans.has(span))
    .map(span => {
      const link = span.closest<HTMLAnchorElement>('a[href]');
      const href = link?.getAttribute('href');
      if (!link || !href) return null;

      try {
        const absoluteUrl = new URL(href, window.location.href).href;
        const text = span.textContent?.trim() || '';

        if (!isSupportedUrl(absoluteUrl) ) {
          return null;
        }

        return { span, link, url: absoluteUrl, originalText: text };
      } catch {
        return null;
      }
    })
    .filter((item): item is ProcessedLink => item !== null);

  return links;
}

function replaceLinkText(span: HTMLElement, link: HTMLAnchorElement, newTitle: string, description: string | null): void {
  if (processedSpans.has(span)) return;

  const currentText = span.textContent?.trim() || '';
  if (!currentText || currentText === newTitle) return;

  const [tags, title] = newTitle.split(' | ');

  if(tags && title){
    const tagsElm = document.createElement('span');
    tagsElm.style.fontSize = '0.8em';
    tagsElm.style.display = 'block';
    tagsElm.textContent = tags;

    const titleElm = document.createElement('span');
    titleElm.textContent = title;
    span.replaceChildren(tagsElm, titleElm);
  }else{
    span.textContent = newTitle;
  }
  
  // Remove the annoying red dot
  if(span.previousElementSibling?.nodeName === 'BREAKING-TEXT'){
    span.previousElementSibling.remove();
  }

  const brickParent = span.closest('.break.brick-c-JbDTi');
  if(brickParent){
    brickParent.classList.remove('break', 'brick-c-JbDTi');
    span.style.fontSize = 'var(--brick-fontSizes-pretitleXl)';
  }

  processedSpans.add(span);

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
      console.log('got response', response);
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

async function processLinks(spans: HTMLElement[]): Promise<void> {
  const headlineLinks = findHeadlineLinks(spans);

  console.log(headlineLinks);

  if (headlineLinks.length === 0) return;

  const urls = headlineLinks.map(link => link.url);
  const titles = await fetchTitles(urls);

  console.log('got titles', titles);

  for (const item of headlineLinks) {
    const data = titles.get(item.url);
    if (data?.title) {
      replaceLinkText(item.span, item.link, data.title, data.description);
    }
  }
}

async function start() {
  const spans = Array.from(document.querySelectorAll<HTMLElement>(
    'a[itemprop="url"] [itemprop="titleText"]'
  ));

  const intersectionObserver = new IntersectionObserver((entries) => {
    const visibleSpans = entries.filter(entry => entry.isIntersecting).map(entry => entry.target as HTMLElement);
    if (visibleSpans.length === 0) return;
    processLinks(visibleSpans);
    visibleSpans.forEach(entry => {
      intersectionObserver.unobserve(entry);
    });
  }, {  });

  for (const span of spans) {
    intersectionObserver.observe(span);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        const nodes = Array.from(mutation.addedNodes)
          .flatMap(node => node instanceof HTMLElement ? Array.from(node.querySelectorAll<HTMLElement>('a[itemprop="url"] [itemprop="titleText"]')) : []);
        for (const span of nodes) {
          intersectionObserver.observe(span);
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
