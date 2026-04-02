/**
 * Unis Ticket authentication helpers.
 */

const UNIS_TICKET_BASE_URL = 'https://unisticket.item.com/api/item-tickets';
const USER_AGENT = 'ItemClaw-TicketSkill/1.0';
/** Unisco default tenant; override with UNIS_TICKET_TENANT_ID if needed. */
const DEFAULT_TENANT_ID = '1';

function resolveTenantId(): string {
  if (typeof process !== 'undefined' && process.env?.UNIS_TICKET_TENANT_ID?.trim()) {
    return process.env.UNIS_TICKET_TENANT_ID.trim();
  }
  return DEFAULT_TENANT_ID;
}

/** Unis Ticket web app — staff login entry (IAM is reached from this page). */
export const UNIS_IAM_BROWSER_LOGIN_URL = 'https://unisticket.item.com/agent/login';
/** IAM redirect after login (used in API exchange; taken from pasted URL unless overridden). */
export const UNIS_IAM_WEB_REDIRECT_URI = 'https://unisticket.item.com/agent/login/iam/redirect';
/** Legacy desktop callback when pasting itemclaw://… URLs. */
export const UNIS_IAM_ITEMCLAW_REDIRECT_URI = 'itemclaw://unis-iam/callback';
/** Matches IAM `scope=profile%20email%20phone%20openid` when the callback omits scope (aligned with electron `DEFAULT_UNIS_IAM_SCOPE`). */
export const DEFAULT_UNIS_IAM_SCOPE = 'profile email phone openid';

export type UnisTicketCredentials = {
  emailOrUsername: string;
  password: string;
};

type LoginResponse = {
  success?: boolean;
  /** Ticket API uses string "200" on success. */
  code?: string | number;
  msg?: string;
  token?: string;
  iamClientCredentialToken?: string;
  data?: {
    token?: string;
    accessToken?: string;
    access_token?: string;
    iamToken?: string;
    iam_token?: string;
    iamClientCredentialToken?: string;
    iam_client_credential_token?: string;
    session?: {
      token?: string;
      accessToken?: string;
      access_token?: string;
      iamToken?: string;
      iam_token?: string;
      iamClientCredentialToken?: string;
      iam_client_credential_token?: string;
    };
  };
};

async function parseJsonOrError(res: Response): Promise<LoginResponse | null> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null;
  const text = await res.text();
  try {
    return JSON.parse(text) as LoginResponse;
  } catch {
    return null;
  }
}

function loginResponseIndicatesError(data: LoginResponse): boolean {
  if (data.success === false) return true;
  const c = data.code;
  if (c === undefined || c === null) return false;
  return c !== '200' && c !== 200;
}

export async function loginUnisTicket(
  credentials: UnisTicketCredentials,
): Promise<{
  ok: boolean;
  token?: string;
  iamClientCredentialToken?: string;
  error?: string;
}> {
  const emailOrUsername = credentials.emailOrUsername.trim();
  const { password } = credentials;
  if (!emailOrUsername || !password) {
    return { ok: false, error: 'Email/username and password are required' };
  }
  const tenantId = resolveTenantId();
  try {
    const res = await fetch(`${UNIS_TICKET_BASE_URL}/v1/staff/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ emailOrUsername, password, tenantId }),
    });
    const data = await parseJsonOrError(res);
    if (!data) {
      return {
        ok: false,
        error: `Server returned non-JSON (${res.status}). The Unis Ticket API may not be available.`,
      };
    }
    // Ticket session token (x-tickets-token) — distinct from IAM bearer where both are returned.
    const ticketsToken = data.data?.session?.token
      || data.data?.session?.accessToken
      || data.data?.session?.access_token
      || data.data?.token
      || data.data?.accessToken
      || data.data?.access_token
      || data.token;

    const iamCredential = data.data?.session?.iamToken
      || data.data?.session?.iam_token
      || data.data?.session?.iamClientCredentialToken
      || data.data?.session?.iam_client_credential_token
      || data.data?.iamToken
      || data.data?.iam_token
      || data.data?.iamClientCredentialToken
      || data.data?.iam_client_credential_token
      || data.iamClientCredentialToken;

    const resolvedTicket = ticketsToken?.trim() || undefined;
    const resolvedIam = iamCredential?.trim() || undefined;
    const legacySingle = resolvedTicket || resolvedIam;

    if (!res.ok) {
      return { ok: false, error: data.msg ?? `Sign-in failed (${res.status})` };
    }
    if (loginResponseIndicatesError(data)) {
      return { ok: false, error: data.msg ?? 'Sign-in failed' };
    }
    if (!legacySingle) {
      return { ok: false, error: data.msg ?? 'Sign-in succeeded but no token was returned' };
    }

    return {
      ok: true,
      token: resolvedTicket || resolvedIam,
      iamClientCredentialToken: resolvedIam || resolvedTicket,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed' };
  }
}

export async function validateUnisTicketSession(
  ticketToken: string,
  options?: { iamBearerToken?: string },
): Promise<{ ok: boolean; error?: string }> {
  const ticket = ticketToken.trim();
  if (!ticket) {
    return { ok: false, error: 'No ticket session token to validate' };
  }
  const tenantId = resolveTenantId();
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      'x-tickets-token': ticket,
      'x-tickets-timezone': 'America/Los_Angeles',
      'X-Tenant-Id': tenantId,
    };
    const iam = options?.iamBearerToken?.trim();
    if (iam) {
      headers.Authorization = `Bearer ${iam}`;
    }
    const res = await fetch(`${UNIS_TICKET_BASE_URL}/v1/staff/auth/validate`, {
      method: 'GET',
      headers,
    });
    const data = await parseJsonOrError(res);
    const codeOk = data?.code === '200' || data?.code === 200;
    if (res.ok && (data?.success === true || codeOk)) {
      return { ok: true };
    }
    return { ok: false, error: data?.msg ?? `Session invalid (${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Validation failed' };
  }
}
