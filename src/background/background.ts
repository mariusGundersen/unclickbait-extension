import {
  CACHE_EXPIRY_MS,
  FETCH_TIMEOUT_MS,
  FetchTitlesRequest,
  FetchTitlesResponse,
  MessageType,
  TitleResult
} from '../shared/types';

interface CacheEntry {
  title: string | null;
  description: string | null;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === 'FETCH_TITLES') {
    handleFetchTitles(message.payload)
      .then(sendResponse)
      .catch(() => sendResponse({ results: [] }));
    return true;
  }
});

async function handleFetchTitles(request: FetchTitlesRequest): Promise<FetchTitlesResponse> {
  const uncachedUrls: string[] = [];
  const results: TitleResult[] = [];

  for (const url of request.urls) {
    const cached = getCachedEntry(url);
    if (cached !== undefined) {
      results.push({ url, ...cached, timestamp: Date.now() });
    } else {
      uncachedUrls.push(url);
    }
  }

  if (uncachedUrls.length > 0) {
    const fetched = await Promise.allSettled(
      uncachedUrls.map(url => fetchAndExtractTitle(url))
    );

    for (let i = 0; i < uncachedUrls.length; i++) {
      const url = uncachedUrls[i];
      const result = fetched[i];
      const { title, description } = result.status === 'fulfilled' ? result.value : { title: null, description: null };
      
      cache.set(url, { title, description, timestamp: Date.now() });
      results.push({ url, title, description, timestamp: Date.now() });
    }

    await persistCacheToStorage();
  }

  return { results };
}

function getCachedEntry(url: string): { title: string | null; description: string | null } | undefined {
  const entry = cache.get(url);
  if (!entry) return undefined;
  
  if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
    cache.delete(url);
    return undefined;
  }
  
  return { title: entry.title, description: entry.description };
}

async function fetchAndExtractTitle(url: string): Promise<{ title: string | null; description: string | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return { title: null, description: null };

    const html = await response.text();
    return extractTitleAndDescription(html);
  } catch {
    clearTimeout(timeoutId);
    return { title: null, description: null };
  }
}

function extractTitleAndDescription(html: string): { title: string | null; description: string | null } {
  const title = extractTitle(html);
  const description = extractDescription(html);
  return { title, description };
}

function extractTitle(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch) return decodeHtml(ogMatch[1]);

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i);
  if (twitterMatch) return decodeHtml(twitterMatch[1]);

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return decodeHtml(cleanTitle(titleMatch[1]));

  return null;
}

function extractDescription(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogMatch) return decodeHtml(ogMatch[1]);

  const nameMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (nameMatch) return decodeHtml(nameMatch[1]);

  return null;
}

function decodeHtml(html: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*[^-|]+$/, '')
    .replace(/^[^|]+[|]\s*/, '')
    .trim();
}

async function persistCacheToStorage(): Promise<void> {
  try {
    const entries: Record<string, CacheEntry> = {};
    cache.forEach((value, key) => {
      entries[key] = value;
    });
    await chrome.storage.local.set({ titleCache: entries });
  } catch {
    // Storage quota exceeded, clear oldest entries
    const sorted = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    while (sorted.length > 100) {
      const removed = sorted.shift();
      if (removed) cache.delete(removed[0]);
    }
  }
}

async function loadCacheFromStorage(): Promise<void> {
  try {
    const data = await chrome.storage.local.get('titleCache');
    if (data.titleCache) {
      for (const [url, entry] of Object.entries(data.titleCache as Record<string, CacheEntry>)) {
        if (Date.now() - entry.timestamp < CACHE_EXPIRY_MS) {
          cache.set(url, entry);
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
}

loadCacheFromStorage();
