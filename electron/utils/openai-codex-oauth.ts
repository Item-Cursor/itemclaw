import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getItemClawConfigDir, prepareWinSpawn } from './paths';

export type OpenAICodexOAuthCredentials = {
  access: string;
  refresh: string;
  expires: number;
  email?: string;
};

export type OpenAICodexOAuthContext = {
  openUrl: (url: string) => Promise<void>;
  log: (msg: string) => void;
  note: (message: string, title?: string) => Promise<void>;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
  onCode?: (payload: { verificationUri: string; userCode: string; expiresIn: number }) => void;
};

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function normalizeEpoch(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber < 1e12 ? asNumber * 1000 : asNumber;
    }
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
  }
  return undefined;
}

export async function loginOpenAICodexOAuth(
  ctx: OpenAICodexOAuthContext,
): Promise<OpenAICodexOAuthCredentials> {
  const codexHome = join(getItemClawConfigDir(), 'codex');
  await mkdir(codexHome, { recursive: true });

  await ctx.note(
    [
      'Sign in with your ChatGPT account in the browser.',
      'Enter the one-time code when prompted.',
      'ItemClaw will complete setup after authorization succeeds.',
    ].join('\n'),
    'OpenAI OAuth',
  );

  const args = [
    '-y',
    '@openai/codex',
    '-c',
    "cli_auth_credentials_store='file'",
    'login',
    '--device-auth',
  ];
  const cmd = prepareWinSpawn('npx', args);

  const child = spawn(cmd.command, cmd.args, {
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
    },
    shell: cmd.shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  let buffered = '';
  let verificationUri: string | undefined;
  let userCode: string | undefined;
  let emittedCode = false;

  const tryEmitCode = () => {
    if (!emittedCode && verificationUri && userCode) {
      emittedCode = true;
      ctx.onCode?.({
        verificationUri,
        userCode,
        expiresIn: 900,
      });
      // Best-effort browser open when URL appears.
      void ctx.openUrl(verificationUri).catch(() => {});
    }
  };

  const parseLine = (rawLine: string) => {
    const line = stripAnsi(rawLine);
    const urlMatch = line.match(/https:\/\/auth\.openai\.com\/\S+/i);
    if (urlMatch?.[0]) verificationUri = urlMatch[0];
    const codeMatch = line.match(/\b([A-Z0-9]{4,}-[A-Z0-9]{4,})\b/);
    if (codeMatch?.[1]) userCode = codeMatch[1];
    tryEmitCode();
    ctx.log(`[OpenAI OAuth] ${line}`);
  };

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    buffered += text;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? '';
    for (const line of lines) parseLine(line);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    ctx.log(`[OpenAI OAuth] ${stripAnsi(text)}`);
  });

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (buffered.trim()) parseLine(buffered);
      if (code !== 0) {
        reject(new Error(stripAnsi(stderr || stdout).trim() || `Codex login failed (exit ${code})`));
        return;
      }
      resolve();
    });
  });

  const authPath = join(codexHome, 'auth.json');
  const raw = await readFile(authPath, 'utf-8');
  const parsed = JSON.parse(raw) as {
    auth_mode?: string;
    account?: { email?: string };
    email?: string;
    tokens?: {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number | string;
      id_token_expires_at?: number | string;
    };
  };

  if (parsed.auth_mode !== 'chatgpt') {
    throw new Error('Codex login did not return ChatGPT credentials');
  }
  const access = parsed.tokens?.access_token;
  const refresh = parsed.tokens?.refresh_token;
  if (!access || !refresh) {
    throw new Error('Codex auth.json is missing access or refresh token');
  }
  const expiresRaw = parsed.tokens?.expires_at ?? parsed.tokens?.id_token_expires_at;
  const expires = normalizeEpoch(expiresRaw) ?? (Date.now() + 50 * 60 * 1000);

  return {
    access,
    refresh,
    expires,
    email: parsed.account?.email || parsed.email,
  };
}
