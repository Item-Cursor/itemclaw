/**
 * Ticket Detail Sheet (Feature 3 + Feature 5)
 * Shows ticket info, timeline with correct MESSAGE/AUDIT_LOG rendering,
 * and clearly separated "Reply to Ticket" vs "Ask AI" actions.
 */
import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useTicketsStore } from '@/stores/tickets';
import { useTranslation } from 'react-i18next';
import type { TicketTimelineItemDTO } from '@/types/ticket';
import { MessageSquare, StickyNote, Bot, Send, Loader2, MessageSquareText, User } from 'lucide-react';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Message type: 1=message, 2=system, 3=internal_note, 5=reply
// User type: 1=customer, 2=staff, 3=system
function TimelineItem({ item }: { item: TicketTimelineItemDTO }) {
  // AUDIT_LOG type
  if (item.type === 'AUDIT_LOG' && item.auditLog) {
    return (
      <div className="flex justify-center py-2">
        <p className="text-[11px] text-foreground/40 font-medium text-center max-w-sm">
          {item.auditLog.description || item.auditLog.action || 'System event'}
          <span className="ml-2 opacity-60">{formatDate(item.auditLog.createTime || item.createTime)}</span>
        </p>
      </div>
    );
  }

  // MESSAGE type
  const msg = item.message;
  if (!msg) return null;

  const isSystem = msg.type === 2;
  const isNote = msg.type === 3;
  const isStaff = msg.userType === 2;
  const isCustomer = msg.userType === 1;

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <p className="text-[11px] text-foreground/40 font-medium text-center max-w-sm">
          {msg.content || 'System message'}
          <span className="ml-2 opacity-60">{formatDate(msg.createTime || item.createTime)}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3', isStaff ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-1',
        isNote ? 'bg-yellow-500/10 text-yellow-600' : isStaff ? 'bg-primary/10 text-primary' : 'bg-black/5 dark:bg-white/5 text-foreground/60',
      )}>
        {isNote ? <StickyNote className="h-3.5 w-3.5" /> : isStaff ? <Bot className="h-3.5 w-3.5" /> : isCustomer ? <User className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
      </div>
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-2.5',
        isNote ? 'bg-yellow-500/10 border border-yellow-500/20'
          : isStaff ? 'bg-primary/5 border border-primary/10'
          : 'bg-black/5 dark:bg-white/5',
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-foreground/70">{msg.userName || msg.userEmail || 'Unknown'}</span>
          {isNote && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-0 shadow-none">Note</Badge>}
          <span className="text-[10px] text-foreground/40">{formatDate(msg.createTime || item.createTime)}</span>
        </div>
        <div className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
          {msg.content || ''}
        </div>
      </div>
    </div>
  );
}

// ── Reply Input (Feature 5) — clearly labeled as replying to the ACTUAL ticket ──

function ReplyInput() {
  const { t } = useTranslation('tickets');
  const { replying, replyToTicket } = useTicketsStore();
  const [content, setContent] = useState('');
  const [isNote, setIsNote] = useState(false);

  const handleSend = async () => {
    if (!content.trim() || replying) return;
    try {
      await replyToTicket({ content: content.trim(), isInternalNote: isNote });
      setContent('');
    } catch { /* error handled by store */ }
  };

  return (
    <div className={cn(
      'border-t px-6 py-4 shrink-0',
      isNote ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-black/10 dark:border-white/10',
    )}>
      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-2">
        {isNote ? '📝 Internal note (not visible to customer)' : '📨 Reply to customer (sends actual response)'}
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={isNote ? t('detail.notePlaceholder') : t('detail.replyPlaceholder')}
        rows={2}
        className="w-full bg-transparent text-[13px] text-foreground placeholder:text-foreground/40 outline-none resize-none leading-relaxed"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
      />
      <div className="flex items-center justify-between mt-2">
        <button onClick={() => setIsNote(!isNote)} className={cn(
          'text-[12px] font-medium px-3 py-1 rounded-full transition-colors',
          isNote ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' : 'bg-black/5 dark:bg-white/5 text-foreground/60 hover:text-foreground',
        )}>
          {isNote ? t('detail.internalNote') : t('detail.reply')}
        </button>
        <Button size="sm" onClick={handleSend} disabled={!content.trim() || replying} className="h-8 px-4 rounded-full text-[12px] font-semibold gap-1.5 bg-[#0a84ff] hover:bg-[#007aff] text-white shadow-none">
          {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {t('detail.sendReply')}
        </Button>
      </div>
    </div>
  );
}

// ── Detail Sheet ────────────────────────────────────────────────

export function TicketDetailSheet({ open, onClose, onAskAI }: {
  open: boolean;
  onClose: () => void;
  onAskAI: (ticketNum?: string, title?: string) => void;
}) {
  const { t } = useTranslation('tickets');
  const { selectedTicket, timeline, timelineLoading } = useTicketsStore();
  const ticket = selectedTicket;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[560px] p-0 flex flex-col border-l border-black/10 dark:border-white/10 bg-[#f3f1e9] dark:bg-card shadow-[0_0_40px_rgba(0,0,0,0.2)]" side="right">
        {!ticket && timelineLoading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : ticket ? (
          <>
            {/* Header */}
            <div className="px-8 pt-8 pb-4 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-mono text-foreground/50">{ticket.ticketNumber}</span>
                {ticket.displayStatusName && (
                  <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 h-5 rounded-full border-0 shadow-none" style={ticket.displayStatusColor ? { backgroundColor: `${ticket.displayStatusColor}20`, color: ticket.displayStatusColor } : undefined}>
                    {ticket.displayStatusName}
                  </Badge>
                )}
                {ticket.priorityName && (
                  <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 h-5 rounded-full border-0 shadow-none" style={ticket.priorityColor ? { backgroundColor: `${ticket.priorityColor}20`, color: ticket.priorityColor } : undefined}>
                    {ticket.priorityName}
                  </Badge>
                )}
                {ticket.isOverdue && <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 h-5 rounded-full bg-red-500/10 text-red-600 border-0 shadow-none">Overdue</Badge>}
              </div>
              <h2 className="text-[22px] font-serif text-foreground font-normal tracking-tight leading-tight mb-4" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                {ticket.title || ticket.ticketNumber}
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
                {ticket.customerName && <div><span className="text-foreground/50">{t('detail.customer')}</span> <span className="text-foreground/80 font-medium ml-1">{ticket.customerName}</span></div>}
                {ticket.staffName && <div><span className="text-foreground/50">{t('detail.assignee')}</span> <span className="text-foreground/80 font-medium ml-1">{ticket.staffName}</span></div>}
                {ticket.departmentName && <div><span className="text-foreground/50">{t('detail.department')}</span> <span className="text-foreground/80 font-medium ml-1">{ticket.departmentName}</span></div>}
                {ticket.topicTitle && <div><span className="text-foreground/50">{t('detail.topic')}</span> <span className="text-foreground/80 font-medium ml-1">{ticket.topicTitle}</span></div>}
                {ticket.createTime && <div><span className="text-foreground/50">{t('detail.created')}</span> <span className="text-foreground/80 font-medium ml-1">{formatDate(ticket.createTime)}</span></div>}
                {ticket.updateTime && <div><span className="text-foreground/50">{t('detail.updated')}</span> <span className="text-foreground/80 font-medium ml-1">{formatDate(ticket.updateTime)}</span></div>}
              </div>
              {/* Ask AI button */}
              <Button variant="outline" size="sm" onClick={() => onAskAI(ticket.ticketNumber, ticket.title)} className="mt-4 h-8 text-[12px] font-medium rounded-full px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5" />
                Ask AI about this ticket
              </Button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 border-t border-black/5 dark:border-white/5">
              {timelineLoading ? <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
                : timeline.length === 0 ? <p className="text-center text-[13px] text-foreground/40 py-8">{t('detail.noTimeline')}</p>
                : timeline.map((item) => <TimelineItem key={item.id} item={item} />)
              }
            </div>

            {/* Reply Input */}
            <ReplyInput />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
