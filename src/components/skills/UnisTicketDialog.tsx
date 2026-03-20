/**
 * Unis Ticket skill flyout.
 * Shows an email + password sign-in form and stores the session token as apiKey.
 */
import { useState, useCallback } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';
import { loginUnisTicket } from '@/lib/unis-ticket';
import { useSkillsStore } from '@/stores/skills';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { UnisTicketIcon } from './UnisTicketIcon';
import type { Skill } from '@/types/skill';

interface Props {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
}

const UNIS_TICKET_TOKEN_ENV_KEY = 'UNIS_TICKET_TOKEN';
const IAM_CLIENT_CREDENTIAL_TOKEN_ENV_KEY = 'IAM_CLIENT_CREDENTIAL_TOKEN';

export function UnisTicketDialog({ skill, isOpen, onClose, onToggle }: Props) {
  const { t } = useTranslation('skills');
  const { fetchSkills } = useSkillsStore();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isConnected = !!skill?.config?.apiKey;

  const handleSignIn = useCallback(async () => {
    if (!skill) return;
    if (!emailOrUsername.trim() || !password) {
      setError('Email/username and password are required.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      const loginResult = await loginUnisTicket({
        emailOrUsername: emailOrUsername.trim(),
        password,
      });

      if (!loginResult.ok || (!loginResult.token && !loginResult.iamClientCredentialToken)) {
        setError(loginResult.error ?? 'Sign-in failed');
        return;
      }

      const resolvedSessionToken = loginResult.token || loginResult.iamClientCredentialToken;
      const resolvedIamToken = loginResult.iamClientCredentialToken || loginResult.token;
      if (!resolvedSessionToken || !resolvedIamToken) {
        setError('Missing Unis Ticket session token');
        return;
      }

      const result = await invokeIpc<{ success: boolean; error?: string }>(
        'skill:updateConfig',
        {
          skillKey: skill.id,
          apiKey: resolvedSessionToken,
          env: {
            [UNIS_TICKET_TOKEN_ENV_KEY]: resolvedSessionToken,
            [IAM_CLIENT_CREDENTIAL_TOKEN_ENV_KEY]: resolvedIamToken,
          },
        },
      ) as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to save token');
      }

      if (!skill.enabled) {
        onToggle(true);
      }

      await fetchSkills();
      setSuccess(true);
      setPassword('');
      toast.success(`${skill.name} connected successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setBusy(false);
    }
  }, [emailOrUsername, fetchSkills, onToggle, password, skill]);

  if (!skill) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-[450px] p-0 flex flex-col border-l border-black/10 dark:border-white/10 bg-[#f3f1e9] dark:bg-[#1a1a19] shadow-[0_0_40px_rgba(0,0,0,0.2)]"
        side="right"
      >
        <div className="flex-1 overflow-y-auto px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white dark:bg-[#2c2c2a] border border-black/5 dark:border-white/5 shrink-0 mb-4 shadow-sm">
              <UnisTicketIcon size={36} />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-3 text-center tracking-tight">
              {skill.name}
            </h2>
            <div className="flex items-center justify-center gap-2.5 mb-6 opacity-80">
              <Badge variant="secondary" className="font-mono text-[11px] font-medium px-3 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border-0 shadow-none text-foreground/70 transition-colors">
                {isConnected ? 'Connected' : 'Not connected'}
              </Badge>
            </div>

            <p className="text-[14px] text-foreground/70 font-medium leading-[1.6] text-center px-4">
              Sign in with your Unis Ticket credentials so your AI agent can access this skill and run ticket workflows.
            </p>
          </div>

          <div className="space-y-7 px-1">
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-[13px] text-destructive font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-[13px] text-green-700 dark:text-green-400 font-medium">
                  Successfully connected. Your AI agent can now query Unis Ticket.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">
                Email or Username
              </label>
              <Input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="Enter your email or username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-[44px] text-[13px] bg-[#eeece3] dark:bg-[#151514] border-black/10 dark:border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary shadow-sm transition-all text-foreground placeholder:text-foreground/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground/80">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                className="h-[44px] text-[13px] bg-[#eeece3] dark:bg-[#151514] border-black/10 dark:border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary shadow-sm transition-all text-foreground placeholder:text-foreground/40"
              />
            </div>

            <p className="text-[12px] text-foreground/50 font-medium">
              Your credentials are used to obtain a session token that is stored locally. The password is never stored.
            </p>

            {isConnected && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-[13px] font-medium text-foreground/80">Enabled</span>
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={(checked) => onToggle(checked)}
                />
              </div>
            )}
          </div>

          <div className="pt-8 pb-4 flex items-center justify-center gap-4 w-full px-2 max-w-[340px] mx-auto">
            <Button
              onClick={handleSignIn}
              className="flex-1 h-[42px] text-[13px] rounded-full font-semibold shadow-sm border border-transparent transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={busy || !emailOrUsername.trim() || !password}
            >
              {busy ? 'Signing in...' : isConnected ? 'Sign in again' : 'Sign in'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-[42px] text-[13px] rounded-full font-semibold shadow-sm bg-transparent border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-foreground/80 hover:text-foreground"
              onClick={onClose}
            >
              {t('detail.close', 'Close')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
