const PCIE_LANE_GBPS = {
    3: 0.985,
    4: 1.969,
    5: 3.938,
    6: 7.877
};

export const MODEL_CATALOG = [
    { id: 'llm-3b', label: '3B (Small)', paramsB: 3, kvMbPerTokenPerB: 0.06, layers: 28, contextMax: 32768 },
    { id: 'llm-7b', label: '7B (Starter)', paramsB: 7, kvMbPerTokenPerB: 0.068, layers: 32, contextMax: 65536 },
    { id: 'llm-8b', label: '8B (General)', paramsB: 8, kvMbPerTokenPerB: 0.072, layers: 32, contextMax: 131072 },
    { id: 'llm-14b', label: '14B (Prosumer)', paramsB: 14, kvMbPerTokenPerB: 0.076, layers: 40, contextMax: 131072 },
    { id: 'llm-32b', label: '32B (Large)', paramsB: 32, kvMbPerTokenPerB: 0.082, layers: 64, contextMax: 131072 },
    { id: 'llm-70b', label: '70B (Frontier Local)', paramsB: 70, kvMbPerTokenPerB: 0.09, layers: 80, contextMax: 131072 },
    { id: 'llm-123b', label: '123B (Extreme)', paramsB: 123, kvMbPerTokenPerB: 0.1, layers: 96, contextMax: 131072 }
];

export const RUNTIME_CATALOG = [
    { id: 'vllm', label: 'vLLM (CUDA)', decodeEff: 1.0, prefillEff: 1.0, ttftOverheadMs: 140 },
    { id: 'llama-cpp', label: 'llama.cpp (GPU offload)', decodeEff: 0.88, prefillEff: 0.83, ttftOverheadMs: 170 },
    { id: 'tensorrt-llm', label: 'TensorRT-LLM', decodeEff: 1.12, prefillEff: 1.15, ttftOverheadMs: 110 }
];

export const QUANT_CATALOG = [
    { id: 'q2', label: '2-bit', bits: 2, speedFactor: 1.22, qualityTier: 'experimental' },
    { id: 'q3', label: '3-bit', bits: 3, speedFactor: 1.13, qualityTier: 'aggressive' },
    { id: 'q4', label: '4-bit', bits: 4, speedFactor: 1.0, qualityTier: 'balanced' },
    { id: 'q6', label: '6-bit', bits: 6, speedFactor: 0.9, qualityTier: 'high' },
    { id: 'q8', label: '8-bit', bits: 8, speedFactor: 0.82, qualityTier: 'higher' },
    { id: 'fp16', label: '16-bit', bits: 16, speedFactor: 0.7, qualityTier: 'max' }
];

export const GPU_PRESETS_V2 = {
    custom: null,
    'RTX 3060 12GB': { gpuCount: 1, vramPerGpuGb: 12, gpuMemoryBandwidth: 360, gpuFp16Tflops: 13, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'RTX 4090 24GB': { gpuCount: 1, vramPerGpuGb: 24, gpuMemoryBandwidth: 1008, gpuFp16Tflops: 82, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'RTX 5090 32GB': { gpuCount: 1, vramPerGpuGb: 32, gpuMemoryBandwidth: 1790, gpuFp16Tflops: 105, pcieGen: 5, pcieLanes: 16, nvlinkBandwidth: 0 },
    '2x RTX 4090': { gpuCount: 2, vramPerGpuGb: 24, gpuMemoryBandwidth: 1008, gpuFp16Tflops: 82, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'A100 80GB PCIe': { gpuCount: 1, vramPerGpuGb: 80, gpuMemoryBandwidth: 2039, gpuFp16Tflops: 156, pcieGen: 4, pcieLanes: 16, nvlinkBandwidth: 0 },
    'H100 80GB SXM': { gpuCount: 1, vramPerGpuGb: 80, gpuMemoryBandwidth: 3350, gpuFp16Tflops: 197, pcieGen: 5, pcieLanes: 16, nvlinkBandwidth: 900 }
};

export const DEFAULT_ESTIMATOR_V2_INPUTS = {
    planningMode: 'hardware-first',
    objective: 'throughput',
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
    outputTokens: 512,
    concurrentUsers: 1,
    kvCacheBytes: 2,
    efficiencyTarget: 0.62,
    modelId: 'llm-8b',
    runtimeId: 'vllm',
    quantId: 'q4',
    showAdvancedInputs: false
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function quantById(quantId) {
    return QUANT_CATALOG.find((quant) => quant.id === quantId) || QUANT_CATALOG[2];
}

function runtimeById(runtimeId) {
    return RUNTIME_CATALOG.find((runtime) => runtime.id === runtimeId) || RUNTIME_CATALOG[0];
}

function modelById(modelId) {
    return MODEL_CATALOG.find((model) => model.id === modelId) || MODEL_CATALOG[2];
}

function pcieGbps(gen, lanes) {
    return (PCIE_LANE_GBPS[gen] || 0) * lanes;
}

function deriveAutoCpuMemoryBandwidth(cpuCores) {
    return clamp(cpuCores * 5.5, 30, 220);
}

function deriveAutoEfficiencyTarget(inputs) {
    let estimate = 0.66;
    if (inputs.gpuCount > 1) estimate -= 0.06;
    if (inputs.concurrentUsers > 4) estimate -= 0.04;
    return clamp(estimate, 0.45, 0.8);
}

export function buildEffectiveInputs(inputs) {
    if (inputs.showAdvancedInputs) return inputs;

    return {
        ...inputs,
        nvlinkBandwidth: 0,
        cpuMemoryBandwidth: deriveAutoCpuMemoryBandwidth(inputs.cpuCores),
        efficiencyTarget: deriveAutoEfficiencyTarget(inputs)
    };
}

export function estimateScenario(modelInput, rawInputs, options = {}) {
    const inputs = buildEffectiveInputs(rawInputs);
    const model = typeof modelInput === 'string' ? modelById(modelInput) : modelInput;
    const runtime = runtimeById(options.runtimeId || inputs.runtimeId);
    const quant = quantById(options.quantId || inputs.quantId);
    const tensorParallel = options.tensorParallel || Math.min(inputs.gpuCount, 1);

    const totalVramGb = inputs.gpuCount * inputs.vramPerGpuGb;
    const vramBudgetGb = totalVramGb * 0.9;
    const ramBudgetGb = inputs.systemRamGb * 0.82;

    const weightBytesPerParam = quant.bits / 8;
    const weightsGb = model.paramsB * weightBytesPerParam * 1.06;
    const runtimeBufferGb = Math.max(1.6, weightsGb * 0.1);
    const kvCacheGb = (model.paramsB * model.kvMbPerTokenPerB * inputs.contextLength * inputs.concurrentUsers * (inputs.kvCacheBytes / 2)) / 1024;

    const requiredMemoryGb = weightsGb + runtimeBufferGb + kvCacheGb;
    const offloadGb = Math.max(0, requiredMemoryGb - vramBudgetGb);

    const canRunInVram = requiredMemoryGb <= vramBudgetGb;
    const canRunWithOffload = offloadGb <= ramBudgetGb;

    let feasibilityCode = 'in_vram';
    if (!canRunInVram && canRunWithOffload) feasibilityCode = 'with_offload';
    if (!canRunWithOffload) feasibilityCode = 'insufficient_memory';

    const pcie = pcieGbps(inputs.pcieGen, inputs.pcieLanes);
    const interconnectGbps = inputs.gpuCount > 1
        ? Math.max(12, inputs.nvlinkBandwidth > 0 ? inputs.nvlinkBandwidth : pcie)
        : 9999;

    const interconnectPenalty = inputs.gpuCount > 1 ? clamp(interconnectGbps / 250, 0.55, 1) : 1;
    const multiGpuScale = inputs.gpuCount === 1 ? 1 : 1 + (inputs.gpuCount - 1) * 0.8;

    const gpuRawBw = inputs.gpuMemoryBandwidth * multiGpuScale * runtime.decodeEff * quant.speedFactor;
    const gpuEffectiveBw = gpuRawBw * inputs.efficiencyTarget * interconnectPenalty;

    const cpuFeedGbps = Math.min(inputs.cpuMemoryBandwidth * 0.85, pcie);
    const offloadRatio = requiredMemoryGb > 0 ? offloadGb / requiredMemoryGb : 0;

    const memoryPathBw = offloadRatio > 0
        ? 1 / (((1 - offloadRatio) / gpuEffectiveBw) + (offloadRatio / Math.max(1, cpuFeedGbps)))
        : gpuEffectiveBw;

    const concurrencyGain = 1 + Math.log2(inputs.concurrentUsers + 1) * 0.14;
    const decodeP50 = (memoryPathBw / Math.max(1.2, weightsGb * 0.9)) * concurrencyGain;

    const totalFp16Tflops = inputs.gpuFp16Tflops * multiGpuScale * interconnectPenalty * runtime.prefillEff;
    const computeCeilingTokSec = (totalFp16Tflops * 1e12) / (2 * model.paramsB * 1e9);
    const prefillP50 = Math.min(computeCeilingTokSec * 0.34, decodeP50 * 5.8);

    const ttftP50Ms = (inputs.contextLength / Math.max(1, prefillP50)) * 1000 + runtime.ttftOverheadMs;

    const uncertainty = {
        decode: feasibilityCode === 'in_vram' ? 0.12 : 0.2,
        prefill: feasibilityCode === 'in_vram' ? 0.14 : 0.23,
        ttft: feasibilityCode === 'in_vram' ? 0.15 : 0.25,
        memory: 0.06
    };

    const bottlenecks = [];
    if (offloadRatio > 0.15) bottlenecks.push('vram_capacity');
    if (offloadRatio > 0.1 && pcie < 40) bottlenecks.push('pcie_bandwidth');
    if (inputs.concurrentUsers > 2 && inputs.cpuCores < 12) bottlenecks.push('cpu_cores');
    if (inputs.gpuMemoryBandwidth < 600 && model.paramsB >= 14) bottlenecks.push('gpu_memory_bandwidth');
    if (inputs.gpuCount > 1 && interconnectGbps < 120) bottlenecks.push('multi_gpu_interconnect');
    if (bottlenecks.length === 0) bottlenecks.push('sampler_pipeline_overhead');

    return {
        model,
        runtime,
        quant,
        tensorParallel,
        feasibilityCode,
        memory: {
            requiredGb: requiredMemoryGb,
            vramBudgetGb,
            ramBudgetGb,
            weightsGb,
            runtimeBufferGb,
            kvCacheGb,
            offloadGb,
            p10: requiredMemoryGb * (1 - uncertainty.memory),
            p50: requiredMemoryGb,
            p90: requiredMemoryGb * (1 + uncertainty.memory)
        },
        throughput: {
            decode: {
                p10: decodeP50 * (1 - uncertainty.decode),
                p50: decodeP50,
                p90: decodeP50 * (1 + uncertainty.decode)
            },
            prefill: {
                p10: prefillP50 * (1 - uncertainty.prefill),
                p50: prefillP50,
                p90: prefillP50 * (1 + uncertainty.prefill)
            }
        },
        latency: {
            ttftMs: {
                p10: ttftP50Ms * (1 - uncertainty.ttft),
                p50: ttftP50Ms,
                p90: ttftP50Ms * (1 + uncertainty.ttft)
            }
        },
        bottlenecks,
        diagnostics: {
            pcieGbps: pcie,
            interconnectGbps,
            offloadRatio
        }
    };
}

export function estimateModelEnvelope(inputs) {
    return MODEL_CATALOG.map((model) => estimateScenario(model, inputs));
}

export function recommendConfigs(inputs) {
    const targetModel = modelById(inputs.modelId);
    const candidates = [];

    const tensorParallelOptions = [];
    for (let tp = 1; tp <= inputs.gpuCount; tp += 1) tensorParallelOptions.push(tp);

    for (const quant of QUANT_CATALOG) {
        for (const tp of tensorParallelOptions) {
            const prediction = estimateScenario(targetModel, inputs, {
                quantId: quant.id,
                tensorParallel: tp
            });

            if (prediction.feasibilityCode === 'insufficient_memory') continue;

            const objectiveScore = inputs.objective === 'latency'
                ? -prediction.latency.ttftMs.p50
                : prediction.throughput.decode.p50;

            candidates.push({
                id: `${quant.id}-tp${tp}`,
                quant: quant.label,
                tensorParallel: tp,
                feasibilityCode: prediction.feasibilityCode,
                decodeP50: prediction.throughput.decode.p50,
                prefillP50: prediction.throughput.prefill.p50,
                ttftP50: prediction.latency.ttftMs.p50,
                memoryRequiredGb: prediction.memory.requiredGb,
                score: objectiveScore
            });
        }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function recommendMinimumBuild(inputs) {
    const model = modelById(inputs.modelId);
    const quant = quantById(inputs.quantId);

    const weightsGb = model.paramsB * (quant.bits / 8) * 1.06;
    const kvCacheGb = (model.paramsB * model.kvMbPerTokenPerB * inputs.contextLength * Math.max(1, inputs.concurrentUsers) * (inputs.kvCacheBytes / 2)) / 1024;
    const requiredGb = weightsGb + kvCacheGb + Math.max(1.6, weightsGb * 0.1);

    const targetVram = Math.ceil((requiredGb / 0.9) / 4) * 4;
    const targetRam = Math.max(64, Math.ceil(requiredGb * 1.6 / 16) * 16);

    return {
        targetModel: model.label,
        minPerGpuVramGb: targetVram,
        recommendedSystemRamGb: targetRam,
        recommendedCpuCores: inputs.concurrentUsers > 4 ? 16 : 12,
        recommendedPcie: 'Gen4 x16 or better',
        notes: [
            'Aim for in-VRAM deployment for stable latency.',
            'If multi-GPU, prefer high-bandwidth interconnect.',
            'Use fast NVMe for quicker model load and swap behavior.'
        ]
    };
}

export function bottleneckLabel(code) {
    const map = {
        vram_capacity: 'VRAM capacity',
        pcie_bandwidth: 'PCIe bandwidth',
        cpu_cores: 'CPU core count',
        gpu_memory_bandwidth: 'GPU memory bandwidth',
        multi_gpu_interconnect: 'Multi-GPU interconnect',
        sampler_pipeline_overhead: 'Tokenizer / sampling overhead'
    };

    return map[code] || code;
}

export function feasibilityLabel(code) {
    const map = {
        in_vram: 'Runs in VRAM',
        with_offload: 'Runs with Offload',
        insufficient_memory: 'Insufficient Memory'
    };

    return map[code] || code;
}
