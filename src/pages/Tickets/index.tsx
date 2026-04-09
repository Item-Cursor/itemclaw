/**
 * Tickets Page — Reports dashboard with AI insights.
 */
import { useEffect, useCallback } from 'react';
import {
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useTicketsStore } from '@/stores/tickets';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/stores/chat';
import { useNavigate } from 'react-router-dom';
import { TicketDetailSheet } from './TicketDetailSheet';
import { ReportsDashboard } from './ReportsDashboard';
import { UnisTicketIcon } from '@/components/skills/UnisTicketIcon';


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
    activityReport, reportLoading,
    departments,
    detailOpen, error, reportFilter,
    checkAuth, fetchStats, fetchReportData,
    setReportFilter,
    setReportDateRange, setReportGroupBy, setReportType,
    reportDateRange, reportGroupBy, reportType,
    closeDetail, clearError,
  } = useTicketsStore();

  useEffect(() => { checkAuth(); }, [checkAuth]);
  useEffect(() => {
    if (authenticated) { fetchStats(); fetchReportData(); }
  }, [authenticated, fetchStats, fetchReportData]);

  const handleRefresh = useCallback(() => { fetchStats(); fetchReportData(); }, [fetchStats, fetchReportData]);

  // Build context-aware AI prompt based on current filter
  const reportContext = reportFilter === 'my'
    ? 'my personal tickets (assigned to me)'
    : `the "${departments.find(d => String(d.id) === String(reportFilter))?.name || 'selected'}" department tickets`;

  const handleAskAI = useCallback((ticketNum?: string, title?: string) => {
    newSession();
    navigate('/');
    const prompt = ticketNum
      ? `🎫 Tell me about ticket ${ticketNum} "${title || ''}". What's the status, who's involved, and what actions should I take?`
      : `🎫 Give me a summary of ${reportContext}. What needs attention?`;
    setTimeout(() => sendMessage(prompt), 300);
  }, [navigate, newSession, sendMessage, reportContext]);

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
              {currentStaffName ? `${currentStaffName} ${t('subtitle')}` : t('subtitle')}
            </p>
          </div>
          {authenticated && (
            <div className="flex items-center gap-2 md:mt-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} className="h-8 w-8 rounded-md border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-muted-foreground hover:text-foreground">
                <RefreshCw className={cn('h-4 w-4', reportLoading && 'animate-spin')} />
              </Button>
            </div>
          )}
        </div>

        {!authenticated ? <NotConnectedState /> : (
          <>
            {/* Error */}
            {error && (
              <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2 shrink-0">
                <AlertCircle className="h-5 w-5 shrink-0" /><span className="flex-1">{error}</span>
                <button onClick={clearError} className="text-xs underline shrink-0">Dismiss</button>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto pr-2 pb-10 min-h-0 -mr-2">
              <ReportsDashboard
                  departments={departments}
                  reportFilter={reportFilter}
                  reportDateRange={reportDateRange}
                  reportGroupBy={reportGroupBy}
                  reportType={reportType}
                  reportLoading={reportLoading}
                  activityReport={activityReport}
                  stats={useTicketsStore.getState().stats}
                  setReportFilter={setReportFilter}
                  setReportDateRange={setReportDateRange}
                  setReportGroupBy={setReportGroupBy}
                  setReportType={setReportType}
                  handleAskAI={handleAskAI}
                  reportContext={reportContext}
                  onAskAICustom={(prompt: string) => { newSession(); navigate('/'); setTimeout(() => sendMessage(prompt), 300); }}
                />
            </div>
          </>
        )}
      </div>
      <TicketDetailSheet open={detailOpen} onClose={closeDetail} onAskAI={handleAskAI} />
    </div>
  );
}

export default Tickets;
