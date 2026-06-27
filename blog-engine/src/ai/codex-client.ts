import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '../shared/logger';

const log = createLogger('codex');

const DEFAULT_TIMEOUT_MS = 180_000;

export interface CodexResult<T> {
  data: T;
  tokensUsed: number;
}

export interface CodexOptions {
  /** Codex model (e.g. gpt-5-codex). Omit to use the account default. */
  model?: string;
  /** Per-site auth isolation (managed default = the box's ~/.codex). */
  codexHome?: string;
  timeoutMs?: number;
}

/**
 * One-shot Codex generation with a JSON schema; returns the parsed structured
 * object. Auth comes from the ChatGPT subscription (`codex login`), NOT an API
 * key — so generation runs against the connected ChatGPT plan.
 */
export async function codexGenerate<T>(
  prompt: string,
  schema: object,
  opts: CodexOptions = {},
): Promise<CodexResult<T>> {
  const dir = await mkdtemp(join(tmpdir(), 'codex-'));
  const schemaPath = join(dir, 'schema.json');
  const outPath = join(dir, 'out.json');
  await writeFile(schemaPath, JSON.stringify(schema));

  try {
    const args = [
      'exec',
      prompt,
      '--output-schema',
      schemaPath,
      '-o',
      outPath,
      '--skip-git-repo-check',
      '--ephemeral',
      '--sandbox',
      'read-only',
    ];
    if (opts.model) args.push('--model', opts.model);

    const tokensUsed = await runCodex(args, opts);
    const raw = await readFile(outPath, 'utf8');
    const data = JSON.parse(raw) as T;
    return { data, tokensUsed };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Spawn `codex` with stdin CLOSED (it otherwise blocks waiting on stdin). */
function runCodex(args: string[], opts: CodexOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (opts.codexHome) env.CODEX_HOME = opts.codexHome;

    // stdin ignored (closed) — codex otherwise blocks waiting on it. stdout
    // ignored too; the structured result is written to the -o file.
    const child = spawn('codex', args, { stdio: ['ignore', 'ignore', 'pipe'], env });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('codex exec timed out'));
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        // codex prints "tokens used\n<n>" to stderr; best-effort parse.
        const m = /tokens used\s+([\d,]+)/i.exec(stderr);
        const tokensUsed = m ? Number(m[1].replace(/,/g, '')) : 0;
        log.debug({ tokensUsed }, 'codex exec done');
        resolve(tokensUsed);
      } else {
        reject(new Error(`codex exec failed (exit ${code}): ${stderr.slice(-500)}`));
      }
    });
  });
}
