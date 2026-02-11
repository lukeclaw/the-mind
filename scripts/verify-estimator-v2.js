const assert = require('assert');
const engine = require('../server/estimatorEngine');

function assertMonotonic(metric, label) {
    assert(metric.p10 <= metric.p50, `${label}: p10 > p50`);
    assert(metric.p50 <= metric.p90, `${label}: p50 > p90`);
}

function runScenarioChecks() {
    const inputs = engine.mergeEstimateInputs({
        model_id: 'llm-14b',
        runtime_id: 'vllm',
        quant_id: 'q4',
        workload: {
            context_tokens: 8192,
            output_tokens: 512,
            concurrency: 2
        },
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
        kvCacheBytes: 2,
        efficiencyTarget: 0.62,
        showAdvancedInputs: true
    });

    const result = engine.estimateScenario(inputs.modelId, inputs);

    assert(['in_vram', 'with_offload', 'insufficient_memory'].includes(result.feasibilityCode), 'Invalid feasibility code');
    assert(result.memory.p50 > 0, 'Memory p50 must be > 0');

    assertMonotonic(result.throughput.decode, 'Decode');
    assertMonotonic(result.throughput.prefill, 'Prefill');
    assertMonotonic(result.latency.ttftMs, 'TTFT');
    assertMonotonic(result.memory, 'Memory');

    const envelope = engine.estimateModelEnvelope(inputs);
    assert(Array.isArray(envelope) && envelope.length > 0, 'Envelope must be non-empty');

    const configs = engine.recommendConfigs(inputs);
    assert(Array.isArray(configs), 'Configs must be an array');

    const build = engine.recommendMinimumBuild(inputs);
    assert(build.minPerGpuVramGb > 0, 'Build guidance min VRAM must be > 0');

    console.log('Estimator V2 verification passed.');
}

runScenarioChecks();
