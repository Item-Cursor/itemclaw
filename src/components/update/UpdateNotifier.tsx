import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useUpdateStore } from '@/stores/update';

type Channel = 'latest' | 'alpha' | 'beta';

type ReleaseInfo = {
  version?: string;
  channel?: string;
  changelog?: string;
};

const PERIODIC_CHECK_MS = 6 * 60 * 60 * 1000; // 6 hours
const FALLBACK_CHECK_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function detectChannel(version: string): Channel {
  const lower = version.toLowerCase();
  if (lower.includes('-alpha.')) return 'alpha';
  if (lower.includes('-beta.')) return 'beta';
  return 'latest';
}

function parseVersion(input: string): { core: number[]; pre: string[] } {
  const [corePart, prePart = ''] = input.split('-');
  const core = corePart.split('.').map((segment) => Number.parseInt(segment, 10) || 0);
  const pre = prePart ? prePart.split('.') : [];
  return { core, pre };
}

function comparePreRelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai == null) return -1;
    if (bi == null) return 1;
    const aiNum = Number(ai);
    const biNum = Number(bi);
    const aiIsNum = Number.isFinite(aiNum) && `${aiNum}` === ai;
    const biIsNum = Number.isFinite(biNum) && `${biNum}` === bi;

    if (aiIsNum && biIsNum) {
      if (aiNum > biNum) return 1;
      if (aiNum < biNum) return -1;
      continue;
    }
    if (aiIsNum && !biIsNum) return -1;
    if (!aiIsNum && biIsNum) return 1;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

function isVersionNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  const maxCoreLen = Math.max(a.core.length, b.core.length);

  for (let i = 0; i < maxCoreLen; i++) {
    const ai = a.core[i] ?? 0;
    const bi = b.core[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }

  return comparePreRelease(a.pre, b.pre) > 0;
}

async function fetchFallbackReleaseInfo(channel: Channel): Promise<ReleaseInfo | null> {
  const candidates = [
    `https://oss.intelli-spectrum.com/${channel}/release-info.json`,
    'https://api.github.com/repos/ValueCell-ai/ItemClaw/releases/latest',
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as Record<string, unknown>;
      const version =
        typeof data.version === 'string'
          ? data.version
          : (typeof data.tag_name === 'string' ? data.tag_name.replace(/^v/, '') : undefined);
      const changelog =
        typeof data.changelog === 'string'
          ? data.changelog
          : (typeof data.html_url === 'string' ? data.html_url : undefined);
      return { version, changelog };
    } catch {
      // Try next fallback source.
    }
  }

  return null;
}

export function UpdateNotifier() {
  const autoCheckUpdate = useSettingsStore((state) => state.autoCheckUpdate);
  const init = useUpdateStore((state) => state.init);
  const isInitialized = useUpdateStore((state) => state.isInitialized);
  const status = useUpdateStore((state) => state.status);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const error = useUpdateStore((state) => state.error);
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const downloadUpdate = useUpdateStore((state) => state.downloadUpdate);
  const installUpdate = useUpdateStore((state) => state.installUpdate);

  const announcedVersionRef = useRef<string | null>(null);
  const downloadedNotifiedRef = useRef(false);
  const lastFallbackCheckRef = useRef(0);
  const fallbackAnnouncedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isInitialized) {
      void init();
    }
  }, [init, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !autoCheckUpdate) return;

    const runCheck = () => {
      checkForUpdates().catch(() => {});
    };

    // Run once immediately when user enables auto-check.
    runCheck();
    const intervalId = window.setInterval(runCheck, PERIODIC_CHECK_MS);
    const onlineListener = () => runCheck();
    window.addEventListener('online', onlineListener);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', onlineListener);
    };
  }, [autoCheckUpdate, checkForUpdates, isInitialized]);

  useEffect(() => {
    if (status === 'available' && updateInfo?.version) {
      if (announcedVersionRef.current === updateInfo.version) return;
      announcedVersionRef.current = updateInfo.version;
      downloadedNotifiedRef.current = false;
      toast.info(`Update ${updateInfo.version} is available`, {
        description: 'Download now or open Settings > Updates later.',
        action: {
          label: 'Download',
          onClick: () => {
            void downloadUpdate();
          },
        },
      });
      return;
    }

    if (status === 'downloaded') {
      if (downloadedNotifiedRef.current) return;
      downloadedNotifiedRef.current = true;
      toast.success('Update downloaded and ready to install', {
        action: {
          label: 'Restart Now',
          onClick: () => installUpdate(),
        },
      });
    }
  }, [downloadUpdate, installUpdate, status, updateInfo?.version]);

  useEffect(() => {
    if (status !== 'error' || !autoCheckUpdate || !currentVersion) return;
    if (error && error.includes('dev mode')) return;

    const now = Date.now();
    if (now - lastFallbackCheckRef.current < FALLBACK_CHECK_COOLDOWN_MS) return;
    lastFallbackCheckRef.current = now;

    const channel = detectChannel(currentVersion);
    fetchFallbackReleaseInfo(channel)
      .then((fallbackInfo) => {
        const nextVersion = fallbackInfo?.version;
        if (!nextVersion) return;
        if (!isVersionNewer(nextVersion, currentVersion)) return;
        if (fallbackAnnouncedVersionRef.current === nextVersion) return;
        fallbackAnnouncedVersionRef.current = nextVersion;

        toast.warning(`Version ${nextVersion} is available`, {
          description: 'Automatic update is unavailable right now. Open the release page to update manually.',
          action: {
            label: 'Open Release',
            onClick: () => {
              const target = fallbackInfo?.changelog || 'https://github.com/ValueCell-ai/ItemClaw/releases/latest';
              void window.electron.openExternal(target);
            },
          },
        });
      })
      .catch(() => {
        // Silent: this is a best-effort fallback path.
      });
  }, [autoCheckUpdate, currentVersion, error, status]);

  return null;
}
