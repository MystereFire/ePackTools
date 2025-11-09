import { logger } from "../logger.js";

const API_BASE_URL = "https://api.bluconsole.com";
const COOKIE_URL = "https://api.bluconsole.com/";
const DEFAULT_HEADERS = {
  "x-console-language": "fr",
  "x-time-zone": "Europe/Paris",
};

const storageGet = (keys) =>
  new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (values) =>
  new Promise((resolve) => chrome.storage.local.set(values, resolve));

function setCookie(name, value) {
  if (!value) return Promise.resolve();
  return new Promise((resolve, reject) => {
    chrome.cookies.set(
      {
        url: COOKIE_URL,
        name,
        value,
        path: "/",
        secure: true,
        sameSite: "no_restriction",
      },
      (cookie) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(cookie);
        }
      },
    );
  });
}

async function persistSession({ token, refreshToken, user }) {
  await storageSet({
    bluconsoleToken: token,
    bluconsoleRefreshToken: refreshToken,
    bluconsoleUser: user || null,
  });
  await Promise.all([setCookie("token", token), setCookie("rtoken", refreshToken)]);
}

async function syncCookiesFromStorage() {
  const { bluconsoleToken, bluconsoleRefreshToken } = await storageGet([
    "bluconsoleToken",
    "bluconsoleRefreshToken",
  ]);
  if (!bluconsoleToken || !bluconsoleRefreshToken) {
    return false;
  }
  try {
    await Promise.all([
      setCookie("token", bluconsoleToken),
      setCookie("rtoken", bluconsoleRefreshToken),
    ]);
    return true;
  } catch (err) {
    logger.warn("Impossible de synchroniser les cookies BluConsole", err);
    return false;
  }
}

async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Email: email, Password: password }),
    credentials: "include",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Connexion BluConsole refusee");
  }

  const data = await response.json();
  const token = data?.Result?.Token;
  const refreshToken = data?.Result?.RefreshToken;
  if (!token || !refreshToken) {
    throw new Error("Reponse de login BluConsole invalide");
  }

  const session = {
    token,
    refreshToken,
    user: data?.Result?.UserData || null,
  };
  await persistSession(session);
  return session;
}

async function loginWithStoredCredentials() {
  const { probeEmail, probePassword } = await storageGet([
    "probeEmail",
    "probePassword",
  ]);
  if (!probeEmail || !probePassword) {
    throw new Error("Identifiants BluConsole manquants");
  }
  return login(probeEmail, probePassword);
}

async function ensureSession() {
  if (await syncCookiesFromStorage()) {
    return true;
  }
  try {
    await loginWithStoredCredentials();
    await syncCookiesFromStorage();
    return true;
  } catch (err) {
    logger.warn("Impossible d'initialiser la session BluConsole", err);
    return false;
  }
}

async function fetchJson(path, options = {}) {
  const { method = "GET", headers = {}, body, retry = true, auth = true } = options;

  if (auth) {
    const sessionReady = await ensureSession();
    if (!sessionReady) {
      throw new Error("Session BluConsole indisponible");
    }
  }

  const finalHeaders = { ...DEFAULT_HEADERS, ...headers };
  const init = {
    method,
    headers: finalHeaders,
    credentials: "include",
  };

  if (body !== undefined) {
    if (typeof body === "string") {
      init.body = body;
    } else {
      finalHeaders["Content-Type"] =
        finalHeaders["Content-Type"] || "application/json";
      init.body = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (response.status === 401 && retry && auth) {
    await loginWithStoredCredentials();
    await syncCookiesFromStorage();
    return fetchJson(path, { ...options, retry: false });
  }

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export const bluconsoleApi = {
  login,
  loginWithStoredCredentials,
  fetchJson,
  ensureSession,
};
