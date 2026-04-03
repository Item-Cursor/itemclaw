/**
 * Create Ticket Dialog (Feature 4)
 * Uses the correct TicketCreateByStaffApiRequest schema with all required fields.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useTicketsStore } from '@/stores/tickets';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as api from '@/lib/unis-ticket-api';

interface Option { id: number; name: string }

export function CreateTicketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('tickets');
  const { creating, createTicket, departments: userDepartments } = useTicketsStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topicId, setTopicId] = useState<number | undefined>();
  const [priorityId, setPriorityId] = useState<number | undefined>();
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [displayStatusId, setDisplayStatusId] = useState<number | undefined>();

  const [topics, setTopics] = useState<Option[]>([]);
  const [priorities, setPriorities] = useState<Option[]>([]);
  const [displayStatuses, setDisplayStatuses] = useState<Option[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);

  // Customer search
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<{ id: number; name: string; email?: string }[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // Load priorities and statuses once on open
  const loadBaseOptions = useCallback(async () => {
    try {
      const [priorityRes, statusRes] = await Promise.all([
        api.fetchPriorities(),
        api.fetchDisplayStatuses(),
      ]);
      setPriorities((priorityRes.records || []) as Option[]);
      const s = (statusRes.records || []) as Option[];
      setDisplayStatuses(s);
      if (s.length > 0 && !displayStatusId) setDisplayStatusId(s[0].id);
    } catch { /* selectors will be empty */ }
  }, [displayStatusId]);

  // Load topics when department changes
  useEffect(() => {
    if (!open) return;
    setTopics([]);
    setTopicId(undefined);
    setTopicSearch('');
    if (departmentId) {
      api.fetchTopics(departmentId).then(res => {
        setTopics((res.records || []).filter((t): t is Option => !!t.name) as Option[]);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, open]);

  // Debounced customer search
  useEffect(() => {
    if (!customerSearch.trim() || customerId) { setCustomerResults([]); return; }
    const timer = setTimeout(() => {
      api.searchCustomers(customerSearch.trim()).then(res => {
        setCustomerResults((res.records || []) as { id: number; name: string; email?: string }[]);
        setCustomerDropdownOpen(true);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, customerId]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadBaseOptions();
    }
  }, [open, loadBaseOptions]);

  // Reset form when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setTitle('');
    setDescription('');
    setTopicId(undefined);
    setTopicSearch('');
    setPriorityId(undefined);
    setDepartmentId(undefined);
    setDisplayStatusId(undefined);
    setCustomerId(undefined);
    setCustomerSearch('');
    setCustomerResults([]);
  }
  if (open !== prevOpen) setPrevOpen(open);

  const handleSubmit = async () => {
    if (!title.trim() || !topicId || !departmentId || !displayStatusId || !customerId || creating) return;
    try {
      await createTicket({
        title: title.trim(),
        content: description.trim() || title.trim(),
        topicId,
        departmentId,
        customerId,
        displayStatusId,
        priorityId,
      });
      toast.success(t('create.success'));
      onClose();
    } catch { /* error handled by store */ }
  };

  const selectClass = 'h-[44px] w-full text-[13px] bg-[#eeece3] dark:bg-muted border border-black/10 dark:border-white/10 rounded-xl px-3 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none';
  const canSubmit = title.trim() && topicId && departmentId && displayStatusId && customerId;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[450px] p-0 flex flex-col border-l border-black/10 dark:border-white/10 bg-[#f3f1e9] dark:bg-card shadow-[0_0_40px_rgba(0,0,0,0.2)]" side="right">
        <div className="flex-1 overflow-y-auto px-8 py-10">
          <h2 className="text-[28px] font-serif text-foreground font-normal tracking-tight mb-8" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>{t('create.title')}</h2>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">{t('create.subject')} *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('create.subjectPlaceholder')} className="h-[44px] text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 shadow-sm text-foreground placeholder:text-foreground/40" />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">{t('detail.customer')} *</label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(undefined); setCustomerDropdownOpen(true); }}
                  onFocus={() => { if (customerResults.length > 0) setCustomerDropdownOpen(true); }}
                  placeholder={customerId ? customerResults.find(c => c.id === customerId)?.name || 'Search customer...' : 'Search customer by name or email...'}
                  className={`${selectClass} pr-8`}
                />
                {customerDropdownOpen && customerResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#eeece3] dark:bg-muted border border-black/10 dark:border-white/10 rounded-xl shadow-lg">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name + (c.email ? ` (${c.email})` : '')); setCustomerDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.email && <span className="text-foreground/50 ml-2">{c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">{t('create.department')} *</label>
              <select value={departmentId ?? ''} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
                <option value="">{t('create.selectDepartment')}</option>
                {userDepartments.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">{t('create.topic')} *</label>
              {!departmentId ? (
                <p className="text-[13px] text-foreground/40 py-2">Select a department first</p>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => { setTopicSearch(e.target.value); setTopicId(undefined); setTopicDropdownOpen(true); }}
                    onFocus={() => setTopicDropdownOpen(true)}
                    placeholder={topicId ? topics.find(o => o.id === topicId)?.name || t('create.selectTopic') : t('create.selectTopic')}
                    className={`${selectClass} pr-8`}
                  />
                  {topicDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#eeece3] dark:bg-muted border border-black/10 dark:border-white/10 rounded-xl shadow-lg">
                      {topics
                        .filter(o => !topicSearch || (o.name || '').toLowerCase().includes(topicSearch.toLowerCase()))
                        .slice(0, 20)
                        .map(o => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => { setTopicId(o.id); setTopicSearch(o.name); setTopicDropdownOpen(false); }}
                            className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            {o.name}
                          </button>
                        ))}
                      {topics.filter(o => !topicSearch || (o.name || '').toLowerCase().includes(topicSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-[13px] text-foreground/50">No topics found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">Status *</label>
              <select value={displayStatusId ?? ''} onChange={(e) => setDisplayStatusId(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
                <option value="">Select status</option>
                {displayStatuses.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">{t('create.priority')}</label>
              <select value={priorityId ?? ''} onChange={(e) => setPriorityId(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
                <option value="">{t('create.selectPriority')}</option>
                {priorities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">{t('create.description')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('create.descriptionPlaceholder')} rows={5} className="w-full text-[13px] bg-[#eeece3] dark:bg-muted border border-black/10 dark:border-white/10 rounded-xl px-3 py-3 text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none leading-relaxed" />
            </div>
          </div>
          <div className="pt-8 pb-4 flex items-center justify-center gap-4 w-full max-w-[340px] mx-auto">
            <Button onClick={handleSubmit} disabled={!canSubmit || creating} className="flex-1 h-[42px] text-[13px] rounded-full font-semibold shadow-sm bg-[#0a84ff] hover:bg-[#007aff] text-white">
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('create.creating')}</> : t('create.submit')}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1 h-[42px] text-[13px] rounded-full font-semibold shadow-sm bg-transparent border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80">{t('create.cancel')}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
