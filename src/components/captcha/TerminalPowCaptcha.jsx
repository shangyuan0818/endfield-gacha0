import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Cpu, Loader2, TerminalSquare } from 'lucide-react';
import { createLocalPowChallenge, getPowWorkConfig } from '../../utils/powChallengeCore.js';

function createSessionId() {
  return `GATE-${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase()}`;
}

function createWorkerUrl() {
  const workerSource = `
    const encoder = new TextEncoder();

    function toHex(buffer) {
      return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join('');
    }

    async function hashStep(seed, step, previousHash, rounds) {
      let payload = encoder.encode(seed + ':' + step + ':' + previousHash);
      let hex = '';

      for (let round = 0; round < rounds; round += 1) {
        const digest = await crypto.subtle.digest('SHA-256', payload);
        hex = toHex(digest);

        if (round + 1 < rounds) {
          payload = encoder.encode(seed + ':' + step + ':' + hex + ':' + (round + 1));
        }
      }

      return hex;
    }

    self.onmessage = async (event) => {
      const { seed, rounds, totalSteps, progressInterval } = event.data;
      let step = 0;
      let hash = seed;
      let lastProgress = 0;

      while (step < totalSteps) {
        hash = await hashStep(seed, step, hash, rounds);
        step += 1;

        if (step - lastProgress >= progressInterval || step === totalSteps) {
          lastProgress = step;
          self.postMessage({ type: 'progress', step, hash });
        }
      }

      self.postMessage({ type: 'done', step: totalSteps, hash });
    };
  `;

  return URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));
}

export default function TerminalPowCaptcha({
  action = 'site_gate',
  challenge = null,
  onVerified,
  onUseMinecraft,
  isMobile = false,
  showFallbackButton = true,
}) {
  const effectiveChallenge = useMemo(() => challenge || createLocalPowChallenge({
    action,
    difficulty: isMobile ? 2 : 3,
    totalSteps: isMobile ? 7200 : 9600,
  }), [action, challenge, isMobile]);
  const config = useMemo(() => {
    const workConfig = getPowWorkConfig({
      isMobile,
      difficulty: effectiveChallenge.difficulty,
      totalSteps: effectiveChallenge.totalSteps,
    });
    return {
      ...workConfig,
      estimate: isMobile ? '约 3-6 秒' : '约 2-5 秒',
    };
  }, [effectiveChallenge.difficulty, effectiveChallenge.totalSteps, isMobile]);

  const workerRef = useRef(null);
  const workerUrlRef = useRef('');
  const verifyTimerRef = useRef(null);
  const finishTimerRef = useRef(null);

  const [sessionId] = useState(createSessionId);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ step: 0, hash: '' });
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
    window.clearTimeout(finishTimerRef.current);
    cleanupWorker();
  }, [cleanupWorker]);

  const resetChallenge = useCallback(() => {
    cleanupWorker();
    window.clearTimeout(verifyTimerRef.current);
    window.clearTimeout(finishTimerRef.current);
    setStatus('idle');
    setProgress({ step: 0, hash: '' });
    setError('');
  }, [cleanupWorker]);

  const startPow = useCallback(() => {
    if (!supportsPow) {
      setStatus('error');
      setError('当前环境无法启动值守终端，可暂时改用 MC 合成验证。');
      return;
    }

    cleanupWorker();
    window.clearTimeout(verifyTimerRef.current);
    window.clearTimeout(finishTimerRef.current);
    setStatus('running');
    setProgress({ step: 0, hash: '' });
    setError('');

    const workerUrl = createWorkerUrl();
    const worker = new Worker(workerUrl);
    workerRef.current = worker;
    workerUrlRef.current = workerUrl;

    worker.onmessage = (event) => {
      const payload = event.data;

      if (payload.type === 'progress') {
        setProgress({ step: payload.step, hash: payload.hash });
        return;
      }

      if (payload.type === 'done') {
        cleanupWorker();
        setProgress({ step: payload.step, hash: payload.hash });
        setStatus('finalizing');
        finishTimerRef.current = window.setTimeout(() => {
          setStatus('done');
          verifyTimerRef.current = window.setTimeout(() => {
            onVerified?.({
              algorithm: effectiveChallenge.algorithm,
              challengeId: effectiveChallenge.challengeId,
              difficulty: effectiveChallenge.difficulty,
              expiresAt: effectiveChallenge.expiresAt,
              hash: payload.hash,
              issuedAt: effectiveChallenge.issuedAt,
              seed: effectiveChallenge.seed,
              signature: effectiveChallenge.signature,
              step: payload.step,
              totalSteps: config.totalSteps,
              action: effectiveChallenge.action,
            });
          }, 720);
        }, 780);
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
      seed: effectiveChallenge.seed,
      rounds: config.rounds,
      totalSteps: config.totalSteps,
      progressInterval: config.progressInterval,
    });
  }, [cleanupWorker, config.progressInterval, config.rounds, config.totalSteps, effectiveChallenge, onVerified, supportsPow]);

  const handlePrimaryAction = () => {
    if (status === 'running' || status === 'finalizing') {
      return;
    }

    if (status === 'done') {
      resetChallenge();
      return;
    }

    if (status === 'error') {
      startPow();
      return;
    }

    startPow();
  };

  const statusLabel = status === 'idle'
    ? '待命'
    : status === 'running'
      ? '校验中'
      : status === 'finalizing'
        ? '写入回执'
        : status === 'done'
        ? '已放行'
        : '受阻';

  const progressPercent = status === 'done' || status === 'finalizing'
    ? 100
    : status === 'running'
      ? Math.max(10, Math.min(90, Math.floor((progress.step / config.totalSteps) * 10) * 10))
      : 0;

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
          {status === 'running' || status === 'finalizing' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-endfield-yellow">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{status === 'finalizing' ? '核验完成，正在写入通行回执。' : '值守终端正在核对来访记录，请稍候。'}</span>
              </div>
              <div className="text-zinc-300">
                {status === 'finalizing'
                  ? '值守信标已完成最后一次回响，终端会短暂停留后放行。'
                  : '边境识别程序已展开，值守信标正在逐段回应你的通行请求。'}
              </div>
              <div className="overflow-hidden border border-zinc-800 bg-black/70">
                <div className="h-1.5 bg-endfield-yellow/70 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>请保持当前界面，等待值守终端完成回执。</span>
                <span>{progressPercent}%</span>
              </div>
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
            disabled={status === 'running' || status === 'finalizing'}
            className="inline-flex items-center gap-2 border border-endfield-yellow px-4 py-2 text-xs font-bold tracking-[0.18em] text-endfield-yellow transition-colors hover:bg-endfield-yellow hover:text-black disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'idle' ? '开始校验' : status === 'done' ? '重置终端' : status === 'finalizing' ? '写入回执' : '再次校验'}
            {status === 'idle' ? <ArrowRight className="h-3.5 w-3.5" /> : null}
          </button>
          {showFallbackButton && (
            <button
              type="button"
              onClick={onUseMinecraft}
              className="border border-zinc-700 px-4 py-2 text-xs tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
            >
              改用 MC 合成
            </button>
          )}
        </div>
      </div>

      <div className="mt-1 flex justify-between px-1 text-[9px] text-zinc-600">
        <span>边境值守记录</span>
        <span>{supportsPow ? '终端在线' : '终端离线'}</span>
      </div>
    </div>
  );
}
