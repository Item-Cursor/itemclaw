/**
 * Tickets State Store
 * Manages ticket dashboard, list, detail, and actions.
 */
import { create } from 'zustand';
import type {
  TicketDTO,
  TicketDetailDto,
  TicketTimelineItemDTO,
  TicketCountStatsDto,
  TicketSearchHit,
  DepartmentOption,
  TicketStatusReportDto,
  TicketActivityReportDto,
} from '@/types/ticket';
import * as api from '@/lib/unis-ticket-api';

type TicketScope = 'my' | 'department' | 'reports';

interface TicketsState {
  // Auth & User
  authenticated: boolean;
  authChecked: boolean;
  currentStaffId: number | null;
  currentStaffName: string | null;
  userDepartmentIds: number[];

  // Department filter
  departments: DepartmentOption[];
  selectedDepartmentId: number | null;
  scope: TicketScope;
  reportFilter: 'my' | string; // 'my' = personal stats, string = department ID (kept as string to preserve large IDs)

  // Dashboard
  stats: TicketCountStatsDto | null;
  statsLoading: boolean;

  // Report data (LTM status + activity)
  statusReport: TicketStatusReportDto[];
  activityReport: TicketActivityReportDto[];
  reportLoading: boolean;
  reportDateRange: 'today' | 'week' | 'month' | '3months' | 'thisMonth' | '6months' | 'year';
  reportGroupBy: number; // 1=Dept, 2=Team, 3=DeptStaff, 4=TeamStaff, 5=Staff
  reportType: 'status' | 'activity' | 'sla';

  // List
  tickets: TicketDTO[];
  ticketsTotal: number;
  ticketsPage: number;
  ticketsLoading: boolean;

  // Search
  searchQuery: string;
  searchResults: TicketSearchHit[];
  searching: boolean;

  // Detail
  selectedTicket: TicketDetailDto | null;
  timeline: TicketTimelineItemDTO[];
  timelineLoading: boolean;
  detailOpen: boolean;

  // Create & Reply
  creating: boolean;
  replying: boolean;
  error: string | null;

  // Actions
  checkAuth: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchReportData: () => Promise<void>;
  fetchTickets: (page?: number) => Promise<void>;
  setScope: (scope: TicketScope) => void;
  setSelectedDepartmentId: (id: number | null) => void;
  setReportFilter: (filter: 'my' | string) => void;
  setReportDateRange: (range: 'today' | 'week' | 'month' | '3months' | 'thisMonth' | '6months' | 'year') => void;
  setReportGroupBy: (groupBy: number) => void;
  setReportType: (type: 'status' | 'activity' | 'sla') => void;
  setSearchQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  openDetail: (ticketId: number) => Promise<void>;
  closeDetail: () => void;
  createTicket: (params: {
    title: string;
    content: string;
    topicId: number;
    departmentId: number;
    customerId: number;
    displayStatusId: number;
    priorityId?: number;
  }) => Promise<TicketDTO>;
  replyToTicket: (params: {
    content: string;
    isInternalNote?: boolean;
  }) => Promise<void>;
  clearError: () => void;
}

export const useTicketsStore = create<TicketsState>((set, get) => ({
  authenticated: false,
  authChecked: false,
  currentStaffId: null,
  currentStaffName: null,
  userDepartmentIds: [],
  departments: [],
  selectedDepartmentId: null,
  scope: 'my',
  reportFilter: 'my',
  stats: null,
  statsLoading: false,
  statusReport: [],
  activityReport: [],
  reportLoading: false,
  reportDateRange: 'month',
  reportGroupBy: 1,
  reportType: 'status',
  tickets: [],
  ticketsTotal: 0,
  ticketsPage: 1,
  ticketsLoading: false,
  searchQuery: '',
  searchResults: [],
  searching: false,
  selectedTicket: null,
  timeline: [],
  timelineLoading: false,
  detailOpen: false,
  creating: false,
  replying: false,
  error: null,

  checkAuth: async () => {
    try {
      const ok = await api.isAuthenticated();
      if (!ok) { set({ authenticated: false, authChecked: true }); return; }
      // Fetch current user — StaffDetailDTO includes departments directly
      const user = await api.fetchCurrentUser();
      const staffId = user?.id ?? null;
      const staffName = user?.name ?? null;
      // User's departments come from the staff detail, not a separate call
      const userDepts = (user?.departments ?? []).map((d) => ({ id: d.id, name: d.name }));
      const deptIds = userDepts.map((d) => d.id);
      set({
        authenticated: true,
        authChecked: true,
        currentStaffId: staffId,
        currentStaffName: staffName,
        userDepartmentIds: deptIds,
        departments: userDepts,
      });
    } catch {
      set({ authenticated: false, authChecked: true });
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true, error: null });
    try {
      const { userDepartmentIds, reportFilter } = get();
      let deptIds: number[] | undefined;
      if (reportFilter === 'my') {
        // Personal stats — scope to user's departments
        deptIds = userDepartmentIds.length > 0 ? userDepartmentIds : undefined;
      } else {
        // Department-wide stats — scope to the selected department only
        deptIds = [reportFilter] as unknown as number[];
      }
      const stats = await api.fetchTicketCountStats({ departmentIds: deptIds });
      set({ stats, statsLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load stats';
      if (msg === 'NOT_AUTHENTICATED') set({ authenticated: false, statsLoading: false });
      else set({ error: msg, statsLoading: false });
    }
  },

  fetchReportData: async () => {
    set({ reportLoading: true });
    try {
      const { reportFilter, currentStaffId, userDepartmentIds, reportGroupBy, reportDateRange } = get();
      let deptIds: number[] | undefined;
      let staffIds: number[] | undefined;
      let groupBy = reportGroupBy;

      if (reportFilter === 'my') {
        // Personal: group by staff, filter to current user
        groupBy = 5; // Staff
        if (currentStaffId) staffIds = [currentStaffId];
        if (userDepartmentIds.length) deptIds = userDepartmentIds;
      } else {
        // Department-wide: use selected groupBy (default dept, or dept-staff for drill-down)
        deptIds = [reportFilter] as unknown as number[];
      }

      const [statusReport, activityReport] = await Promise.all([
        api.fetchTicketStatusReport({ departmentIds: deptIds, staffIds, groupBy, dateRange: reportDateRange }),
        api.fetchTicketActivityReport({ departmentIds: deptIds, staffIds, groupBy, dateRange: reportDateRange }),
      ]);
      set({ statusReport, activityReport, reportLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load report';
      if (msg === 'NOT_AUTHENTICATED') set({ authenticated: false, reportLoading: false });
      else set({ reportLoading: false });
    }
  },

  fetchTickets: async (page = 1) => {
    const { scope } = get();
    if (scope === 'reports') return; // Reports view doesn't show ticket list
    set({ ticketsLoading: true, error: null });
    try {
      const { currentStaffId, selectedDepartmentId, userDepartmentIds } = get();
      const input: Record<string, unknown> = {
        displayStatusSystemStatus: [10], // 10=open only, exclude closed/archived/deleted
        ticketIsOverdue: false, // explicitly override — never inherit filter from web session
      };
      if (scope === 'my' && currentStaffId) {
        input.staffId = currentStaffId;
      } else if (scope === 'department') {
        input.departmentIds = selectedDepartmentId ? [selectedDepartmentId] : userDepartmentIds;
      }
      const result = await api.fetchTicketPage({ page, size: 20, input });
      set({
        tickets: page === 1 ? (result.records || []) : [...get().tickets, ...(result.records || [])],
        ticketsTotal: result.total || 0,
        ticketsPage: page,
        ticketsLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tickets';
      if (msg === 'NOT_AUTHENTICATED') set({ authenticated: false, ticketsLoading: false });
      else set({ error: msg, ticketsLoading: false });
    }
  },

  setScope: (scope) => {
    const { departments, selectedDepartmentId } = get();
    // Auto-select first department when switching to department scope
    if (scope === 'department' && !selectedDepartmentId && departments.length > 0) {
      set({ scope, selectedDepartmentId: departments[0].id, tickets: [], ticketsPage: 1 });
    } else {
      set({ scope, tickets: [], ticketsPage: 1 });
    }
    get().fetchTickets(1);
  },

  setSelectedDepartmentId: (id) => {
    set({ selectedDepartmentId: id, scope: 'department', tickets: [], ticketsPage: 1 });
    get().fetchTickets(1);
  },

  setReportFilter: (filter) => {
    set({ reportFilter: filter, reportGroupBy: filter === 'my' ? 5 : 1 });
    get().fetchStats();
    get().fetchReportData();
  },

  setReportDateRange: (range) => {
    set({ reportDateRange: range });
    get().fetchReportData();
  },

  setReportGroupBy: (groupBy) => {
    set({ reportGroupBy: groupBy });
    get().fetchReportData();
  },

  setReportType: (type) => {
    set({ reportType: type });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  search: async (query) => {
    if (!query.trim()) { set({ searchResults: [], searching: false }); return; }
    set({ searching: true });
    try {
      const result = await api.searchTickets({ keyword: query });
      set({ searchResults: result.hits || [], searching: false });
    } catch { set({ searching: false }); }
  },

  openDetail: async (ticketId) => {
    set({ detailOpen: true, selectedTicket: null, timeline: [], timelineLoading: true });
    try {
      const [detail, timelinePage] = await Promise.all([
        api.fetchTicketDetail(ticketId),
        api.fetchTicketTimeline(ticketId),
      ]);
      set({
        selectedTicket: detail,
        timeline: timelinePage.records || [],
        timelineLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load ticket', timelineLoading: false });
    }
  },

  closeDetail: () => set({ detailOpen: false, selectedTicket: null, timeline: [] }),

  createTicket: async (params) => {
    set({ creating: true, error: null });
    try {
      const ticket = await api.createTicket(params);
      set({ creating: false });
      get().fetchTickets(1);
      get().fetchStats();
      return ticket;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create ticket';
      set({ error: msg, creating: false });
      throw err;
    }
  },

  replyToTicket: async (params) => {
    const { selectedTicket } = get();
    if (!selectedTicket) throw new Error('No ticket selected');
    set({ replying: true, error: null });
    try {
      await api.replyToTicket(selectedTicket.id, {
        content: params.content,
        displayStatusId: selectedTicket.displayStatusId || 1,
        isInternalNote: params.isInternalNote,
        emailId: selectedTicket.emailId,
      });
      const timelinePage = await api.fetchTicketTimeline(selectedTicket.id);
      set({ timeline: timelinePage.records || [], replying: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reply';
      set({ error: msg, replying: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
