/**
 * Reports Dashboard
 * Personal: status cards (Wait Answer, New, Open, Pending, Hold, Following) + AI insights
 * Department: filters (dept, date range, team) + stat cards + top topics + SLA + AI insights
 */
import { useEffect, useState } from 'react';
import {
  MessageSquareText, TrendingUp, Clock, AlertTriangle,
  Users, BarChart3, Mail, Inbox, Pause, Hand, Eye,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import type { TicketCountStatsDto, DepartmentOption } from '@/types/ticket';
import * as api from '@/lib/unis-ticket-api';
import { useTicketsStore } from '@/stores/tickets';

type DateRangeKey = 'today' | 'week' | 'month' | '3months' | 'thisMonth' | 'year';

interface Props {
  departments: DepartmentOption[];
  reportFilter: 'my' | number;
  reportDateRange: string;
  reportGroupBy: number;
  reportType: string;
  reportLoading: boolean;
  activityReport: unknown[];
  stats: TicketCountStatsDto | null;
  setReportFilter: (f: 'my' | number) => void;
  setReportDateRange: (r: 'week' | 'month' | '3months' | '6months' | 'year' | 'today' | 'thisMonth') => void;
  setReportGroupBy: (g: number) => void;
  setReportType: (t: 'status' | 'activity' | 'sla') => void;
  handleAskAI: (ticketNum?: string, title?: string) => void;
  reportContext: string;
  onAskAICustom: (prompt: string) => void;
}

const DATE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'year', label: 'Last Year' },
];

function StatCard({ label, value, icon: Icon, color, loading }: { label: string; value: string | number; icon: React.ElementType; color: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-foreground/50 font-medium">{label}</span>
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {loading ? <div className="h-8 flex items-center"><LoadingSpinner size="sm" /></div>
        : <p className="text-[28px] font-semibold text-foreground tabular-nums leading-none">{value}</p>}
    </div>
  );
}

function MiniBar({ items, maxVal }: { items: { label: string; value: number }[]; maxVal: number }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[12px] text-foreground/60 w-24 truncate shrink-0">{item.label}</span>
          <div className="flex-1 h-5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }} />
          </div>
          <span className="text-[12px] text-foreground/70 tabular-nums w-8 text-right shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function AISummarySection({ isPersonal, handleAskAI, onAskAICustom, reportContext, deptName }: {
  isPersonal: boolean; handleAskAI: () => void; onAskAICustom: (p: string) => void; reportContext: string; deptName: string;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><MessageSquareText className="h-5 w-5 text-primary" /></div>
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">AI Insights</h3>
          <p className="text-[12px] text-foreground/50">{isPersonal ? 'Ask AI for deeper insights on your workload' : `Manager insights for ${deptName}`}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { label: isPersonal ? 'Summarize my workload' : 'Summarize this department', prompt: '' },
          { label: 'Overdue tickets today', prompt: `🎫 Show me all overdue tickets for ${reportContext} as of today. List them with ticket number, subject, how long overdue, and suggested next steps.` },
          { label: 'Most overdue this week', prompt: `🎫 What are the most overdue tickets for ${reportContext} this week? Rank them by how overdue they are and suggest next steps.` },
          { label: 'Trend analysis', prompt: `🎫 For ${reportContext}, what trends do you see? Are things getting better or worse? What should I focus on?` },
          { label: 'SLA performance', prompt: `🎫 Show me the SLA performance for ${reportContext} this week and suggest improvements` },
          { label: 'What needs attention?', prompt: `🎫 Which tickets in ${reportContext} need attention today? Prioritize by urgency and SLA deadline.` },
        ].map((q, i) => (
          <button key={i} onClick={() => q.prompt ? onAskAICustom(q.prompt) : handleAskAI()} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}


// ── Personal View ───────────────────────────────────────────────
// Fetches display statuses first, then counts tickets per status for the current staff.

function PersonalView({ handleAskAI, onAskAICustom }: { handleAskAI: () => void; onAskAICustom: (p: string) => void }) {
  const { currentStaffId } = useTicketsStore();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStaffId) return;
    setLoading(true);

    // Fetch display statuses to get the real IDs, then count tickets per status
    api.fetchDisplayStatuses().then(async (statusRes) => {
      const statuses = statusRes.records || [];
      const findId = (name: string) => statuses.find(s => s.name.toLowerCase() === name.toLowerCase())?.id;

      const newId = findId('new');
      const openId = findId('open');
      const pendingId = findId('pending');
      const holdId = findId('hold');

      const countByStatusId = async (id?: number) => {
        if (!id) return 0;
        return api.fetchPersonalTicketCount(currentStaffId, { displayStatusIds: [id] });
      };

      const [waitAnswer, newT, open, pending, hold, follower] = await Promise.all([
        api.fetchPersonalTicketCount(currentStaffId, { replyStatus: 1 }),
        countByStatusId(newId),
        countByStatusId(openId),
        countByStatusId(pendingId),
        countByStatusId(holdId),
        api.fetchFollowerTicketCount(currentStaffId),
      ]);

      setCounts({ waitAnswer, new: newT, open, pending, hold, follower });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentStaffId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Wait Answer" value={counts.waitAnswer ?? 0} icon={Mail} color="bg-red-500/10 text-red-500" loading={loading} />
        <StatCard label="New Tickets" value={counts.new ?? 0} icon={Inbox} color="bg-blue-500/10 text-blue-500" loading={loading} />
        <StatCard label="Open Tickets" value={counts.open ?? 0} icon={BarChart3} color="bg-green-500/10 text-green-500" loading={loading} />
        <StatCard label="Pending" value={counts.pending ?? 0} icon={Pause} color="bg-yellow-500/10 text-yellow-500" loading={loading} />
        <StatCard label="Hold" value={counts.hold ?? 0} icon={Hand} color="bg-orange-500/10 text-orange-500" loading={loading} />
        <StatCard label="Following" value={counts.follower ?? 0} icon={Eye} color="bg-purple-500/10 text-purple-500" loading={loading} />
      </div>
      <AISummarySection isPersonal handleAskAI={handleAskAI} onAskAICustom={onAskAICustom} reportContext="my personal tickets (assigned to me)" deptName="" />
    </div>
  );
}

// ── Department View ─────────────────────────────────────────────

function DepartmentView({
  departments, reportFilter, reportDateRange,
  setReportDateRange,
  handleAskAI, reportContext, onAskAICustom,
}: Pick<Props, 'departments' | 'reportFilter' | 'reportDateRange' | 'setReportDateRange' | 'handleAskAI' | 'reportContext' | 'onAskAICustom'>) {
  const [topTopics, setTopTopics] = useState<{ topicName: string; ticketCount: number }[]>([]);
  const [slaData, setSlaData] = useState<{ departmentName: string; slaAchievementRate: number }[]>([]);
  const [localStats, setLocalStats] = useState<TicketCountStatsDto | null>(null);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  const deptIds = [reportFilter as number];
  const deptName = departments.find(d => d.id === reportFilter)?.name || 'department';

  useEffect(() => {
    api.fetchTeams(deptIds).then(res => setTeams(res.records || [])).catch(() => setTeams([]));
    setSelectedTeamIds([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportFilter]);

  useEffect(() => {
    let cancelled = false;
    setDashLoading(true);
    const params = { departmentIds: deptIds, teamIds: selectedTeamIds.length ? selectedTeamIds : undefined, dateRange: reportDateRange as DateRangeKey };
    Promise.all([
      api.fetchTicketCountStatsFiltered(params).catch(() => null),
      api.fetchTopTopics(params).catch(() => []),
      api.fetchSlaAchievement(params).catch(() => []),
    ]).then(([stats, topics, sla]) => {
      if (cancelled) return;
      setLocalStats(stats);
      setTopTopics(topics);
      setSlaData(sla);
      setDashLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportFilter, reportDateRange, selectedTeamIds]);

  const topTopicMax = Math.max(...topTopics.map(t => t.ticketCount), 1);
  const avgSla = slaData.length > 0 ? Math.round(slaData.reduce((s, d) => s + d.slaAchievementRate, 0) / slaData.length) : 0;

  return (
    <div className="space-y-6">
      {/* Filters: Date Range + Team */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={reportDateRange} onChange={(e) => setReportDateRange(e.target.value as DateRangeKey)} className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 text-foreground outline-none font-medium">
          {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {teams.length > 0 && (
          <select value={selectedTeamIds[0] ?? ''} onChange={(e) => setSelectedTeamIds(e.target.value ? [Number(e.target.value)] : [])} className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 text-foreground outline-none font-medium">
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="New" value={localStats?.newTicketsCount ?? 0} icon={TrendingUp} color="bg-blue-500/10 text-blue-500" loading={dashLoading} />
        <StatCard label="Open" value={localStats?.openTicketsCount ?? 0} icon={BarChart3} color="bg-green-500/10 text-green-500" loading={dashLoading} />
        <StatCard label="Closed" value={localStats?.closedTicketsCount ?? 0} icon={Clock} color="bg-gray-500/10 text-gray-500" loading={dashLoading} />
        <StatCard label="Overdue" value={localStats?.overdueTicketsCount ?? 0} icon={AlertTriangle} color="bg-red-500/10 text-red-500" loading={dashLoading} />
        <StatCard label="High Priority" value={localStats?.highPriorityTicketsCount ?? 0} icon={AlertTriangle} color="bg-orange-500/10 text-orange-500" loading={dashLoading} />
        <StatCard label="Unassigned" value={localStats?.unassignedTicketsCount ?? 0} icon={Users} color="bg-purple-500/10 text-purple-500" loading={dashLoading} />
      </div>

      {/* Top Topics + SLA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 p-5">
          <h3 className="text-[14px] font-semibold text-foreground mb-4">Top Topics</h3>
          {dashLoading ? <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
            : topTopics.length === 0 ? <p className="text-[13px] text-foreground/40 py-4">No topic data</p>
            : <MiniBar items={topTopics.map(t => ({ label: t.topicName, value: t.ticketCount }))} maxVal={topTopicMax} />}
        </div>
        <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 p-5">
          <h3 className="text-[14px] font-semibold text-foreground mb-2">SLA Achievement</h3>
          {dashLoading ? <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
            : slaData.length === 0 ? <p className="text-[13px] text-foreground/40 py-4">No SLA data</p>
            : (<>
                <p className="text-[36px] font-semibold text-foreground tabular-nums leading-none mb-4">{avgSla}%</p>
                <div className="space-y-2">
                  {slaData.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-foreground/60 truncate">{d.departmentName}</span>
                      <span className={cn('font-medium tabular-nums', d.slaAchievementRate >= 80 ? 'text-green-600' : d.slaAchievementRate >= 50 ? 'text-yellow-600' : 'text-red-600')}>{Math.round(d.slaAchievementRate)}%</span>
                    </div>
                  ))}
                </div>
              </>)}
        </div>
      </div>

      <AISummarySection isPersonal={false} handleAskAI={handleAskAI} onAskAICustom={onAskAICustom} reportContext={reportContext} deptName={deptName} />
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────

export function ReportsDashboard(props: Props) {
  const isPersonal = props.reportFilter === 'my';
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={props.reportFilter === 'my' ? 'my' : String(props.reportFilter)}
          onChange={(e) => props.setReportFilter(e.target.value === 'my' ? 'my' : Number(e.target.value))}
          className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 text-foreground outline-none font-medium"
        >
          <option value="my">My Tickets (personal)</option>
          {props.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {isPersonal
        ? <PersonalView handleAskAI={() => props.handleAskAI()} onAskAICustom={props.onAskAICustom} />
        : <DepartmentView
            departments={props.departments}
            reportFilter={props.reportFilter}
            reportDateRange={props.reportDateRange}
            setReportDateRange={props.setReportDateRange}
            handleAskAI={() => props.handleAskAI()}
            reportContext={props.reportContext}
            onAskAICustom={props.onAskAICustom}
          />}
    </div>
  );
}
