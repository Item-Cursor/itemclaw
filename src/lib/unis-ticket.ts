/**
 * Unis Ticket authentication helpers.
 * Ported from the legacy itemclaw project's useWelcomeUnisTicket hook.
 */

const UNIS_TICKET_BASE_URL = 'https://unisticket.item.com/api/item-tickets';
const USER_AGENT = 'ItemClaw-TicketSkill/1.0';

export type UnisTicketCredentials = {
  emailOrUsername: string;
  password: string;
};

type LoginResponse = {
  success?: boolean;
  msg?: string;
  data?: { session?: { token?: string } };
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

export async function loginUnisTicket(
  credentials: UnisTicketCredentials,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const emailOrUsername = credentials.emailOrUsername.trim();
  const { password } = credentials;
  if (!emailOrUsername || !password) {
    return { ok: false, error: 'Email/username and password are required' };
  }
  try {
    const res = await fetch(`${UNIS_TICKET_BASE_URL}/v1/staff/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ emailOrUsername, password }),
    });
    const data = await parseJsonOrError(res);
    if (!data) {
      return {
        ok: false,
        error: `Server returned non-JSON (${res.status}). The Unis Ticket API may not be available.`,
      };
    }
    if (res.ok && data.success === true && data.data?.session?.token) {
      return { ok: true, token: data.data.session.token };
    }
    return { ok: false, error: data.msg ?? `Sign-in failed (${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed' };
  }
}

export async function validateUnisTicketSession(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${UNIS_TICKET_BASE_URL}/v1/staff/auth/validate`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'x-tickets-token': token,
      },
    });
    const data = await parseJsonOrError(res);
    if (res.ok && data?.success === true) {
      return { ok: true };
    }
    return { ok: false, error: data?.msg ?? `Session invalid (${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Validation failed' };
  }
}
