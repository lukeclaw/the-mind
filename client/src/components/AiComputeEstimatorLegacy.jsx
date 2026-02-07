import { useEffect, useMemo, useState } from 'react';

const PCIE_LANE_GBPS = {
    3: 0.985,
    4: 1.969,
    5: 3.938,
    6: 7.877
};

const MODEL_PRESETS = [
    { name: '3B (Small)', paramsB: 3 },
    { name: '7B (Starter)', paramsB: 7 },
    { name: '8B (General)', paramsB: 8 },
    { name: '14B (Prosumer)', paramsB: 14 },
    { name: '32B (Large)', paramsB: 32 },
    { name: '70B (Frontier Local)', paramsB: 70 },
    { name: '123B (Extreme)', paramsB: 123 }
];

const GPU_PRESETS = {
    custom: null,
    'RTX 3060 12GB': { gpuCount: 1, vramPerGpuGb: 12, gpuMemoryBandwidth: 360, gpuFp16Tflops: 13, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'RTX 4090 24GB': { gpuCount: 1, vramPerGpuGb: 24, gpuMemoryBandwidth: 1008, gpuFp16Tflops: 82, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'RTX 5090 32GB': { gpuCount: 1, vramPerGpuGb: 32, gpuMemoryBandwidth: 1790, gpuFp16Tflops: 105, pcieGen: 5, pcieLanes: 16, nvlinkBandwidth: 0 },
    '2x RTX 4090': { gpuCount: 2, vramPerGpuGb: 24, gpuMemoryBandwidth: 1008, gpuFp16Tflops: 82, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'A100 80GB PCIe': { gpuCount: 1, vramPerGpuGb: 80, gpuMemoryBandwidth: 2039, gpuFp16Tflops: 156, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'H100 80GB SXM': { gpuCount: 1, vramPerGpuGb: 80, gpuMemoryBandwidth: 3350, gpuFp16Tflops: 197, pcieGen: 5, pcieLanes: 16, nvlinkBandwidth: 900 }
};

const DEFAULT_INPUTS = {
    gpuProfile: 'RTX 4090 24GB',
    gpuCount: 1,
    vramPerGpuGb: 24,
    gpuMemoryBandwidth: 1008,
    gpuFp16Tflops: 82,
    cpuCores: 16,
    cpuMemoryBandwidth: 90,
    systemRamGb: 64,
    pcieGen: 4,
    pcieLanes: 16,
    nvlinkBandwidth: 0,
    storageReadGbps: 6,
    contextLength: 8192,
    concurrentUsers: 1,
    quantBits: 4,
    kvCacheBytes: 2,
    efficiencyTarget: 0.62
};

const STREAM_SAMPLE = (
    'Sure - based on your hardware profile, here is a practical local hosting plan. ' +
    'Start with a 7B or 8B model in 4-bit quantization to keep memory pressure low. ' +
    'For higher quality, move to a 14B model if your VRAM envelope remains in-range. ' +
    'If you exceed VRAM, partial offload will still work but decode speed drops due to PCIe transfers. ' +
    'Your strongest gains come from more VRAM per GPU, higher memory bandwidth, and better interconnect. ' +
    'For multi-user workloads, prioritize CPU cores, RAM capacity, and runtime batching efficiency.'
).split(' ');

const TOOLTIPS = {
    gpuProfile: 'Preset bundles for common GPUs. Choose custom to manually tune each hardware field.',
    gpuCount: 'Number of GPUs used for inference. More GPUs can increase memory and throughput, but interconnect quality matters.',
    vramPerGpuGb: 'Memory available on each GPU. This is the primary limit for loading larger models without offload.',
    gpuMemoryBandwidth: 'How fast each GPU can move data between VRAM and compute cores. Often the key decode bottleneck.',
    gpuFp16Tflops: 'Approximate FP16 compute throughput per GPU. Prefill speed is more compute-sensitive than decode speed.',
    pcieGen: 'PCIe generation between CPU and GPU. Newer generations provide higher transfer bandwidth per lane.',
    pcieLanes: 'Lane width assigned to each GPU slot (x4/x8/x16). Fewer lanes reduce host-to-device bandwidth.',
    nvlinkBandwidth: 'Direct GPU-to-GPU bandwidth. Important for multi-GPU tensor parallelism and cross-GPU synchronization.',
    pcieThroughput: 'Estimated one-way host-device transfer bandwidth from PCIe generation and lane count.',
    cpuCores: 'CPU threads handle tokenization, request orchestration, scheduling, and some backend overhead.',
    cpuMemoryBandwidth: 'How quickly CPU can move data from system RAM; matters when offloading model layers from VRAM.',
    systemRamGb: 'RAM used when model/layers/kv cache do not fit entirely in VRAM. Offload-heavy setups need more RAM.',
    nvmeRead: 'Storage read speed mostly affects model load/warmup/swap times, not steady-state decode throughput.',
    contextLength: 'Maximum prompt history window in tokens. Larger context significantly increases KV cache memory usage.',
    concurrentUsers: 'Estimated simultaneous requests/users. Concurrency increases memory pressure and scheduler overhead.',
    quantBits: 'Bits used per model weight. Lower bits reduce memory and usually improve throughput, with some quality tradeoff.',
    kvCacheBytes: 'Bytes per KV-cache element. Lower precision KV cache reduces memory usage at possible quality cost.',
    utilization: 'Real-world efficiency factor covering kernel efficiency, backend overhead, batching quality, and fragmentation.',
    status: 'Run feasibility based on VRAM/RAM fit: in-VRAM is best, offload is slower, insufficient means memory shortfall.',
    memoryNeed: 'Estimated total runtime memory (weights + runtime buffers + KV cache).',
    decode: 'Token generation speed after prompt processing (output streaming rate).',
    prefill: 'Prompt ingestion speed before decoding starts.',
    bottleneck: 'Primary limiting subsystem for performance at this configuration.'
    ,
    throughputGauge: 'Live single-scenario performance view derived from your current hardware + inference settings.',
    decodeGauge: 'Decode tokens/sec: generation speed after the prompt is processed.',
    prefillGauge: 'Prefill tokens/sec: prompt ingestion speed before generation starts.',
    ttftApprox: 'Approximate Time-To-First-Token in milliseconds. Estimated from prompt length and prefill speed plus fixed serving overhead.'
    ,
    advancedToggle: 'Show advanced tuning knobs (NVLink, CPU memory bandwidth, utilization). When hidden, the estimator auto-derives reasonable defaults.'
};

const STATUS_TOOLTIPS = {
    'Runs in VRAM': 'Model + KV cache fit inside GPU memory budget. This is the best latency/throughput mode.',
    'Runs with Offload': 'Part of the model/cache spills to system RAM over PCIe. Works, but decode speed drops.',
    'Insufficient Memory': 'Combined VRAM + practical RAM budget is not enough for this model/context/user load.'
};

const BOTTLENECK_TOOLTIPS = {
    'VRAM capacity': 'GPU memory is the main limit; model or KV cache spill causes performance and feasibility issues.',
    'PCIe bandwidth': 'Host-device transfer is too slow for current offload volume; higher PCIe bandwidth helps.',
    'CPU core count': 'CPU-side work is limiting throughput under current concurrency.',
    'GPU memory bandwidth': 'VRAM throughput is limiting decode speed for this model size.',
    'Multi-GPU interconnect': 'GPU-to-GPU link bandwidth is too low, reducing parallel scaling efficiency.',
    'Tokenizer / sampling overhead': 'Model core path is healthy; residual overhead is mostly request pipeline/sampling.'
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function deriveAutoCpuMemoryBandwidth(cpuCores) {
    return clamp(cpuCores * 5.5, 30, 220);
}

function deriveAutoEfficiencyTarget(inputs) {
    let estimate = 0.66;
    if (inputs.gpuCount > 1) estimate -= 0.06;
    if (inputs.concurrentUsers > 4) estimate -= 0.04;
    if (inputs.quantBits <= 4) estimate += 0.02;
    return clamp(estimate, 0.45, 0.8);
}

function buildEffectiveInputs(rawInputs, showAdvancedInputs) {
    if (showAdvancedInputs) return rawInputs;

    return {
        ...rawInputs,
        nvlinkBandwidth: 0,
        cpuMemoryBandwidth: deriveAutoCpuMemoryBandwidth(rawInputs.cpuCores),
        efficiencyTarget: deriveAutoEfficiencyTarget(rawInputs)
    };
}

function formatNumber(value, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function estimateModelResult(model, hw) {
    const totalVramGb = hw.gpuCount * hw.vramPerGpuGb;
    const vramBudgetGb = totalVramGb * 0.9;
    const ramBudgetGb = hw.systemRamGb * 0.82;

    const weightBytesPerParam = hw.quantBits / 8;
    const weightsGb = model.paramsB * weightBytesPerParam * 1.05;

    const runtimeBufferGb = Math.max(1.4, weightsGb * 0.09);

    // Practical KV cache estimate for decoder-only models at fp16 baseline:
    // ~0.072 MB/token per 1B params. Scaled by kv-cache dtype bytes.
    const kvCacheGb = (model.paramsB * 0.072 * hw.contextLength * hw.concurrentUsers * (hw.kvCacheBytes / 2)) / 1024;

    const requiredMemoryGb = weightsGb + runtimeBufferGb + kvCacheGb;
    const offloadGb = Math.max(0, requiredMemoryGb - vramBudgetGb);

    const canRunInVram = requiredMemoryGb <= vramBudgetGb;
    const canRunWithOffload = offloadGb <= ramBudgetGb;
    const offloadRatio = requiredMemoryGb > 0 ? offloadGb / requiredMemoryGb : 0;

    const pcieGbps = (PCIE_LANE_GBPS[hw.pcieGen] || 0) * hw.pcieLanes;
    const interconnectGbps = hw.gpuCount > 1
        ? Math.max(12, hw.nvlinkBandwidth > 0 ? hw.nvlinkBandwidth : pcieGbps)
        : 9999;

    const cpuFeedGbps = Math.min(hw.cpuMemoryBandwidth * 0.85, pcieGbps);

    const multiGpuScale = hw.gpuCount === 1 ? 1 : 1 + (hw.gpuCount - 1) * 0.82;
    const gpuRawBw = hw.gpuMemoryBandwidth * multiGpuScale;
    const interconnectPenalty = hw.gpuCount > 1 ? clamp(interconnectGbps / 250, 0.55, 1) : 1;

    const gpuEffectiveBw = gpuRawBw * hw.efficiencyTarget * interconnectPenalty;

    const memoryPathBw = offloadRatio > 0
        ? 1 / (((1 - offloadRatio) / gpuEffectiveBw) + (offloadRatio / Math.max(1, cpuFeedGbps)))
        : gpuEffectiveBw;

    const concurrencyGain = 1 + Math.log2(hw.concurrentUsers + 1) * 0.15;
    const decodeTokensPerSec = (memoryPathBw / Math.max(1.2, weightsGb * 0.95)) * concurrencyGain;

    const totalFp16Tflops = hw.gpuFp16Tflops * multiGpuScale * interconnectPenalty;
    const computeCeilingTokSec = (totalFp16Tflops * 1e12) / (2 * model.paramsB * 1e9);
    const prefillTokensPerSec = Math.min(computeCeilingTokSec * 0.34, decodeTokensPerSec * 5.5);

    let status = 'Runs in VRAM';
    if (!canRunInVram && canRunWithOffload) status = 'Runs with Offload';
    if (!canRunWithOffload) status = 'Insufficient Memory';

    const bottlenecks = [];
    if (offloadRatio > 0.15) bottlenecks.push('VRAM capacity');
    if (offloadRatio > 0.1 && pcieGbps < 40) bottlenecks.push('PCIe bandwidth');
    if (hw.concurrentUsers > 2 && hw.cpuCores < 12) bottlenecks.push('CPU core count');
    if (hw.gpuMemoryBandwidth < 600 && model.paramsB >= 14) bottlenecks.push('GPU memory bandwidth');
    if (hw.gpuCount > 1 && interconnectGbps < 120) bottlenecks.push('Multi-GPU interconnect');
    if (bottlenecks.length === 0) bottlenecks.push('Tokenizer / sampling overhead');

    return {
        model: model.name,
        paramsB: model.paramsB,
        status,
        decodeTokensPerSec,
        prefillTokensPerSec,
        requiredMemoryGb,
        weightsGb,
        runtimeBufferGb,
        kvCacheGb,
        vramBudgetGb,
        offloadGb,
        bottlenecks
    };
}

function RecommendationList({ recommendations }) {
    return (
        <ul className="estimator-recommendations">
            {recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
            ))}
        </ul>
    );
}

function StreamingPreview({ decodeTokensPerSec, modelLabel }) {
    const [wordIndex, setWordIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const wordsPerSecond = Math.max(1, decodeTokensPerSec * 0.75);

    useEffect(() => {
        if (!isPlaying) return undefined;

        const tickMs = 120;
        const wordsPerTick = Math.max(1, Math.round(wordsPerSecond * (tickMs / 1000)));

        const interval = setInterval(() => {
            setWordIndex((prev) => {
                const next = prev + wordsPerTick;
                if (next >= STREAM_SAMPLE.length) return STREAM_SAMPLE.length;
                return next;
            });
        }, tickMs);

        return () => clearInterval(interval);
    }, [isPlaying, wordsPerSecond, modelLabel]);

    const displayed = STREAM_SAMPLE.slice(0, wordIndex).join(' ');
    const done = wordIndex >= STREAM_SAMPLE.length;

    return (
        <div className="estimator-stream">
            <div className="estimator-stream-header">
                <strong>Streaming Mock</strong>
                <span className="text-muted">~{formatNumber(wordsPerSecond, 1)} words/s from current estimate</span>
            </div>
            <div className="estimator-stream-output">
                {displayed || '...'}
                {!done && <span className="estimator-stream-caret">|</span>}
            </div>
            <div className="estimator-stream-controls">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setIsPlaying((prev) => !prev)}>
                    {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                        setWordIndex(0);
                        setIsPlaying(true);
                    }}
                >
                    Restart
                </button>
            </div>
        </div>
    );
}

function ExampleVisualization({ modelResults, selectedModel, onSelectModel, inputs }) {
    const active = modelResults.find((result) => result.model === selectedModel) || modelResults[0];
    if (!active) return null;

    const vramUsePct = Math.min(100, (active.requiredMemoryGb / Math.max(1, active.vramBudgetGb)) * 100);
    const decodeScalePct = Math.min(100, (active.decodeTokensPerSec / 250) * 100);
    const prefillScalePct = Math.min(100, (active.prefillTokensPerSec / 4000) * 100);
    const estTokens5s = active.decodeTokensPerSec * 5;
    const estTokens15s = active.decodeTokensPerSec * 15;
    const prefillSeconds = inputs.contextLength / Math.max(1, active.prefillTokensPerSec);
    const ttftApproxMs = prefillSeconds * 1000 + 120;

    const weightsPct = (active.weightsGb / Math.max(1, active.requiredMemoryGb)) * 100;
    const runtimePct = (active.runtimeBufferGb / Math.max(1, active.requiredMemoryGb)) * 100;
    const kvPct = (active.kvCacheGb / Math.max(1, active.requiredMemoryGb)) * 100;

    return (
        <div className="estimator-visual-grid">
            <div className="estimator-visual-card">
                <h4>Realtime Scenario Output</h4>
                <p className="text-muted">Updates instantly as you modify hardware and inference settings.</p>

                <div className="input-group mt-sm">
                    <label className="input-label">Target Model (for visualization)</label>
                    <select className="input" value={active.model} onChange={(e) => onSelectModel(e.target.value)}>
                        {modelResults.map((result) => (
                            <option key={`viz-${result.model}`} value={result.model}>{result.model}</option>
                        ))}
                    </select>
                </div>

                <div className="estimator-live-kpis">
                    <div className="estimator-live-kpi">
                        <span className="text-muted">Status</span>
                        <strong>{active.status}</strong>
                    </div>
                    <div className="estimator-live-kpi">
                        <span className="text-muted">Main Bottleneck</span>
                        <strong>{active.bottlenecks[0]}</strong>
                    </div>
                </div>
            </div>

            <div className="estimator-visual-card">
                <h4><TooltipLabel label="Realtime Throughput Gauge" tip={TOOLTIPS.throughputGauge} /></h4>
                <p className="text-muted">Single-scenario throughput approximation from current inputs.</p>
                <div className="estimator-bars">
                    <div className="estimator-bar-row">
                        <span className="estimator-bar-label"><TooltipLabel label="Decode" tip={TOOLTIPS.decodeGauge} /></span>
                        <div className="estimator-bar-track">
                            <div className="estimator-bar-fill estimator-bar-fill-cyan" style={{ width: `${decodeScalePct}%` }} />
                        </div>
                        <span className="estimator-bar-value">{formatNumber(active.decodeTokensPerSec, 1)} tok/s</span>
                    </div>
                    <div className="estimator-bar-row">
                        <span className="estimator-bar-label"><TooltipLabel label="Prefill" tip={TOOLTIPS.prefillGauge} /></span>
                        <div className="estimator-bar-track">
                            <div className="estimator-bar-fill estimator-bar-fill-green" style={{ width: `${prefillScalePct}%` }} />
                        </div>
                        <span className="estimator-bar-value">{formatNumber(active.prefillTokensPerSec, 1)} tok/s</span>
                    </div>
                    <div className="estimator-bar-row">
                        <span className="estimator-bar-label"><TooltipLabel label="Approx TTFT" tip={TOOLTIPS.ttftApprox} /></span>
                        <div className="estimator-bar-track">
                            <div className="estimator-bar-fill estimator-bar-fill-amber" style={{ width: `${Math.min(100, (ttftApproxMs / 6000) * 100)}%` }} />
                        </div>
                        <span className="estimator-bar-value">{formatNumber(ttftApproxMs, 0)} ms</span>
                    </div>
                </div>
            </div>

            <div className="estimator-visual-card estimator-visual-card-wide">
                <h4>Realtime Memory Composition</h4>
                <p className="text-muted">Composition of total memory need for the selected model and current settings.</p>

                <div className="estimator-memory-stack">
                    <div className="estimator-memory-segment estimator-memory-segment-weights" style={{ width: `${weightsPct}%` }} />
                    <div className="estimator-memory-segment estimator-memory-segment-runtime" style={{ width: `${runtimePct}%` }} />
                    <div className="estimator-memory-segment estimator-memory-segment-kv" style={{ width: `${kvPct}%` }} />
                </div>
                <div className="estimator-memory-legend">
                    <span>Weights: {formatNumber(active.weightsGb, 1)} GB</span>
                    <span>Runtime: {formatNumber(active.runtimeBufferGb, 1)} GB</span>
                    <span>KV Cache: {formatNumber(active.kvCacheGb, 1)} GB</span>
                </div>

                <div className="estimator-bar-row mt-sm">
                    <span className="estimator-bar-label">VRAM Use</span>
                    <div className="estimator-bar-track">
                        <div className={`estimator-bar-fill ${active.requiredMemoryGb <= active.vramBudgetGb ? 'estimator-bar-fill-green' : 'estimator-bar-fill-amber'}`} style={{ width: `${vramUsePct}%` }} />
                    </div>
                    <span className="estimator-bar-value">{formatNumber(active.requiredMemoryGb, 1)} / {formatNumber(active.vramBudgetGb, 1)} GB</span>
                </div>

                <div className="estimator-timeline mt-sm">
                    <div className="estimator-timeline-point">
                        <div className="estimator-timeline-dot" />
                        <div className="estimator-timeline-text">Estimated output after 5s decode: <strong>{formatNumber(estTokens5s, 0)} tokens</strong></div>
                    </div>
                    <div className="estimator-timeline-point">
                        <div className="estimator-timeline-dot" />
                        <div className="estimator-timeline-text">Estimated output after 15s decode: <strong>{formatNumber(estTokens15s, 0)} tokens</strong></div>
                    </div>
                </div>

                <StreamingPreview decodeTokensPerSec={active.decodeTokensPerSec} modelLabel={active.model} />
            </div>
        </div>
    );
}

function TooltipLabel({ label, tip }) {
    return (
        <span className="tooltip-label">
            {label}
            <span className="tooltip-trigger" tabIndex={0} aria-label={`${label}: ${tip}`} data-tooltip={tip}>?</span>
        </span>
    );
}

export default function AiComputeEstimator({ onBack }) {
    const [inputs, setInputs] = useState(DEFAULT_INPUTS);
    const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
    const [selectedVisualizationModel, setSelectedVisualizationModel] = useState(MODEL_PRESETS[2].name);
    const effectiveInputs = useMemo(() => buildEffectiveInputs(inputs, showAdvancedInputs), [inputs, showAdvancedInputs]);

    const pcieBandwidth = useMemo(() => (PCIE_LANE_GBPS[inputs.pcieGen] || 0) * inputs.pcieLanes, [inputs.pcieGen, inputs.pcieLanes]);

    const modelResults = useMemo(() => {
        return MODEL_PRESETS.map((model) => estimateModelResult(model, effectiveInputs));
    }, [effectiveInputs]);

    const recommendations = useMemo(() => {
        const list = [];
        const bestNoOffload = modelResults.filter((result) => result.status === 'Runs in VRAM').at(-1);
        const bestWithOffload = modelResults.filter((result) => result.status !== 'Insufficient Memory').at(-1);

        if (bestNoOffload) {
            list.push(`Your current setup can comfortably host up to ${bestNoOffload.model} fully in VRAM.`);
        } else if (bestWithOffload) {
            list.push(`You can run up to ${bestWithOffload.model} using RAM offload, but decode speed will drop.`);
        } else {
            list.push('Current memory envelope is below practical local-hosting minimum; raise VRAM and system RAM first.');
        }

        if (inputs.vramPerGpuGb < 24) {
            list.push('Target at least 24 GB VRAM (or multi-GPU) if you want reliable 14B+ hosting with usable context.');
        }

        if (pcieBandwidth < 32) {
            list.push('PCIe throughput is low for offloaded inference; prefer PCIe Gen4 x16 or better for smoother decode.');
        }

        if (inputs.systemRamGb < 64) {
            list.push('64 GB+ system RAM is recommended for offload-heavy workflows, model swaps, and parallel tooling.');
        }

        if (inputs.cpuCores < 12) {
            list.push('More CPU cores help with tokenization, batching, and concurrent users; 12+ cores is a strong baseline.');
        }

        if (inputs.storageReadGbps < 5) {
            list.push('Upgrade to a faster NVMe drive to reduce model load times and hot-swap latency.');
        }

        return list;
    }, [inputs, modelResults, pcieBandwidth]);

    const handleInput = (field, value) => {
        setInputs((prev) => ({ ...prev, [field]: value }));
    };

    const handleGpuProfile = (profileName) => {
        const profile = GPU_PRESETS[profileName];
        if (!profile) {
            setInputs((prev) => ({ ...prev, gpuProfile: profileName }));
            return;
        }

        setInputs((prev) => ({
            ...prev,
            gpuProfile: profileName,
            ...profile
        }));
    };

    return (
        <div className="lobby-container estimator-container">
            <div className="starfield" />
            <div className="panel panel-glow estimator-card">
                <div className="lobby-header">
                    <h2>AI Compute Estimator</h2>
                    <p className="lobby-subtitle">Estimate what model sizes you can host locally and at what speed.</p>
                </div>

                <div className="estimator-section estimator-section-wide">
                    <label className="input-label">
                        <input
                            type="checkbox"
                            checked={showAdvancedInputs}
                            onChange={(e) => setShowAdvancedInputs(e.target.checked)}
                            style={{ marginRight: 8 }}
                        />
                        <TooltipLabel label="Show advanced tuning inputs" tip={TOOLTIPS.advancedToggle} />
                    </label>
                    {!showAdvancedInputs && (
                        <p className="text-muted">
                            Advanced values are auto-derived: CPU Memory BW <strong>{formatNumber(effectiveInputs.cpuMemoryBandwidth, 0)} GB/s</strong>,
                            NVLink <strong>{formatNumber(effectiveInputs.nvlinkBandwidth, 0)} GB/s</strong>,
                            utilization <strong>{formatNumber(effectiveInputs.efficiencyTarget * 100, 0)}%</strong>.
                        </p>
                    )}
                </div>

                <div className="estimator-grid">
                    <div className="estimator-section">
                        <h3>GPU + Interconnect</h3>

                        <div className="input-group">
                            <label className="input-label"><TooltipLabel label="GPU Profile" tip={TOOLTIPS.gpuProfile} /></label>
                            <select className="input" value={inputs.gpuProfile} onChange={(e) => handleGpuProfile(e.target.value)}>
                                {Object.keys(GPU_PRESETS).map((profile) => (
                                    <option key={profile} value={profile}>{profile}</option>
                                ))}
                            </select>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="GPU Count" tip={TOOLTIPS.gpuCount} /></label>
                                <input className="input" type="number" min="1" max="8" value={inputs.gpuCount} onChange={(e) => handleInput('gpuCount', Number(e.target.value) || 1)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="VRAM / GPU (GB)" tip={TOOLTIPS.vramPerGpuGb} /></label>
                                <input className="input" type="number" min="4" max="256" value={inputs.vramPerGpuGb} onChange={(e) => handleInput('vramPerGpuGb', Number(e.target.value) || 4)} />
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="GPU Memory BW (GB/s)" tip={TOOLTIPS.gpuMemoryBandwidth} /></label>
                                <input className="input" type="number" min="50" max="5000" value={inputs.gpuMemoryBandwidth} onChange={(e) => handleInput('gpuMemoryBandwidth', Number(e.target.value) || 50)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="FP16 TFLOPS / GPU" tip={TOOLTIPS.gpuFp16Tflops} /></label>
                                <input className="input" type="number" min="1" max="1000" value={inputs.gpuFp16Tflops} onChange={(e) => handleInput('gpuFp16Tflops', Number(e.target.value) || 1)} />
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="PCIe Gen" tip={TOOLTIPS.pcieGen} /></label>
                                <select className="input" value={inputs.pcieGen} onChange={(e) => handleInput('pcieGen', Number(e.target.value))}>
                                    <option value={3}>Gen3</option>
                                    <option value={4}>Gen4</option>
                                    <option value={5}>Gen5</option>
                                    <option value={6}>Gen6</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="PCIe Lanes" tip={TOOLTIPS.pcieLanes} /></label>
                                <select className="input" value={inputs.pcieLanes} onChange={(e) => handleInput('pcieLanes', Number(e.target.value))}>
                                    <option value={4}>x4</option>
                                    <option value={8}>x8</option>
                                    <option value={16}>x16</option>
                                </select>
                            </div>
                        </div>

                        {showAdvancedInputs ? (
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="NVLink / Interconnect BW (GB/s, optional)" tip={TOOLTIPS.nvlinkBandwidth} /></label>
                                <input className="input" type="number" min="0" max="2000" value={inputs.nvlinkBandwidth} onChange={(e) => handleInput('nvlinkBandwidth', Number(e.target.value) || 0)} />
                            </div>
                        ) : null}

                        <div className="estimator-stat">
                            <TooltipLabel label="Calculated PCIe Throughput" tip={TOOLTIPS.pcieThroughput} />
                            : <strong>{formatNumber(pcieBandwidth, 1)} GB/s</strong>
                        </div>
                    </div>

                    <div className="estimator-section">
                        <h3>CPU + System + Inference Settings</h3>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="CPU Cores" tip={TOOLTIPS.cpuCores} /></label>
                                <input className="input" type="number" min="2" max="256" value={inputs.cpuCores} onChange={(e) => handleInput('cpuCores', Number(e.target.value) || 2)} />
                            </div>
                            {showAdvancedInputs ? (
                                <div className="input-group">
                                    <label className="input-label"><TooltipLabel label="CPU Memory BW (GB/s, optional)" tip={TOOLTIPS.cpuMemoryBandwidth} /></label>
                                    <input className="input" type="number" min="10" max="1000" value={inputs.cpuMemoryBandwidth} onChange={(e) => handleInput('cpuMemoryBandwidth', Number(e.target.value) || 10)} />
                                </div>
                            ) : (
                                <div className="input-group">
                                    <label className="input-label">CPU Memory BW (auto)</label>
                                    <input className="input" type="text" value={`${formatNumber(effectiveInputs.cpuMemoryBandwidth, 0)} GB/s`} readOnly />
                                </div>
                            )}
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="System RAM (GB)" tip={TOOLTIPS.systemRamGb} /></label>
                                <input className="input" type="number" min="8" max="2048" value={inputs.systemRamGb} onChange={(e) => handleInput('systemRamGb', Number(e.target.value) || 8)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="NVMe Read (GB/s)" tip={TOOLTIPS.nvmeRead} /></label>
                                <input className="input" type="number" min="1" max="20" step="0.1" value={inputs.storageReadGbps} onChange={(e) => handleInput('storageReadGbps', Number(e.target.value) || 1)} />
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="Context Length" tip={TOOLTIPS.contextLength} /></label>
                                <input className="input" type="number" min="1024" max="262144" step="1024" value={inputs.contextLength} onChange={(e) => handleInput('contextLength', Number(e.target.value) || 1024)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="Concurrent Users" tip={TOOLTIPS.concurrentUsers} /></label>
                                <input className="input" type="number" min="1" max="128" value={inputs.concurrentUsers} onChange={(e) => handleInput('concurrentUsers', Number(e.target.value) || 1)} />
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="Weight Quantization (bits)" tip={TOOLTIPS.quantBits} /></label>
                                <select className="input" value={inputs.quantBits} onChange={(e) => handleInput('quantBits', Number(e.target.value))}>
                                    <option value={2}>2-bit</option>
                                    <option value={3}>3-bit</option>
                                    <option value={4}>4-bit</option>
                                    <option value={6}>6-bit</option>
                                    <option value={8}>8-bit</option>
                                    <option value={16}>16-bit</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label"><TooltipLabel label="KV Cache Dtype (bytes)" tip={TOOLTIPS.kvCacheBytes} /></label>
                                <select className="input" value={inputs.kvCacheBytes} onChange={(e) => handleInput('kvCacheBytes', Number(e.target.value))}>
                                    <option value={1}>8-bit KV</option>
                                    <option value={2}>16-bit KV</option>
                                </select>
                            </div>
                        </div>

                        {showAdvancedInputs ? (
                            <div className="input-group">
                                <label className="input-label">
                                    <TooltipLabel label={`Effective Utilization Target (${formatNumber(inputs.efficiencyTarget * 100, 0)}%, optional)`} tip={TOOLTIPS.utilization} />
                                </label>
                                <input
                                    className="input"
                                    type="range"
                                    min="0.35"
                                    max="0.85"
                                    step="0.01"
                                    value={inputs.efficiencyTarget}
                                    onChange={(e) => handleInput('efficiencyTarget', Number(e.target.value))}
                                />
                            </div>
                        ) : (
                            <div className="estimator-stat">
                                Effective Utilization (auto): <strong>{formatNumber(effectiveInputs.efficiencyTarget * 100, 0)}%</strong>
                            </div>
                        )}
                    </div>
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>Estimated Model Hosting Envelope</h3>
                    <div className="estimator-table-wrap">
                        <table className="estimator-table">
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th><TooltipLabel label="Status" tip={TOOLTIPS.status} /></th>
                                    <th><TooltipLabel label="Memory Need" tip={TOOLTIPS.memoryNeed} /></th>
                                    <th><TooltipLabel label="Decode tok/s" tip={TOOLTIPS.decode} /></th>
                                    <th><TooltipLabel label="Prefill tok/s" tip={TOOLTIPS.prefill} /></th>
                                    <th><TooltipLabel label="Main Bottleneck" tip={TOOLTIPS.bottleneck} /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {modelResults.map((result) => (
                                    <tr key={result.model}>
                                        <td>{result.model}</td>
                                        <td>
                                            <span className={`estimator-status ${
                                                result.status === 'Runs in VRAM'
                                                    ? 'ok'
                                                    : result.status === 'Runs with Offload'
                                                        ? 'warn'
                                                        : 'bad'
                                            }`}
                                                title={STATUS_TOOLTIPS[result.status]}
                                            >
                                                {result.status}
                                            </span>
                                        </td>
                                        <td>{formatNumber(result.requiredMemoryGb, 1)} GB</td>
                                        <td>{formatNumber(result.decodeTokensPerSec, 1)}</td>
                                        <td>{formatNumber(result.prefillTokensPerSec, 1)}</td>
                                        <td title={BOTTLENECK_TOOLTIPS[result.bottlenecks[0]] || TOOLTIPS.bottleneck}>{result.bottlenecks[0]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-muted mt-sm">
                        Estimates are directional and assume optimized inference stacks (vLLM / llama.cpp / TensorRT-LLM equivalents).
                        Real throughput varies by model architecture, backend kernels, rope scaling, and sampler settings.
                    </p>
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>Build Guidance</h3>
                    <RecommendationList recommendations={recommendations} />
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>Realtime Visualization</h3>
                    <ExampleVisualization
                        modelResults={modelResults}
                        selectedModel={selectedVisualizationModel}
                        onSelectModel={setSelectedVisualizationModel}
                        inputs={effectiveInputs}
                    />
                </div>

                <div className="lobby-form">
                    <button type="button" className="btn btn-secondary" onClick={onBack}>Back to Lobby</button>
                </div>
            </div>
        </div>
    );
}
