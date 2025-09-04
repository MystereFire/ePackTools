(function () {
  function handleRequest(url, body) {
    if (typeof url !== 'string' || typeof body !== 'string') return;
    console.log(`Intercepted request: ${url}`);
    chrome.runtime.sendMessage({ type: 'requestIntercepted', url });
    if (url.includes('sale.order/read')) {
      chrome.runtime.sendMessage({ type: 'saleOrderRead', body });
    } else if (url.includes('mail/thread/data')) {
      chrome.runtime.sendMessage({ type: 'mailThreadData', body });
    }
  }

  function interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
      try {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init && init.method) || 'GET';
        const body = init && init.body;
        console.log(`[request-interceptor] ${method} ${url}`);
        if (method === 'POST' && body) {
          if (typeof body === 'string') {
            handleRequest(url, body);
          } else if (body instanceof URLSearchParams) {
            handleRequest(url, body.toString());
          }
        }
      } catch (e) {
        // ignore errors
      }
      return originalFetch.apply(this, arguments);
    };
  }

  function interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._method = method;
      this._url = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      try {
        console.log(`[request-interceptor] ${this._method} ${this._url}`);
        if (this._method === 'POST' && typeof body === 'string') {
          handleRequest(this._url, body);
        }
      } catch (e) {
        // ignore
      }
      return originalSend.apply(this, arguments);
    };
  }

  interceptFetch();
  interceptXHR();
})();
