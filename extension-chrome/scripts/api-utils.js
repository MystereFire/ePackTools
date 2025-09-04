// Helper functions dealing with API calls or HTML parsing
const apiUtils = {
  getBOSSID(callback) {
    chrome.cookies.get(
      { url: 'https://backoffice.epack-manager.com', name: 'BOSSID' },
      (cookie) => callback(cookie ? cookie.value : null),
    );
  },
  fetchWithCookie(url, method, BOSSID, headers = {}, body = null) {
    return fetch(url, {
      method,
      headers: {
        Cookie: `BOSSID=${BOSSID}`,
        ...headers,
      },
      body,
    });
  },
  checkIfUserExists(email) {
    const url = `https://backoffice.epack-manager.com/epack/manager/user/?search=${encodeURIComponent(email)}`;
    return fetch(url, { method: 'GET', credentials: 'include' })
      .then((response) => response.text())
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const userIdCell = doc.querySelector('table.table-bordered tr.color td:first-child');
        return userIdCell ? userIdCell.textContent.trim() : null;
      })
      .catch(() => null);
  },
};

self.apiUtils = apiUtils;
