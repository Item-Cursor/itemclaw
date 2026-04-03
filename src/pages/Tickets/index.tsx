/**
 * Tickets Page — Features 1-5
 * Scoped ticket list + search + reports with AI + detail sheet + create dialog.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Search, X, AlertCircle, Ticket, RefreshCw, Plus,
  MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useTicketsStore } from '@/stores/tickets';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/stores/chat';
import { useNavigate } from 'react-router-dom';
import { TicketDetailSheet } from './TicketDetailSheet';
import { CreateTicketDialog } from './CreateTicketDialog';
import { UnisTicketIcon } from '@/components/skills/UnisTicketIcon';

function getTicketTitle(t: { subject?: string; title?: string }): string {
  return t.subject || t.title || '';
}
function getTicketDate(t: { createdAt?: string; createTime?: string }): string {
  return t.createdAt || t.createTime || '';
}
function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
function statusColor(status: number | undefined): string {
  switch (status) {
    case 1: return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 2: return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
    case 3: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    case 4: return 'bg-green-500/10 text-green-600 dark:text-green-400';
    default: return 'bg-gray-500/10 text-gray-500';
  }
}

function NotConnectedState() {
  const { t } = useTranslation('tickets');
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 mb-6"><UnisTicketIcon size={32} /></div>
      <p className="text-[15px] text-foreground/70 font-medium mb-4 max-w-sm">{t('notConnected')}</p>
      <p className="text-[13px] text-foreground/50">Skills → Unis Ticket</p>
    </div>
  );
}

export function Tickets() {
  const { t } = useTranslation('tickets');
  const navigate = useNavigate();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const newSession = useChatStore((s) => s.newSession);
  const {
    authenticated, authChecked, currentStaffName,
    statusReport, activityReport, reportLoading,
    tickets, ticketsTotal, ticketsPage, ticketsLoading,
    scope, departments, selectedDepartmentId,
    searchQuery, searchResults, searching,
    detailOpen, error, reportFilter,
    checkAuth, fetchStats, fetchReportData, fetchTickets,
    setScope, setSelectedDepartmentId, setReportFilter,
    setReportDateRange, setReportGroupBy, setReportType,
    reportDateRange, reportGroupBy, reportType,
    setSearchQuery, search,
    openDetail, closeDetail, clearError,
  } = useTicketsStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => { checkAuth(); }, [checkAuth]);
  useEffect(() => {
    if (authenticated) { fetchStats(); fetchTickets(1); fetchReportData(); }
  }, [authenticated, fetchStats, fetchTickets, fetchReportData]);

  // Debounced search
  useEffect(() => {
    if (!localSearch.trim()) { setSearchQuery(''); return; }
    const timer = setTimeout(() => { setSearchQuery(localSearch); search(localSearch); }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, search, setSearchQuery]);

  const handleRefresh = useCallback(() => { fetchStats(); fetchTickets(1); fetchReportData(); }, [fetchStats, fetchTickets, fetchReportData]);

  // Build context-aware AI prompt based on current filter
  const reportContext = reportFilter === 'my'
    ? 'my personal tickets (assigned to me)'
    : `the "${departments.find(d => d.id === reportFilter)?.name || 'selected'}" department tickets`;

  const handleAskAI = useCallback((ticketNum?: string, title?: string) => {
    newSession();
    navigate('/');
    const prompt = ticketNum
      ? `🎫 Tell me about ticket ${ticketNum} "${title || ''}". What's the status, who's involved, and what actions should I take?`
      : `🎫 Give me a summary of ${reportContext}. What needs attention?`;
    setTimeout(() => sendMessage(prompt), 300);
  }, [navigate, newSession, sendMessage, reportContext]);

  const hasMore = tickets.length < ticketsTotal;
  const showSearchResults = searchQuery.trim().length > 0;

  if (!authChecked) {
    return <div className="flex flex-col -m-6 dark:bg-background min-h-[calc(100vh-2.5rem)] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)] overflow-hidden">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full p-10 pt-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 shrink-0 gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl font-serif text-foreground mb-3 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>{t('title')}</h1>
            <p className="text-[17px] text-foreground/70 font-medium">
              {currentStaffName ? `${currentStaffName}'s ${t('subtitle')}` : t('subtitle')}
            </p>
          </div>
          {authenticated && (
            <div className="flex items-center gap-2 md:mt-2">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="h-8 text-[13px] font-medium rounded-md px-3 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t('create.title')}
              </Button>
              <Button variant="outline" size="icon" onClick={handleRefresh} className="h-8 w-8 rounded-md border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-muted-foreground hover:text-foreground">
                <RefreshCw className={cn('h-4 w-4', reportLoading && 'animate-spin')} />
              </Button>
            </div>
          )}
        </div>

        {!authenticated ? <NotConnectedState /> : (
          <>
            {/* Scope tabs + Search + Department filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0 gap-4">
              <div className="flex items-center flex-wrap gap-4 text-[14px]">
                <div className="relative group flex items-center bg-black/5 dark:bg-white/5 rounded-full px-3 py-1.5 focus-within:bg-black/10 transition-colors border border-transparent focus-within:border-black/10 dark:focus-within:border-white/10 mr-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input placeholder={t('search')} value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="ml-2 bg-transparent outline-none w-28 md:w-40 font-normal placeholder:text-foreground/50 text-[13px] text-foreground" />
                  {localSearch && <button type="button" onClick={() => setLocalSearch('')} className="text-foreground/50 hover:text-foreground shrink-0 ml-1"><X className="h-3.5 w-3.5" /></button>}
                </div>
                {!showSearchResults && (
                  <div className="flex items-center gap-6">
                    {(['my', 'department', 'reports'] as const).map((s) => (
                      <button key={s} onClick={() => setScope(s)} className={cn('font-medium transition-colors', scope === s ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        {t(`scope.${s}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {scope === 'department' && !showSearchResults && departments.length > 0 && (
                <select value={selectedDepartmentId ?? ''} onChange={(e) => setSelectedDepartmentId(e.target.value ? Number(e.target.value) : null)} className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 text-foreground outline-none">
                  <option value="">{t('scope.allMyDepts')}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2 shrink-0">
                <AlertCircle className="h-5 w-5 shrink-0" /><span className="flex-1">{error}</span>
                <button onClick={clearError} className="text-xs underline shrink-0">Dismiss</button>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto pr-2 pb-10 min-h-0 -mr-2">
              {showSearchResults ? (
                /* ── Search Results ── */
                searching ? <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
                : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground"><Ticket className="h-10 w-10 mb-4 opacity-50" /><p>{t('noTicketsSearch')}</p></div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {searchResults.map((hit) => (
                      <div key={hit.id} className="group flex flex-row items-center justify-between py-3.5 px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-black/5 dark:border-white/5 last:border-0" onClick={() => openDetail(hit.id)}>
                        <div className="flex items-start gap-4 flex-1 overflow-hidden pr-4">
                          <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl"><Ticket className="h-[18px] w-[18px] text-foreground/60" /></div>
                          <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-mono text-foreground/50">{hit.ticketNumber}</span>
                              <h3 className="text-[15px] font-semibold text-foreground truncate">{hit.highlightSubject || hit.subject || hit.title || ''}</h3>
                            </div>
                            <p className="text-[13px] text-muted-foreground line-clamp-1">{hit.highlightContent || ''}</p>
                          </div>
                        </div>
                        <span className="text-[12px] text-muted-foreground shrink-0">{timeAgo(getTicketDate(hit))}</span>
                      </div>
                    ))}
                  </div>
                )

              ) : scope === 'reports' ? (
                /* ── Reports View ── */
                <div className="space-y-6">
                  {/* Report filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={reportFilter === 'my' ? 'my' : String(reportFilter)}
                      onChange={(e) => setReportFilter(e.target.value === 'my' ? 'my' : Number(e.target.value))}
                      className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 text-foreground outline-none font-medium"
                    >
                      <option value="my">{t('scope.my')} (personal)</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select
                      value={reportDateRange}
                      onChange={(e) => setReportDateRange(e.target.value as 'week' | 'month' | '3months' | '6months' | 'year')}
                      className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 text-foreground outline-none font-medium"
                    >
                      <option value="week">Last 7 days</option>
                      <option value="month">Last 30 days</option>
                      <option value="3months">Last 3 months</option>
                      <option value="6months">Last 6 months</option>
                      <option value="year">Last 12 months</option>
                    </select>
                    <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
                      {(['status', 'activity'] as const).map(rt => (
                        <button key={rt} onClick={() => setReportType(rt)} className={cn('h-8 px-3 text-[13px] font-medium transition-colors', reportType === rt ? 'bg-foreground text-background' : 'bg-black/5 dark:bg-white/5 text-foreground/60 hover:text-foreground')}>
                          {rt === 'status' ? 'Status' : 'Activity'}
                        </button>
                      ))}
                    </div>
                    {reportFilter !== 'my' && (
                      <select
                        value={reportGroupBy}
                        onChange={(e) => setReportGroupBy(Number(e.target.value))}
                        className="h-8 text-[13px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 text-foreground outline-none font-medium"
                      >
                        <option value={1}>By Department</option>
                        <option value={3}>By Staff (in Dept)</option>
                        <option value={2}>By Team</option>
                        <option value={4}>By Staff (in Team)</option>
                      </select>
                    )}
                  </div>

                  {/* Report table */}
                  {reportLoading ? <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div> : reportType === 'status' && statusReport.length > 0 ? (
                    <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 overflow-hidden">
                      <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
                        <h3 className="text-[14px] font-semibold text-foreground">Status Breakdown</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="border-b border-black/5 dark:border-white/5">
                              <th className="text-left px-5 py-2.5 text-foreground/50 font-medium">{reportFilter === 'my' ? 'Staff' : reportGroupBy <= 2 ? 'Group' : 'Staff'}</th>
                              {statusReport[0]?.statusCounts && Object.keys(statusReport[0].statusCounts).map(status => (
                                <th key={status} className="text-right px-4 py-2.5 text-foreground/50 font-medium">{status}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {statusReport.map((row, i) => (
                              <tr key={i} className="border-b border-black/5 dark:border-white/5 last:border-0">
                                <td className="px-5 py-2.5 text-foreground font-medium">{row.staffName || row.department || row.team || '—'}</td>
                                {row.statusCounts && Object.values(row.statusCounts).map((count, j) => (
                                  <td key={j} className="text-right px-4 py-2.5 text-foreground tabular-nums">{count}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : reportType === 'activity' && activityReport.length > 0 ? (
                    <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 overflow-hidden">
                      <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
                        <h3 className="text-[14px] font-semibold text-foreground">Activity</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="border-b border-black/5 dark:border-white/5">
                              <th className="text-left px-5 py-2.5 text-foreground/50 font-medium">{reportFilter === 'my' ? 'Staff' : reportGroupBy <= 2 ? 'Group' : 'Staff'}</th>
                              <th className="text-right px-4 py-2.5 text-foreground/50 font-medium">Processed</th>
                              <th className="text-right px-4 py-2.5 text-foreground/50 font-medium">Solved</th>
                              <th className="text-right px-4 py-2.5 text-foreground/50 font-medium">Replies</th>
                              <th className="text-right px-4 py-2.5 text-foreground/50 font-medium">Notes</th>
                              <th className="text-right px-4 py-2.5 text-foreground/50 font-medium">Avg 1st Reply</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activityReport.map((row, i) => (
                              <tr key={i} className="border-b border-black/5 dark:border-white/5 last:border-0">
                                <td className="px-5 py-2.5 text-foreground font-medium">{row.staffName || row.department || '—'}</td>
                                <td className="text-right px-4 py-2.5 text-foreground tabular-nums">{row.processedTickets ?? 0}</td>
                                <td className="text-right px-4 py-2.5 text-foreground tabular-nums">{row.solvedTickets ?? 0}</td>
                                <td className="text-right px-4 py-2.5 text-foreground tabular-nums">{row.publicReply ?? 0}</td>
                                <td className="text-right px-4 py-2.5 text-foreground tabular-nums">{row.internalNote ?? 0}</td>
                                <td className="text-right px-4 py-2.5 text-foreground tabular-nums">{row.firstReplyTime != null ? `${Math.round(row.firstReplyTime / 60)}m` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><p className="text-[13px]">No report data for this selection</p></div>}

                  {/* AI Summary — this is where AI shines */}
                  <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><MessageSquareText className="h-5 w-5 text-primary" /></div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-foreground">{t('aiSummary')}</h3>
                        <p className="text-[12px] text-foreground/50">
                          {reportFilter === 'my' ? 'Ask AI for deeper insights on your workload' : `Ask AI for manager insights on ${departments.find(d => d.id === reportFilter)?.name || 'department'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleAskAI()} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        Summarize {reportFilter === 'my' ? 'my workload' : 'this department'}
                      </button>
                      <button onClick={() => { newSession(); navigate('/'); setTimeout(() => sendMessage(`🎫 What are the most overdue tickets for ${reportContext} this week? Rank them by how overdue they are and suggest next steps.`), 300); }} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        Most overdue this week
                      </button>
                      <button onClick={() => { newSession(); navigate('/'); setTimeout(() => sendMessage(`🎫 For ${reportContext}, what trends do you see? Are things getting better or worse? What should I focus on?`), 300); }} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        Trend analysis
                      </button>
                      <button onClick={() => { newSession(); navigate('/'); setTimeout(() => sendMessage(`🎫 Show me the SLA performance for ${reportContext} this week and suggest improvements`), 300); }} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        SLA performance
                      </button>
                      <button onClick={() => { newSession(); navigate('/'); setTimeout(() => sendMessage(`🎫 Which tickets in ${reportContext} need attention today? Prioritize by urgency and SLA deadline.`), 300); }} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        What needs attention?
                      </button>
                    </div>
                  </div>
                </div>

              ) : (
                /* ── Ticket List (My Tickets / Department) ── */
                ticketsLoading && tickets.length === 0 ? <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
                : tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground"><Ticket className="h-10 w-10 mb-4 opacity-50" /><p>{t('noTickets')}</p></div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="group flex flex-row items-center justify-between py-3.5 px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-black/5 dark:border-white/5 last:border-0" onClick={() => openDetail(ticket.id)}>
                        <div className="flex items-start gap-4 flex-1 overflow-hidden pr-4">
                          <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl"><Ticket className="h-[18px] w-[18px] text-foreground/60" /></div>
                          <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-mono text-foreground/50">{ticket.ticketNumber}</span>
                              <h3 className="text-[15px] font-semibold text-foreground truncate">{getTicketTitle(ticket)}</h3>
                              {ticket.isOverdue && <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 h-5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border-0 shadow-none">{t('status.overdue')}</Badge>}
                            </div>
                            <p className="text-[13px] text-muted-foreground line-clamp-1">{[ticket.customerName, ticket.departmentName, ticket.topicTitle].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {ticket.displayStatusName && <Badge variant="secondary" className={cn('text-[10px] font-medium px-2 py-0 h-5 rounded-full border-0 shadow-none', statusColor(ticket.displayStatusSystemStatus))}>{ticket.displayStatusName}</Badge>}
                          {ticket.staffName && <span className="text-[12px] text-muted-foreground max-w-[80px] truncate">{ticket.staffName}</span>}
                          <span className="text-[12px] text-muted-foreground">{timeAgo(getTicketDate(ticket))}</span>
                        </div>
                      </div>
                    ))}
                    {hasMore && (
                      <div className="flex justify-center pt-4">
                        <Button variant="outline" size="sm" onClick={() => fetchTickets(ticketsPage + 1)} disabled={ticketsLoading} className="h-8 text-[13px] font-medium rounded-full px-6 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none">
                          {ticketsLoading ? <LoadingSpinner size="sm" /> : t('loadMore')}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
      <TicketDetailSheet open={detailOpen} onClose={closeDetail} onAskAI={handleAskAI} />
      <CreateTicketDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default Tickets;
