import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Cpu, Loader2, TerminalSquare } from 'lucide-react';

function createSessionId() {
  return `GATE-${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase()}`;
}

function createSeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function createWorkerUrl() {
  const workerSource = `
    const encoder = new TextEncoder();

    function toHex(buffer) {
      return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join('');
    }

    async function hashCandidate(seed, nonce, rounds) {
      let payload = encoder.encode(seed + ':' + nonce + ':0');
      let hex = '';

      for (let round = 0; round < rounds; round += 1) {
        const digest = await crypto.subtle.digest('SHA-256', payload);
        hex = toHex(digest);

        if (round + 1 < rounds) {
          payload = encoder.encode(hex + ':' + nonce + ':' + (round + 1));
        }
      }

      return hex;
    }

    self.onmessage = async (event) => {
      const { seed, targetPrefix, rounds, maxNonce, progressInterval } = event.data;
      let nonce = 0;
      let lastProgress = 0;

      while (nonce <= maxNonce) {
        const hash = await hashCandidate(seed, nonce, rounds);

        if (hash.startsWith(targetPrefix)) {
          self.postMessage({ type: 'done', nonce, hash });
          return;
        }

        nonce += 1;

        if (nonce - lastProgress >= progressInterval) {
          lastProgress = nonce;
          self.postMessage({ type: 'progress', nonce, hash });
        }
      }

      self.postMessage({ type: 'failed', nonce: maxNonce });
    };
  `;

  return URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));
}

export default function TerminalPowCaptcha({ onVerified, onUseMinecraft, isMobile = false }) {
  const config = useMemo(() => (
    isMobile
      ? {
        targetPrefix: '0000',
        rounds: 4,
        maxNonce: 1500000,
        progressInterval: 80,
        estimate: '约 4-8 秒',
      }
      : {
        targetPrefix: '0000',
        rounds: 6,
        maxNonce: 2200000,
        progressInterval: 120,
        estimate: '约 3-6 秒',
      }
  ), [isMobile]);

  const workerRef = useRef(null);
  const workerUrlRef = useRef('');
  const verifyTimerRef = useRef(null);

  const [sessionId] = useState(createSessionId);
  const [seed, setSeed] = useState(createSeed);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ nonce: 0, hash: '' });
  const [error, setError] = useState('');

  const supportsPow = (
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined'
  );

  const cleanupWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;

    if (workerUrlRef.current) {
      URL.revokeObjectURL(workerUrlRef.current);
      workerUrlRef.current = '';
    }
  }, []);

  useEffect(() => () => {
    window.clearTimeout(verifyTimerRef.current);
    cleanupWorker();
  }, [cleanupWorker]);

  const resetChallenge = useCallback(() => {
    cleanupWorker();
    window.clearTimeout(verifyTimerRef.current);
    setSeed(createSeed());
    setStatus('idle');
    setProgress({ nonce: 0, hash: '' });
    setError('');
  }, [cleanupWorker]);

  const startPow = useCallback((challengeSeed = seed) => {
    if (!supportsPow) {
      setStatus('error');
      setError('当前环境无法启动值守终端，可暂时改用 MC 合成验证。');
      return;
    }

    cleanupWorker();
    window.clearTimeout(verifyTimerRef.current);
    if (challengeSeed !== seed) {
      setSeed(challengeSeed);
    }
    setStatus('running');
    setProgress({ nonce: 0, hash: '' });
    setError('');

    const workerUrl = createWorkerUrl();
    const worker = new Worker(workerUrl);
    workerRef.current = worker;
    workerUrlRef.current = workerUrl;

    worker.onmessage = (event) => {
      const payload = event.data;

      if (payload.type === 'progress') {
        setProgress({ nonce: payload.nonce, hash: payload.hash });
        return;
      }

      if (payload.type === 'done') {
        cleanupWorker();
        setProgress({ nonce: payload.nonce, hash: payload.hash });
        setStatus('done');
        verifyTimerRef.current = window.setTimeout(() => {
          onVerified();
        }, 520);
        return;
      }

      cleanupWorker();
      setStatus('error');
      setError('值守终端未能在预期时间内完成核验，请重试或改用 MC 合成验证。');
    };

    worker.onerror = () => {
      cleanupWorker();
      setStatus('error');
      setError('值守终端暂时无法响应，可改用 MC 合成验证。');
    };

    worker.postMessage({
      seed: challengeSeed,
      targetPrefix: config.targetPrefix,
      rounds: config.rounds,
      maxNonce: config.maxNonce,
      progressInterval: config.progressInterval,
    });
  }, [cleanupWorker, config.maxNonce, config.progressInterval, config.rounds, config.targetPrefix, onVerified, seed, supportsPow]);

  const handlePrimaryAction = () => {
    if (status === 'running') {
      return;
    }

    if (status === 'done') {
      resetChallenge();
      return;
    }

    if (status === 'error') {
      startPow(createSeed());
      return;
    }

    startPow();
  };

  const statusLabel = status === 'idle'
    ? '待命'
    : status === 'running'
      ? '校验中'
      : status === 'done'
        ? '已放行'
        : '受阻';

  const progressPercent = Math.max(12, Math.min(92, Math.floor((progress.nonce / config.maxNonce) * 100)));

  return (
    <div className="mx-auto w-full max-w-[360px] font-mono">
      <div className="flex items-center justify-between border border-zinc-700 border-b-0 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2 text-xs tracking-[0.16em] text-endfield-yellow">
          <TerminalSquare className="h-3.5 w-3.5" />
          <span>边境值守终端</span>
        </div>
        <span className="text-[10px] text-zinc-500">记录 {sessionId}</span>
      </div>

      <div className="border border-zinc-700 bg-black p-4">
        <div className="grid gap-3 text-xs text-zinc-400">
          <div className="grid grid-cols-[88px,1fr] gap-2">
            <span className="text-zinc-600">当前节点</span>
            <span className="text-endfield-yellow">外环值守通道</span>
          </div>
          <div className="grid grid-cols-[88px,1fr] gap-2">
            <span className="text-zinc-600">登记编号</span>
            <span className="text-zinc-300">{sessionId}</span>
          </div>
          <div className="grid grid-cols-[88px,1fr] gap-2">
            <span className="text-zinc-600">值守回响</span>
            <span className="text-zinc-300">{config.estimate}</span>
          </div>
          <div className="grid grid-cols-[88px,1fr] gap-2">
            <span className="text-zinc-600">当前状态</span>
            <span className={status === 'done' ? 'text-[#90c50a]' : status === 'error' ? 'text-red-400' : 'text-zinc-300'}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-400">
          {status === 'running' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-endfield-yellow">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>值守终端正在核对来访记录，请稍候。</span>
              </div>
              <div className="text-zinc-300">边境识别程序已展开，值守信标正在逐段回应你的通行请求。</div>
              <div className="overflow-hidden border border-zinc-800 bg-black/70">
                <div className="h-1.5 bg-endfield-yellow/70 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="text-zinc-500">请保持当前界面，等待值守终端完成回执。</div>
            </div>
          ) : status === 'done' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#90c50a]">
                <Cpu className="h-3.5 w-3.5" />
                <span>核验完成，通路已开启。</span>
              </div>
              <div className="text-zinc-300">值守终端已确认你的来访记录，正在发回通行许可。</div>
              <div className="text-zinc-500">本次值守回执已记入边境档案。</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-zinc-300">启动值守终端后，边境识别程序会短暂核对来访记录。通过后将直接放行。</div>
              {error ? <div className="text-red-400">{error}</div> : null}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={status === 'running'}
            className="inline-flex items-center gap-2 border border-endfield-yellow px-4 py-2 text-xs font-bold tracking-[0.18em] text-endfield-yellow transition-colors hover:bg-endfield-yellow hover:text-black disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'idle' ? '开始校验' : status === 'done' ? '重置终端' : '再次校验'}
            {status === 'idle' ? <ArrowRight className="h-3.5 w-3.5" /> : null}
          </button>
          <button
            type="button"
            onClick={onUseMinecraft}
            className="border border-zinc-700 px-4 py-2 text-xs tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
          >
            改用 MC 合成
          </button>
        </div>
      </div>

      <div className="mt-1 flex justify-between px-1 text-[9px] text-zinc-600">
        <span>边境值守记录</span>
        <span>{supportsPow ? '终端在线' : '终端离线'}</span>
      </div>
    </div>
  );
}
