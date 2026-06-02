import { SUPPORTED_DOMAINS } from '../shared/types';

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const supportedSitesEl = document.getElementById('supported-sites');
  const currentSiteEl = document.getElementById('current-site');
  
  if (statusEl && currentSiteEl) {
    const currentDomain = window.location.hostname.replace('www.', '');
    const isSupported = SUPPORTED_DOMAINS.some(domain => currentDomain.endsWith(domain));
    
    currentSiteEl.textContent = currentDomain;
    
    if (isSupported) {
      statusEl.textContent = 'Active';
      statusEl.className = 'status active';
    } else {
      statusEl.textContent = 'Not a supported site';
      statusEl.className = 'status inactive';
    }
  }
  
  if (supportedSitesEl) {
    supportedSitesEl.innerHTML = SUPPORTED_DOMAINS.map(s => `<li>${s}</li>`).join('');
  }
});
