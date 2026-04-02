/**
 * Staff IAM login for Unis Ticket: open Unis Ticket in the browser or an
 * embedded window, then POST /v1/staff/auth/login/iam with code/state/scope.
 */
import { EventEmitter } from 'events';
import { BrowserWindow, shell } from 'electron';
import { proxyAwareFetch } from './proxy-fetch';
import { logger } from './logger';

const DEFAULT_API_BASE = 'https://unisticket.item.com/api/item-tickets';
const DEFAULT_TENANT_ID = '1';
/** Default staff login entry (IAM is reached from this page). */
export const DEFAULT_UNIS_IAM_BROWSER_LOGIN_URL = 'https://unisticket.item.com/agent/login';
/** Common OAuth redirect path for the agent IAM flow (registered with IdP). */
export const DEFAULT_UNIS_IAM_WEB_REDIRECT_URI = 'https://unisticket.item.com/agent/login/iam/redirect';
/** Register this URI with your IAM OAuth client (see electron-builder protocols: itemclaw). */
export const ITEMCLAW_UNIS_IAM_REDIRECT_URI = 'itemclaw://unis-iam/callback';
/**
 * OIDC scopes for Ticket IAM exchange when the redirect URL has no `scope` (URL form:
 * `scope=profile%20email%20phone%20openid`). Override with `UNIS_IAM_SCOPE` or the Skills UI field.
 */
export const DEFAULT_UNIS_IAM_SCOPE = 'profile email phone openid';
const USER_AGENT = 'ItemClaw-TicketSkill/1.0';

export type UnisIamProgressPayload =
  | {
    phase: 'callback-received';
    transport: 'itemclaw';
    oauthError?: string;
    oauthErrorDescription?: string;
    hasAuthorizationCode: boolean;
    queryKeys: string[];
  }
  | {
    phase: 'redirect-captured';
    transport: 'embedded';
    /** Full callback URL (query includes code, state, optional scope). */
    callbackUrl: string;
  }
  | {
    phase: 'exchanging';
    transport: 'paste' | 'embedded';
  };

/** Forwarded to the renderer for IAM diagnostics (Unis Ticket dialog). */
export const unisIamOAuthEmitter = new EventEmitter();

function emitProgress(payload: UnisIamProgressPayload): void {
  unisIamOAuthEmitter.emit('progress', payload);
}

export type UnisIamExchangeOptions = {
  /** Defaults to UNIS_TICKET_API_BASE or production Unis Ticket API base. */
  apiBase?: string;
  /** Stage / optional x-api-key header (UNIS_TICKET_X_API_KEY). */
  xApiKey?: string;
  /**
   * Overrides redirect URI sent to the API (must match IAM registration).
   * When omitted, the value is taken from the pasted URL (origin + path).
   */
  redirectUri?: string;
  /** Used in the login/iam body when `scope` is absent from the pasted URL. */
  scopeFallback?: string;
  /** For progress events only (embedded vs manual paste). */
  progressTransport?: 'paste' | 'embedded';
};

export type UnisIamLoginResult = {
  ok: boolean;
  token?: string;
  iamToken?: string;
  error?: string;
};

type LoginIamApiResponse = {
  success?: boolean;
  msg?: string;
  code?: number | string;
  data?: {
    session?: {
      token?: string;
      iamToken?: string;
    };
  };
};

function isItemclawUnisIamCallback(parsed: URL): boolean {
  if (parsed.protocol !== 'itemclaw:') return false;
  if (parsed.hostname.toLowerCase() !== 'unis-iam') return false;
  const p = (parsed.pathname.replace(/\/+$/, '') || '/') as string;
  return p === '/callback';
}

function redirectUriFromCallbackUrl(u: URL): string {
  if (u.protocol === 'itemclaw:') {
    const host = u.hostname;
    const path = u.pathname || '/';
    return `itemclaw://${host}${path}`;
  }
  return `${u.origin}${u.pathname}`;
}

export type ParsedUnisIamRedirect =
  | {
    code: string;
    state: string;
    scope: string;
    redirectUri: string;
  }
  | { error: string };

/**
 * Parse a pasted redirect URL (Unis Ticket web, or legacy itemclaw:// callback).
 */
export function parseUnisIamRedirectUrl(pasted: string): ParsedUnisIamRedirect {
  const raw = pasted.trim();
  if (!raw) {
    return { error: 'URL is empty' };
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { error: 'Invalid URL' };
  }

  const oauthError = u.searchParams.get('error');
  if (oauthError) {
    return {
      error: u.searchParams.get('error_description')?.trim() || oauthError,
    };
  }

  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  if (!code || !state) {
    return { error: 'URL must include code and state query parameters' };
  }

  const scope = u.searchParams.get('scope')?.trim() ?? '';
  const redirectUri = redirectUriFromCallbackUrl(u);
  return { code, state, scope, redirectUri };
}

function resolveExchangeOptions(overrides: UnisIamExchangeOptions): {
  apiBase: string;
  scopeFallback: string;
  xApiKey?: string;
} {
  const apiBase = (overrides.apiBase?.trim()
    || process.env.UNIS_TICKET_API_BASE?.trim()
    || DEFAULT_API_BASE).replace(/\/$/, '');
  const scopeFallback = (overrides.scopeFallback?.trim()
    || process.env.UNIS_IAM_SCOPE?.trim()
    || DEFAULT_UNIS_IAM_SCOPE);
  const xApiKey = overrides.xApiKey?.trim()
    || process.env.UNIS_TICKET_X_API_KEY?.trim()
    || undefined;
  return { apiBase, scopeFallback, xApiKey };
}

/**
 * Handle itemclaw://unis-iam/callback?… from OS (macOS open-url, Windows argv / second-instance).
 * Returns true if the URL was recognized as the Unis IAM callback.
 */
export function dispatchUnisIamDeepLink(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    logger.warn('[UnisIAM] Ignored deep link: invalid URL');
    return false;
  }

  if (!isItemclawUnisIamCallback(parsed)) {
    return false;
  }

  const oauthError = parsed.searchParams.get('error');
  const oauthErrorDesc = parsed.searchParams.get('error_description');
  const code = parsed.searchParams.get('code');

  logger.info('[UnisIAM] Itemclaw OAuth redirect received', {
    hasCode: Boolean(code),
    hasError: Boolean(oauthError),
    queryKeys: [...parsed.searchParams.keys()],
  });

  emitProgress({
    phase: 'callback-received',
    transport: 'itemclaw',
    oauthError: oauthError ?? undefined,
    oauthErrorDescription: oauthErrorDesc ?? undefined,
    hasAuthorizationCode: Boolean(code),
    queryKeys: [...parsed.searchParams.keys()],
  });

  return true;
}

async function exchangeIamCode(params: {
  apiBase: string;
  code: string;
  redirectUri: string;
  scope: string;
  state: string;
  xApiKey?: string;
}): Promise<{ token?: string; iamToken?: string; msg?: string; success?: boolean }> {
  const tenantId = process.env.UNIS_TICKET_TENANT_ID?.trim() || DEFAULT_TENANT_ID;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    'X-Tenant-Id': tenantId,
  };
  if (params.xApiKey) {
    headers['x-api-key'] = params.xApiKey;
  }

  const res = await proxyAwareFetch(`${params.apiBase}/v1/staff/auth/login/iam`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: params.code,
      redirectUri: params.redirectUri,
      scope: params.scope,
      state: params.state,
    }),
  });

  const text = await res.text();
  let data: LoginIamApiResponse;
  try {
    data = JSON.parse(text) as LoginIamApiResponse;
  } catch {
    return {
      success: false,
      msg: `Invalid JSON from IAM login (${res.status})`,
    };
  }

  const codeOk = data.code === '200' || data.code === 200;
  const apiOk = data.success === true || codeOk;
  if (!res.ok || !apiOk) {
    return {
      success: false,
      msg: data?.msg ?? `IAM login failed (${res.status})`,
    };
  }

  const token = data.data?.session?.token;
  const iamToken = data.data?.session?.iamToken;
  if (!token && !iamToken) {
    return {
      success: false,
      msg: data?.msg ?? 'IAM login succeeded but no session token was returned',
    };
  }

  return {
    success: true,
    token: token || iamToken,
    iamToken: iamToken || token,
  };
}

const UNIS_EMBEDDED_SESSION_PARTITION = 'persist:unis-ticket-iam-login';

let unisIamEmbeddedWindow: BrowserWindow | null = null;
let unisIamEmbeddedCaptureDone = false;

function unisTicketOAuthHostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'unisticket.item.com'
    || h.endsWith('.unisticket.item.com')
    || (h.includes('unisticket') && h.endsWith('item.com'));
}

/**
 * Returns the URL if it is an Unis Ticket navigation carrying OAuth `code` and `state` (query string).
 */
function tryExtractUnisTicketOAuthCallbackUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!unisTicketOAuthHostAllowed(u.hostname)) return null;
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state');
    if (code && state) return rawUrl;
  } catch {
    return null;
  }
  return null;
}

function attachUnisIamEmbeddedCapture(win: BrowserWindow): void {
  const tryEmit = (url: string) => {
    if (unisIamEmbeddedCaptureDone) return;
    const callbackUrl = tryExtractUnisTicketOAuthCallbackUrl(url);
    if (!callbackUrl) return;
    unisIamEmbeddedCaptureDone = true;
    logger.info('[UnisIAM] OAuth callback captured in embedded window');
    emitProgress({
      phase: 'redirect-captured',
      transport: 'embedded',
      callbackUrl,
    });
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.close();
      }
    }, 400);
  };

  win.webContents.on('will-redirect', (_event, url) => {
    tryEmit(url);
  });
  win.webContents.on('did-navigate', (_event, url) => {
    tryEmit(url);
  });
  win.webContents.on('did-navigate-in-page', (_event, url) => {
    tryEmit(url);
  });
}

/**
 * Opens Unis Ticket login inside an app window so OAuth redirects are observed before the SPA replaces the URL.
 */
export function openUnisTicketIamEmbeddedLogin(
  parent: BrowserWindow,
  loginUrl?: string,
): { ok: boolean; error?: string } {
  if (parent.isDestroyed()) {
    return { ok: false, error: 'Main window is not available' };
  }

  cancelUnisIamLogin();

  const url = (loginUrl?.trim()
    || process.env.UNIS_IAM_LOGIN_URL?.trim()
    || DEFAULT_UNIS_IAM_BROWSER_LOGIN_URL);

  unisIamEmbeddedCaptureDone = false;
  const win = new BrowserWindow({
    width: 520,
    height: 780,
    parent,
    modal: true,
    show: true,
    title: 'Unis Ticket — Sign in',
    autoHideMenuBar: true,
    webPreferences: {
      partition: UNIS_EMBEDDED_SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  unisIamEmbeddedWindow = win;
  attachUnisIamEmbeddedCapture(win);

  win.on('closed', () => {
    if (unisIamEmbeddedWindow === win) {
      unisIamEmbeddedWindow = null;
    }
  });

  void win.loadURL(url).catch((err) => {
    logger.error('[UnisIAM] Embedded login window failed to load', err);
  });

  return { ok: true };
}

export type UnisIamOpenLoginArg = {
  loginUrl?: string;
  /** `embedded` captures OAuth redirect inside the app; `external` uses the system browser. */
  mode?: 'external' | 'embedded';
};

/**
 * Opens login in the system browser or an embedded window (recommended when the SPA clears the callback URL).
 */
export async function openUnisTicketIamLogin(
  mainWindow: BrowserWindow | null,
  arg?: string | UnisIamOpenLoginArg,
): Promise<{ ok: boolean; error?: string }> {
  const params: UnisIamOpenLoginArg = typeof arg === 'string'
    ? { loginUrl: arg, mode: 'external' }
    : { mode: 'external', ...arg };
  const mode = params.mode ?? 'external';
  if (mode === 'embedded') {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { ok: false, error: 'Embedded sign-in requires the main app window' };
    }
    return openUnisTicketIamEmbeddedLogin(mainWindow, params.loginUrl);
  }
  const url = (params.loginUrl?.trim()
    || process.env.UNIS_IAM_LOGIN_URL?.trim()
    || DEFAULT_UNIS_IAM_BROWSER_LOGIN_URL);
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to open browser',
    };
  }
}

/**
 * Opens the Unis Ticket login page in the system browser.
 */
export async function openUnisTicketIamLoginPage(loginUrl?: string): Promise<{ ok: boolean; error?: string }> {
  return openUnisTicketIamLogin(null, { loginUrl, mode: 'external' });
}

/**
 * Parses the post-login redirect URL, then exchanges the code with Unis Ticket.
 */
export async function exchangeUnisTicketIamFromRedirectUrl(
  pastedRedirectUrl: string,
  overrides: UnisIamExchangeOptions = {},
): Promise<UnisIamLoginResult> {
  const parsed = parseUnisIamRedirectUrl(pastedRedirectUrl);
  if ('error' in parsed) {
    return { ok: false, error: parsed.error };
  }

  const o = resolveExchangeOptions(overrides);
  const scope = (parsed.scope || o.scopeFallback).trim();
  if (!scope) {
    return {
      ok: false,
      error: 'Missing scope: set UNIS_IAM_SCOPE or the Skills UI scope field.',
    };
  }

  const bodyRedirectUri = overrides.redirectUri?.trim() || parsed.redirectUri;

  emitProgress({
    phase: 'exchanging',
    transport: overrides.progressTransport ?? 'paste',
  });

  try {
    const exchanged = await exchangeIamCode({
      apiBase: o.apiBase,
      code: parsed.code,
      redirectUri: bodyRedirectUri,
      scope,
      state: parsed.state,
      xApiKey: o.xApiKey,
    });
    if (!exchanged.success || (!exchanged.token && !exchanged.iamToken)) {
      return { ok: false, error: exchanged.msg ?? 'IAM token exchange failed' };
    }
    return {
      ok: true,
      token: exchanged.token,
      iamToken: exchanged.iamToken,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'IAM exchange failed',
    };
  }
}

export function cancelUnisIamLogin(): void {
  if (unisIamEmbeddedWindow && !unisIamEmbeddedWindow.isDestroyed()) {
    unisIamEmbeddedWindow.close();
  }
  unisIamEmbeddedWindow = null;
  unisIamEmbeddedCaptureDone = false;
}

/** @internal Legacy localhost OAuth default for docs */
export const LEGACY_LOCALHOST_IAM_REDIRECT_URI = 'http://127.0.0.1:1456/callback';
