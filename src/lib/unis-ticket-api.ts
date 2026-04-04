/**
 * Unis Ticket API client for the renderer process.
 * Wraps fetch calls to the Unis Ticket backend, attaching auth headers.
 */
import { invokeIpc } from '@/lib/api-client';
import type {
  ResponseResult,
  PageOutDto,
  TicketDTO,
  TicketDetailDto,
  TicketTimelineItemDTO,
  TicketCountStatsDto,
  TicketSearchDTO,
  CurrentStaffDetail,
  DepartmentOption,
  TicketStatusReportDto,
  TicketActivityReportDto,
} from '@/types/ticket';

const BASE_URL = 'https://unisticket.item.com/api/item-tickets';
const USER_AGENT = 'ItemClaw-Tickets/1.0';
const DEFAULT_TENANT_ID = '1';

async function getStoredToken(): Promise<string | null> {
  try {
    const config = await invokeIpc<{
      apiKey?: string;
      env?: Record<string, string>;
    }>('skill:getConfig', 'unis-ticket');
    return config?.apiKey || config?.env?.UNIS_TICKET_TOKEN || null;
  } catch {
    return null;
  }
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    'x-tickets-token': token,
    'x-tickets-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'X-Tenant-Id': DEFAULT_TENANT_ID,
  };
}

async function apiFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const token = await getStoredToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options?.method || 'GET',
    headers: buildHeaders(token),
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('NOT_AUTHENTICATED');
    // Try to extract error message from response body
    try {
      const errBody = await res.json() as ResponseResult<unknown>;
      throw new Error(errBody.msg || `API error: ${res.status}`);
    } catch (parseErr) {
      if (parseErr instanceof Error && !parseErr.message.startsWith('API error:')) throw parseErr;
      throw new Error(`API error: ${res.status}`, { cause: parseErr });
    }
  }
  const json = (await res.json()) as ResponseResult<T>;
  if (json.code !== '200' && json.code !== 200) {
    throw new Error(json.msg || 'API request failed');
  }
  return json.data as T;
}

// ── Current User (returns StaffDetailDTO with departments) ──────

export async function fetchCurrentUser(): Promise<CurrentStaffDetail> {
  return apiFetch<CurrentStaffDetail>('/v1/staff/auth/current');
}

// ── Date helpers (API uses MM/dd/yyyy HH:mm:ss in UTC) ──────────

function formatApiDate(d: Date): string {
  // Format using LOCAL time components — the backend parses as UTC
  // but adjusts using the x-tickets-timezone header (same as item-tickets-web)
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss}`;
}

function dateRange(months: number): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { startDate: formatApiDate(start), endDate: formatApiDate(end) };
}

type DateRangeKey = 'today' | 'week' | 'month' | '3months' | 'thisMonth' | '6months' | 'year';

function resolveDateRange(key: DateRangeKey): { startDate: string; endDate: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const endDate = formatApiDate(end);

  if (key === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return { startDate: formatApiDate(start), endDate };
  }
  if (key === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
    return { startDate: formatApiDate(start), endDate };
  }
  if (key === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    return { startDate: formatApiDate(start), endDate };
  }
  if (key === 'month') return dateRange(1);
  if (key === '3months') return dateRange(3);
  if (key === '6months') return dateRange(6);
  if (key === 'year') return dateRange(12);
  return dateRange(1);
}

/** Last 12 months (LTM) range for reports */
function ltmRange() { return dateRange(12); }

// ── Dashboard (with staffId support for personal stats) ─────────

export async function fetchTicketCountStats(params?: {
  departmentIds?: number[];
  staffId?: number;
}): Promise<TicketCountStatsDto> {
  const { startDate, endDate } = ltmRange();
  return apiFetch<TicketCountStatsDto>(
    '/v1/staff/dashboard/ticket/count-stats',
    {
      method: 'POST',
      body: {
        startDate,
        endDate,
        ...(params?.departmentIds?.length ? { departmentIds: params.departmentIds } : {}),
      },
    },
  );
}

/** Count stats with explicit date range + team filter */
export async function fetchTicketCountStatsFiltered(params: {
  departmentIds?: number[];
  teamIds?: number[];
  dateRange?: DateRangeKey;
}): Promise<TicketCountStatsDto> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'month');
  return apiFetch<TicketCountStatsDto>(
    '/v1/staff/dashboard/ticket/count-stats',
    {
      method: 'POST',
      body: {
        startDate,
        endDate,
        ...(params.departmentIds?.length ? { departmentIds: params.departmentIds } : {}),
        ...(params.teamIds?.length ? { teamIds: params.teamIds } : {}),
      },
    },
  );
}

// ── Ticket List ─────────────────────────────────────────────────

export async function fetchTicketPage(params: {
  page?: number;
  size?: number;
  input?: {
    staffId?: number;
    departmentIds?: number[];
    displayStatusIds?: number[];
    displayStatusSystemStatus?: number[];
    ticketIsOverdue?: boolean;
    title?: string;
  };
}): Promise<PageOutDto<TicketDTO>> {
  return apiFetch<PageOutDto<TicketDTO>>(
    '/v1/staff/tickets/page',
    {
      method: 'POST',
      body: {
        page: params.page || 1,
        size: params.size || 20,
        input: params.input || {},
        orders: [{ column: 'id', asc: false }],
      },
    },
  );
}

// ── Ticket Search ───────────────────────────────────────────────

export async function searchTickets(params: {
  keyword: string;
  page?: number;
  size?: number;
}): Promise<TicketSearchDTO> {
  return apiFetch<TicketSearchDTO>(
    '/v1/staff/tickets/search',
    {
      method: 'POST',
      body: {
        keyword: params.keyword,
        page: params.page || 1,
        size: params.size || 20,
      },
    },
  );
}

// ── Ticket Detail ───────────────────────────────────────────────

export async function fetchTicketDetail(id: number): Promise<TicketDetailDto> {
  return apiFetch<TicketDetailDto>(`/v1/staff/tickets/${id}`);
}

// ── Ticket AI Summary ───────────────────────────────────────────

export async function fetchTicketSummary(ticketId: number): Promise<{ title?: string; summary?: string; insight?: string; key_points?: string[]; logic_flow?: string }> {
  return apiFetch<{ title?: string; summary?: string; insight?: string; key_points?: string[]; logic_flow?: string }>(`/v1/staff/tickets/${ticketId}/summary`);
}

// ── Ticket Timeline ─────────────────────────────────────────────

export async function fetchTicketTimeline(
  ticketId: number,
  params?: { page?: number; size?: number },
): Promise<PageOutDto<TicketTimelineItemDTO>> {
  return apiFetch<PageOutDto<TicketTimelineItemDTO>>(
    `/v1/staff/tickets/${ticketId}/timeline`,
    {
      method: 'POST',
      body: {
        page: params?.page || 1,
        size: params?.size || 50,
        input: {},
      },
    },
  );
}

// ── Create Ticket (correct schema) ─────────────────────────────

export async function createTicket(params: {
  title: string;
  content: string;
  topicId: number;
  departmentId: number;
  customerId: number;
  displayStatusId: number;
  priorityId?: number;
  staffId?: number;
}): Promise<TicketDTO> {
  return apiFetch<TicketDTO>(
    '/v1/staff/tickets',
    {
      method: 'POST',
      body: {
        title: params.title,
        topicId: params.topicId,
        departmentId: params.departmentId,
        customerId: params.customerId,
        displayStatusId: params.displayStatusId,
        priorityId: params.priorityId,
        staffId: params.staffId,
        sourceChannel: 3, // 3 = Web (enum: 1:Phone 2:Email 3:Web 4:API 5:Other)
        message: {
          content: params.content,
          type: 1, // 1 = message
          sourceChannel: 3, // 3 = Web
          userType: 2, // 2 = staff
        },
        notificationInfo: {
          toCustomerIds: [params.customerId],
        },
      },
    },
  );
}

// ── Reply to Ticket (correct schema) ────────────────────────────

export async function replyToTicket(
  ticketId: number,
  params: {
    content: string;
    displayStatusId: number;
    isInternalNote?: boolean;
    emailId?: number;
  },
): Promise<void> {
  await apiFetch<void>(
    `/v1/staff/tickets/${ticketId}/reply`,
    {
      method: 'POST',
      body: {
        displayStatusId: params.displayStatusId,
        message: {
          content: params.content,
          type: params.isInternalNote ? 3 : 5, // 3 = internal_note, 5 = reply
          sourceChannel: 3, // 3 = Web
          userType: 2, // 2 = staff
        },
        notificationInfo: {
          ...(params.isInternalNote ? {} : { emailId: params.emailId }),
        },
      },
    },
  );
}

// ── Reference Data ──────────────────────────────────────────────

export async function fetchTopics(departmentId?: number): Promise<PageOutDto<{ id: number; name: string; departmentId?: number }>> {
  const raw = await apiFetch<PageOutDto<{ id: number; title?: string; departmentId?: number }>>(
    '/v1/staff/topics/page',
    {
      method: 'POST',
      body: {
        page: 1,
        size: 200,
        input: {
          status: 1, // enabled only
          ...(departmentId ? { nullOrEqualDepartmentId: departmentId } : {}),
        },
      },
    },
  );
  // Map title → name for consistency with Option interface
  return {
    ...raw,
    records: (raw.records || []).map(t => ({ id: t.id, name: t.title || '', departmentId: t.departmentId })),
  };
}

export async function fetchPriorities(): Promise<PageOutDto<{ id: number; name: string }>> {
  return apiFetch<PageOutDto<{ id: number; name: string }>>(
    '/v1/staff/ticket/priorities/page',
    { method: 'POST', body: { page: 1, size: 100, input: {} } },
  );
}

export async function fetchDepartments(): Promise<PageOutDto<DepartmentOption>> {
  return apiFetch<PageOutDto<DepartmentOption>>(
    '/v1/open/departments/page',
    { method: 'POST', body: { page: 1, size: 100, input: {} } },
  );
}

export async function fetchDisplayStatuses(): Promise<PageOutDto<{ id: number; name: string }>> {
  return apiFetch<PageOutDto<{ id: number; name: string }>>(
    '/v1/open/ticket/display-statuses/page',
    { method: 'POST', body: { page: 1, size: 100, input: {} } },
  );
}

// ── Teams ───────────────────────────────────────────────────────

export async function fetchTeams(departmentIds?: number[]): Promise<PageOutDto<{ id: number; name: string }>> {
  return apiFetch<PageOutDto<{ id: number; name: string }>>(
    '/v1/staff/teams/page',
    { method: 'POST', body: { page: 1, size: 200, input: { status: 1, ...(departmentIds?.length ? { departmentId: departmentIds[0] } : {}) } } },
  );
}

// ── Personal ticket counts (by querying page with size=1 for total) ──

export async function fetchPersonalTicketCount(staffId: number, extra: Record<string, unknown> = {}): Promise<number> {
  const result = await apiFetch<PageOutDto<TicketDTO>>(
    '/v1/staff/tickets/page',
    { method: 'POST', body: { page: 1, size: 1, input: { staffId, displayStatusSystemStatus: [10], ...extra } } },
  );
  return result.total ?? 0;
}

export async function fetchFollowerTicketCount(staffId: number): Promise<number> {
  const result = await apiFetch<PageOutDto<TicketDTO>>(
    '/v1/staff/tickets/page',
    { method: 'POST', body: { page: 1, size: 1, input: { followerIds: [staffId], displayStatusSystemStatus: [10] } } },
  );
  return result.total ?? 0;
}

// ── Customer Search ─────────────────────────────────────────────

export async function searchCustomers(keyword: string): Promise<PageOutDto<{ id: number; name: string; email?: string }>> {
  return apiFetch<PageOutDto<{ id: number; name: string; email?: string }>>(
    '/v1/staff/customers/page',
    { method: 'POST', body: { page: 1, size: 20, input: { keyword, status: 1 } } },
  );
}

// ── Dashboard APIs ──────────────────────────────────────────────

export async function fetchTicketTrend(params: {
  departmentIds?: number[];
  dateRange?: DateRangeKey;
}): Promise<{ date: string; count: number }[]> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'month');
  return apiFetch<{ date: string; count: number }[]>(
    '/v1/staff/dashboard/ticket/trend',
    { method: 'POST', body: { startDate, endDate, departmentIds: params.departmentIds, trendDateField: 'createTime' } },
  );
}

export async function fetchSlaAchievement(params: {
  departmentIds?: number[];
  teamIds?: number[];
  dateRange?: DateRangeKey;
}): Promise<{ departmentName: string; slaAchievementRate: number; ticketCount: number }[]> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'month');
  return apiFetch<{ departmentName: string; slaAchievementRate: number; ticketCount: number }[]>(
    '/v1/staff/dashboard/ticket/sla-achieved',
    { method: 'POST', body: { startDate, endDate, departmentIds: params.departmentIds, teamIds: params.teamIds } },
  );
}


export async function fetchTopTopics(params: {
  departmentIds?: number[];
  teamIds?: number[];
  dateRange?: DateRangeKey;
}): Promise<{ topicName: string; ticketCount: number }[]> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'month');
  return apiFetch<{ topicName: string; ticketCount: number }[]>(
    '/v1/staff/dashboard/ticket/topic-count',
    { method: 'POST', body: { startDate, endDate, departmentIds: params.departmentIds, teamIds: params.teamIds } },
  );
}

export async function fetchAvgResolutionTime(params: {
  departmentIds?: number[];
  dateRange?: DateRangeKey;
}): Promise<{ departmentName: string; averageTimeToSolveHours: number; ticketCount: number }[]> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'month');
  return apiFetch<{ departmentName: string; averageTimeToSolveHours: number; ticketCount: number }[]>(
    '/v1/staff/dashboard/ticket/average-resolution-time',
    { method: 'POST', body: { startDate, endDate, departmentIds: params.departmentIds } },
  );
}

// ── Report APIs (LTM) ──────────────────────────────────────────

/** Status report: returns status name → count per group. groupBy: 1=Dept, 3=DeptStaff, 5=Staff */
export async function fetchTicketStatusReport(params: {
  departmentIds?: number[];
  staffIds?: number[];
  groupBy?: number;
  dateRange?: DateRangeKey;
}): Promise<TicketStatusReportDto[]> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'year');
  return apiFetch<TicketStatusReportDto[]>(
    '/v1/staff/report/ticket/status',
    {
      method: 'POST',
      body: {
        startDate,
        endDate,
        groupBy: params.groupBy ?? 1,
        ...(params.departmentIds?.length ? { departmentIds: params.departmentIds } : {}),
        ...(params.staffIds?.length ? { staffIds: params.staffIds } : {}),
      },
    },
  );
}

/** Activity report: processed tickets, solved, reply counts, time spent */
export async function fetchTicketActivityReport(params: {
  departmentIds?: number[];
  staffIds?: number[];
  groupBy?: number;
  dateRange?: DateRangeKey;
}): Promise<TicketActivityReportDto[]> {
  const { startDate, endDate } = resolveDateRange(params.dateRange ?? 'year');
  return apiFetch<TicketActivityReportDto[]>(
    '/v1/staff/report/ticket/activity',
    {
      method: 'POST',
      body: {
        startDate,
        endDate,
        groupBy: params.groupBy ?? 1,
        ...(params.departmentIds?.length ? { departmentIds: params.departmentIds } : {}),
        ...(params.staffIds?.length ? { staffIds: params.staffIds } : {}),
      },
    },
  );
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getStoredToken();
  return !!token;
}
