import './popup.css';

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const supportedSitesEl = document.getElementById('supported-sites');
  const currentSiteEl = document.getElementById('current-site');
  
  if (statusEl && currentSiteEl) {
    const currentDomain = window.location.hostname.replace('www.', '');
    const isSupported = currentDomain.includes('nettavisen') || 
                        currentDomain.includes('vg.') || 
                        currentDomain.includes('dagbladet') ||
                        currentDomain.includes('nrk') ||
                        currentDomain.includes('e24') ||
                        currentDomain.includes('dn') ||
                        currentDomain.includes('ao');
    
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
    const sites = [
      'nettavisen.no',
      'vg.no',
      'dagbladet.no',
      'nrk.no',
      'e24.no',
      'dn.no',
      'ao.no'
    ];
    supportedSitesEl.innerHTML = sites.map(s => `<li>${s}</li>`).join('');
  }
});
