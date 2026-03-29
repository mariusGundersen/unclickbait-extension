export const SUPPORTED_DOMAINS = [
  'nettavisen.no',
  'vg.no',
  'dagbladet.no',
  'nrk.no',
  'e24.no',
  'dn.no',
];

export interface TitleResult {
  url: string;
  title: string | null;
  description: string | null;
  timestamp: number;
}

export interface FetchTitlesRequest {
  urls: string[];
}

export interface FetchTitlesResponse {
  results: TitleResult[];
}

export type MessageType = 
  | { type: 'FETCH_TITLES'; payload: FetchTitlesRequest }
  | { type: 'FETCH_TITLES_RESULT'; payload: FetchTitlesResponse };

export const CACHE_EXPIRY_MS = 60 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 5000;
