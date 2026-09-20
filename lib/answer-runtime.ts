const DEFAULT_DEADLINE_MS = 60_000;
const MIN_DEADLINE_MS = 1_000;
const MAX_DEADLINE_MS = 90_000;

function boundedDeadline(value?: string | number) {
  const parsed = typeof value === 'number' ? value : value?.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed)
    ? Math.min(MAX_DEADLINE_MS, Math.max(MIN_DEADLINE_MS, Math.floor(parsed)))
    : DEFAULT_DEADLINE_MS;
}

/** One deadline and one retry allowance for the entire question, across stages. */
export function createAnswerRuntime(callerSignal?: AbortSignal, deadline?: string | number) {
  const deadlineMs = boundedDeadline(deadline);
  const timeoutSignal = AbortSignal.timeout(deadlineMs);
  const combined = AbortSignal.any(callerSignal ? [callerSignal, timeoutSignal] : [timeoutSignal]);
  const controller = new AbortController();
  const forwardAbort = () => {
    const timedOut = timeoutSignal.aborted && combined.reason === timeoutSignal.reason;
    // Caller-controlled cancellation reasons can contain private data. Only
    // these fixed messages and names may reach providers, callers or diagnostics.
    controller.abort(new DOMException(
      timedOut ? 'Answer deadline exceeded.' : 'Answer cancelled.',
      timedOut ? 'TimeoutError' : 'AbortError',
    ));
  };
  if (combined.aborted) forwardAbort();
  else combined.addEventListener('abort', forwardAbort, {once: true});
  const signal = controller.signal;
  let retryUsed = false;

  function throwIfAborted() {
    if (signal.aborted) throw signal.reason;
  }

  function takeRetry() {
    throwIfAborted();
    if (retryUsed) return false;
    retryUsed = true;
    return true;
  }

  /**
   * Race the complete operation, including provider body reads, against the
   * shared deadline. Pass a function so cancelled work never starts. A provider
   * or test double that ignores AbortSignal cannot keep the answer pending;
   * late resolution/rejection is consumed and never returned to the caller.
   */
  function run<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {reject(signal.reason); return;}
      let settled = false;
      function finish(result: {value: T} | {error: unknown}) {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        if ('error' in result) reject(result.error);
        else resolve(result.value);
      }
      function onAbort() {finish({error: signal.reason});}
      signal.addEventListener('abort', onAbort, {once: true});
      try {
        Promise.resolve(operation()).then(
          value => signal.aborted ? onAbort() : finish({value}),
          error => signal.aborted ? onAbort() : finish({error}),
        );
      } catch (error) {
        if (signal.aborted) onAbort();
        else finish({error});
      }
    });
  }

  /** Body parsing must also use run(), or wrap fetch + parsing in one run(). */
  function fetchWithinDeadline(fetcher: typeof fetch, input: RequestInfo | URL, init?: RequestInit) {
    const requestSignals = [signal];
    if (input instanceof Request) requestSignals.push(input.signal);
    if (init?.signal) requestSignals.push(init.signal);
    return run(() => fetcher(input, {...init, signal: AbortSignal.any(requestSignals)}));
  }

  return {signal, deadlineMs, throwIfAborted, takeRetry, run, fetch: fetchWithinDeadline};
}

export type AnswerRuntime = ReturnType<typeof createAnswerRuntime>;
