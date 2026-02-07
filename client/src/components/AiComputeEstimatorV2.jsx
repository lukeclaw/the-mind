import { useEffect, useMemo, useState } from 'react';
import {
    DEFAULT_ESTIMATOR_V2_INPUTS,
    GPU_PRESETS_V2,
    MODEL_CATALOG,
    QUANT_CATALOG,
    RUNTIME_CATALOG,
    bottleneckLabel,
    buildEffectiveInputs,
    estimateModelEnvelope,
    estimateScenario,
    feasibilityLabel,
    recommendConfigs,
    recommendMinimumBuild
} from '../lib/estimatorV2';
import { loadEstimatorCatalogs, requestEstimate, submitCalibration } from '../lib/estimatorApi';

const STREAM_SAMPLE = (
    'Based on your selected runtime and hardware inputs, here is a projected streaming response. ' +
    'The estimator predicts generation speed from memory path limits, quantization, and interconnect constraints. ' +
    'If decode slows, prioritize VRAM capacity and GPU memory bandwidth before tuning secondary system parameters. '
).split(' ');

function formatNumber(value, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function FeasibilityBadge({ code }) {
    const className = code === 'in_vram' ? 'ok' : code === 'with_offload' ? 'warn' : 'bad';
    return <span className={`estimator-status ${className}`}>{feasibilityLabel(code)}</span>;
}

function StreamingPreview({ decodeTps }) {
    const [wordIndex, setWordIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const wordsPerSecond = Math.max(1, decodeTps * 0.75);

    useEffect(() => {
        if (!isPlaying) return undefined;

        const tickMs = 120;
        const wordsPerTick = Math.max(1, Math.round(wordsPerSecond * (tickMs / 1000)));
        const interval = setInterval(() => {
            setWordIndex((prev) => Math.min(prev + wordsPerTick, STREAM_SAMPLE.length));
        }, tickMs);

        return () => clearInterval(interval);
    }, [isPlaying, wordsPerSecond]);

    return (
        <div className="estimator-stream">
            <div className="estimator-stream-header">
                <strong>Realtime Streaming Mock</strong>
                <span className="text-muted">~{formatNumber(wordsPerSecond, 1)} words/s</span>
            </div>
            <div className="estimator-stream-output">
                {STREAM_SAMPLE.slice(0, wordIndex).join(' ') || '...'}
                {wordIndex < STREAM_SAMPLE.length && <span className="estimator-stream-caret">|</span>}
            </div>
            <div className="estimator-stream-controls">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setIsPlaying((v) => !v)}>{isPlaying ? 'Pause' : 'Play'}</button>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => { setWordIndex(0); setIsPlaying(true); }}>Restart</button>
            </div>
        </div>
    );
}

function ConfidenceCell({ metric }) {
    return (
        <div className="estimator-confidence">
            <span>p10 {formatNumber(metric.p10)}</span>
            <strong>p50 {formatNumber(metric.p50)}</strong>
            <span>p90 {formatNumber(metric.p90)}</span>
        </div>
    );
}

function toGpuProfileMap(items) {
    const map = { ...GPU_PRESETS_V2 };
    for (const item of items || []) {
        map[item.id] = item.spec;
    }
    if (!Object.prototype.hasOwnProperty.call(map, 'custom')) map.custom = null;
    return map;
}

export default function AiComputeEstimatorV2({ onBack, onSwitchLegacy }) {
    const [inputs, setInputs] = useState(DEFAULT_ESTIMATOR_V2_INPUTS);
    const [modelCatalog, setModelCatalog] = useState(MODEL_CATALOG);
    const [runtimeCatalog, setRuntimeCatalog] = useState(RUNTIME_CATALOG);
    const [quantCatalog, setQuantCatalog] = useState(QUANT_CATALOG);
    const [gpuProfiles, setGpuProfiles] = useState(GPU_PRESETS_V2);

    const [apiResult, setApiResult] = useState(null);
    const [apiCatalogError, setApiCatalogError] = useState(null);
    const [apiEstimateError, setApiEstimateError] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);
    const [calibrationState, setCalibrationState] = useState({ loading: false, message: null, error: null });

    const apiBase = useMemo(() => {
        const serverUrl = import.meta.env.VITE_SERVER_URL;
        return (serverUrl || 'http://localhost:3001').replace(/\/$/, '');
    }, []);

    const effectiveInputs = useMemo(() => buildEffectiveInputs(inputs), [inputs]);

    const localPrediction = useMemo(() => estimateScenario(inputs.modelId, effectiveInputs), [inputs.modelId, effectiveInputs]);
    const localEnvelope = useMemo(() => estimateModelEnvelope(effectiveInputs), [effectiveInputs]);
    const localConfigs = useMemo(() => recommendConfigs(effectiveInputs), [effectiveInputs]);
    const localBuildAdvice = useMemo(() => recommendMinimumBuild(effectiveInputs), [effectiveInputs]);

    useEffect(() => {
        let cancelled = false;

        async function loadCatalogs() {
            try {
                const catalog = await loadEstimatorCatalogs(apiBase);

                if (cancelled) return;

                if (catalog.models.length > 0) setModelCatalog(catalog.models);
                if (catalog.runtimes.length > 0) setRuntimeCatalog(catalog.runtimes);
                if (catalog.quantizations.length > 0) setQuantCatalog(catalog.quantizations);
                if (catalog.hardwareProfiles.length > 0) setGpuProfiles(toGpuProfileMap(catalog.hardwareProfiles));
                setApiCatalogError(null);
            } catch (error) {
                if (!cancelled) {
                    setApiCatalogError(error.message);
                }
            }
        }

        loadCatalogs();

        return () => {
            cancelled = true;
        };
    }, [apiBase]);

    useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(async () => {
            setApiLoading(true);

            try {
                const payload = {
                    ...effectiveInputs,
                    model_id: effectiveInputs.modelId,
                    runtime_id: effectiveInputs.runtimeId,
                    quant_id: effectiveInputs.quantId,
                    workload: {
                        context_tokens: effectiveInputs.contextLength,
                        output_tokens: effectiveInputs.outputTokens,
                        concurrency: effectiveInputs.concurrentUsers
                    }
                };

                const json = await requestEstimate(apiBase, payload, {
                    timeoutMs: 7000,
                    retries: 2
                });

                if (cancelled) return;
                setApiResult(json);
                setApiEstimateError(null);
            } catch (error) {
                if (!cancelled && error.name !== 'AbortError') {
                    setApiResult(null);
                    setApiEstimateError(error.message);
                }
            } finally {
                if (!cancelled) setApiLoading(false);
            }
        }, 260);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [apiBase, effectiveInputs]);

    const prediction = useMemo(() => {
        if (!apiResult?.throughput) return localPrediction;

        return apiResult;
    }, [apiResult, localPrediction]);

    const configs = useMemo(() => {
        if (Array.isArray(apiResult?.recommendedConfigs) && apiResult.recommendedConfigs.length > 0) {
            return apiResult.recommendedConfigs;
        }
        return localConfigs;
    }, [apiResult, localConfigs]);

    const buildAdvice = useMemo(() => {
        if (apiResult?.minimumBuild) return apiResult.minimumBuild;
        return localBuildAdvice;
    }, [apiResult, localBuildAdvice]);

    const envelopeRows = useMemo(() => {
        if (Array.isArray(apiResult?.envelope) && apiResult.envelope.length > 0) {
            return apiResult.envelope.map((row) => ({
                key: row.model_id,
                modelLabel: row.model,
                feasibilityCode: row.feasibility,
                decodeP50: row.decode_p50,
                memoryP50: row.memory_p50
            }));
        }

        return localEnvelope.map((row) => ({
            key: row.model.id,
            modelLabel: row.model.label,
            feasibilityCode: row.feasibilityCode,
            decodeP50: row.throughput.decode.p50,
            memoryP50: row.memory.p50
        }));
    }, [apiResult, localEnvelope]);

    const handleSubmitCalibration = async () => {
        setCalibrationState({ loading: true, message: null, error: null });

        try {
            const payload = {
                model_id: inputs.modelId,
                runtime_id: inputs.runtimeId,
                quant_id: inputs.quantId,
                workload: {
                    context_tokens: inputs.contextLength,
                    output_tokens: inputs.outputTokens,
                    concurrency: inputs.concurrentUsers
                },
                observed_metrics: {
                    decode_toks_sec_p50: prediction.throughput.decode.p50,
                    prefill_toks_sec_p50: prediction.throughput.prefill.p50,
                    ttft_ms_p50: prediction.latency.ttftMs.p50,
                    memory_gb_p50: prediction.memory.p50
                },
                diagnostics: prediction.diagnostics || null,
                source: 'ui-v2-manual'
            };

            const response = await submitCalibration(apiBase, payload);
            setCalibrationState({
                loading: false,
                message: `Submitted calibration run ${response.calibration_run_id}. Queue size: ${response.queue_size}.`,
                error: null
            });
        } catch (error) {
            setCalibrationState({
                loading: false,
                message: null,
                error: error.message || 'Failed to submit calibration run.'
            });
        }
    };

    const handleInput = (field, value) => {
        setInputs((prev) => ({ ...prev, [field]: value }));
    };

    const handleGpuProfile = (profileName) => {
        const preset = gpuProfiles[profileName];
        if (!preset) {
            setInputs((prev) => ({ ...prev, gpuProfile: profileName }));
            return;
        }

        setInputs((prev) => ({ ...prev, gpuProfile: profileName, ...preset }));
    };

    return (
        <div className="lobby-container estimator-container">
            <div className="starfield" />
            <div className="panel panel-glow estimator-card estimator-v2-card">
                <div className="lobby-header">
                    <h2>AI Compute Estimator V2</h2>
                    <p className="lobby-subtitle">Spec-aligned estimator with feasibility codes, confidence ranges, and config recommendations.</p>
                </div>

                <div className="estimator-v2-topbar">
                    <div className="input-group">
                        <label className="input-label">Planning Mode</label>
                        <select className="input" value={inputs.planningMode} onChange={(e) => handleInput('planningMode', e.target.value)}>
                            <option value="hardware-first">Current Hardware First</option>
                            <option value="target-first">Target Model First</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Objective</label>
                        <select className="input" value={inputs.objective} onChange={(e) => handleInput('objective', e.target.value)}>
                            <option value="throughput">Max Throughput</option>
                            <option value="latency">Min Latency</option>
                        </select>
                    </div>
                    <div className="input-group estimator-v2-toggle-wrap">
                        <label className="input-label">Advanced Inputs</label>
                        <label className="estimator-v2-inline-toggle">
                            <input type="checkbox" checked={inputs.showAdvancedInputs} onChange={(e) => handleInput('showAdvancedInputs', e.target.checked)} />
                            <span>Enable manual overrides</span>
                        </label>
                    </div>
                </div>

                {(apiCatalogError || apiEstimateError || apiLoading) && (
                    <div className="estimator-section estimator-section-wide">
                        {apiLoading && <div className="text-muted">Syncing estimate from backend...</div>}
                        {apiCatalogError && (
                            <div className="text-warning">
                                Catalog API fallback: {apiCatalogError}. If this persists, restart backend from this branch: <code>cd server && npm run dev</code>.
                            </div>
                        )}
                        {apiEstimateError && (
                            <div className="text-warning">
                                Estimate API fallback: {apiEstimateError}. If this persists, restart backend from this branch: <code>cd server && npm run dev</code>.
                            </div>
                        )}
                    </div>
                )}

                {(calibrationState.message || calibrationState.error) && (
                    <div className="estimator-section estimator-section-wide">
                        {calibrationState.message && <div className="text-success">{calibrationState.message}</div>}
                        {calibrationState.error && <div className="text-danger">{calibrationState.error}</div>}
                    </div>
                )}

                <div className="estimator-grid">
                    <div className="estimator-section">
                        <h3>Model + Runtime</h3>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">Target Model</label>
                                <select className="input" value={inputs.modelId} onChange={(e) => handleInput('modelId', e.target.value)}>
                                    {modelCatalog.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Runtime</label>
                                <select className="input" value={inputs.runtimeId} onChange={(e) => handleInput('runtimeId', e.target.value)}>
                                    {runtimeCatalog.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">Quantization</label>
                                <select className="input" value={inputs.quantId} onChange={(e) => handleInput('quantId', e.target.value)}>
                                    {quantCatalog.map((quant) => <option key={quant.id} value={quant.id}>{quant.label}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">KV Cache Bytes</label>
                                <select className="input" value={inputs.kvCacheBytes} onChange={(e) => handleInput('kvCacheBytes', Number(e.target.value))}>
                                    <option value={1}>8-bit KV</option>
                                    <option value={2}>16-bit KV</option>
                                </select>
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">Context Length</label>
                                <input className="input" type="number" min="1024" max="262144" step="1024" value={inputs.contextLength} onChange={(e) => handleInput('contextLength', Number(e.target.value) || 1024)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Concurrent Users</label>
                                <input className="input" type="number" min="1" max="128" value={inputs.concurrentUsers} onChange={(e) => handleInput('concurrentUsers', Number(e.target.value) || 1)} />
                            </div>
                        </div>
                    </div>

                    <div className="estimator-section">
                        <h3>Hardware Envelope</h3>

                        <div className="input-group">
                            <label className="input-label">GPU Profile</label>
                            <select className="input" value={inputs.gpuProfile} onChange={(e) => handleGpuProfile(e.target.value)}>
                                {Object.keys(gpuProfiles).map((profile) => <option key={profile} value={profile}>{profile}</option>)}
                            </select>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">GPU Count</label>
                                <input className="input" type="number" min="1" max="8" value={inputs.gpuCount} onChange={(e) => handleInput('gpuCount', Number(e.target.value) || 1)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">VRAM / GPU (GB)</label>
                                <input className="input" type="number" min="4" max="256" value={inputs.vramPerGpuGb} onChange={(e) => handleInput('vramPerGpuGb', Number(e.target.value) || 4)} />
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">GPU Memory BW (GB/s)</label>
                                <input className="input" type="number" min="50" max="5000" value={inputs.gpuMemoryBandwidth} onChange={(e) => handleInput('gpuMemoryBandwidth', Number(e.target.value) || 50)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">FP16 TFLOPS / GPU</label>
                                <input className="input" type="number" min="1" max="1000" value={inputs.gpuFp16Tflops} onChange={(e) => handleInput('gpuFp16Tflops', Number(e.target.value) || 1)} />
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">PCIe Gen</label>
                                <select className="input" value={inputs.pcieGen} onChange={(e) => handleInput('pcieGen', Number(e.target.value))}>
                                    <option value={3}>Gen3</option>
                                    <option value={4}>Gen4</option>
                                    <option value={5}>Gen5</option>
                                    <option value={6}>Gen6</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">PCIe Lanes</label>
                                <select className="input" value={inputs.pcieLanes} onChange={(e) => handleInput('pcieLanes', Number(e.target.value))}>
                                    <option value={4}>x4</option>
                                    <option value={8}>x8</option>
                                    <option value={16}>x16</option>
                                </select>
                            </div>
                        </div>

                        <div className="estimator-input-row">
                            <div className="input-group">
                                <label className="input-label">System RAM (GB)</label>
                                <input className="input" type="number" min="8" max="2048" value={inputs.systemRamGb} onChange={(e) => handleInput('systemRamGb', Number(e.target.value) || 8)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">CPU Cores</label>
                                <input className="input" type="number" min="2" max="256" value={inputs.cpuCores} onChange={(e) => handleInput('cpuCores', Number(e.target.value) || 2)} />
                            </div>
                        </div>

                        {inputs.showAdvancedInputs ? (
                            <>
                                <div className="estimator-input-row">
                                    <div className="input-group">
                                        <label className="input-label">CPU Memory BW (GB/s)</label>
                                        <input className="input" type="number" min="10" max="1000" value={inputs.cpuMemoryBandwidth} onChange={(e) => handleInput('cpuMemoryBandwidth', Number(e.target.value) || 10)} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">NVLink BW (GB/s)</label>
                                        <input className="input" type="number" min="0" max="2000" value={inputs.nvlinkBandwidth} onChange={(e) => handleInput('nvlinkBandwidth', Number(e.target.value) || 0)} />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Effective Utilization ({formatNumber(inputs.efficiencyTarget * 100, 0)}%)</label>
                                    <input className="input" type="range" min="0.35" max="0.85" step="0.01" value={inputs.efficiencyTarget} onChange={(e) => handleInput('efficiencyTarget', Number(e.target.value))} />
                                </div>
                            </>
                        ) : (
                            <div className="estimator-stat">Auto CPU Mem BW: <strong>{formatNumber(effectiveInputs.cpuMemoryBandwidth, 0)} GB/s</strong> | Auto utilization: <strong>{formatNumber(effectiveInputs.efficiencyTarget * 100, 0)}%</strong></div>
                        )}
                    </div>
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>Prediction API-style Output</h3>
                    <div className="estimator-v2-kpis">
                        <div>
                            <span className="text-muted">Feasibility Code</span>
                            <div><code>{prediction.feasibilityCode}</code></div>
                            <FeasibilityBadge code={prediction.feasibilityCode} />
                        </div>
                        <div>
                            <span className="text-muted">Primary Bottleneck</span>
                            <div><strong>{prediction.bottleneckLabels?.[0] || bottleneckLabel(prediction.bottlenecks[0])}</strong></div>
                        </div>
                        <div>
                            <span className="text-muted">Memory Required</span>
                            <div><strong>{formatNumber(prediction.memory.p50)} GB</strong></div>
                        </div>
                    </div>

                    <div className="estimator-table-wrap mt-sm">
                        <table className="estimator-table estimator-v2-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Confidence (p10 / p50 / p90)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Decode tok/s</td>
                                    <td><ConfidenceCell metric={prediction.throughput.decode} /></td>
                                </tr>
                                <tr>
                                    <td>Prefill tok/s</td>
                                    <td><ConfidenceCell metric={prediction.throughput.prefill} /></td>
                                </tr>
                                <tr>
                                    <td>TTFT ms</td>
                                    <td><ConfidenceCell metric={prediction.latency.ttftMs} /></td>
                                </tr>
                                <tr>
                                    <td>Memory GB</td>
                                    <td><ConfidenceCell metric={prediction.memory} /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {Array.isArray(prediction.explanations) && prediction.explanations.length > 0 && (
                        <div className="estimator-v2-build-card mt-sm">
                            <strong>Why this estimate</strong>
                            <ul className="estimator-recommendations">
                                {prediction.explanations.map((explanation) => <li key={explanation}>{explanation}</li>)}
                            </ul>
                        </div>
                    )}

                    {prediction.diagnostics && (
                        <div className="estimator-v2-kpis mt-sm">
                            <div>
                                <span className="text-muted">PCIe Throughput</span>
                                <div><strong>{formatNumber(prediction.diagnostics.pcieGbps, 1)} GB/s</strong></div>
                            </div>
                            <div>
                                <span className="text-muted">Interconnect</span>
                                <div><strong>{formatNumber(prediction.diagnostics.interconnectGbps, 1)} GB/s</strong></div>
                            </div>
                            <div>
                                <span className="text-muted">Offload Ratio</span>
                                <div><strong>{formatNumber((prediction.diagnostics.offloadRatio || 0) * 100, 1)}%</strong></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>Recommended Runtime Configs</h3>
                    <div className="estimator-table-wrap">
                        <table className="estimator-table">
                            <thead>
                                <tr>
                                    <th>Config</th>
                                    <th>Feasibility</th>
                                    <th>Decode p50</th>
                                    <th>Prefill p50</th>
                                    <th>TTFT p50</th>
                                    <th>Memory</th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map((config) => (
                                    <tr key={config.id}>
                                        <td>{config.quant}, TP{config.tensorParallel}</td>
                                        <td><FeasibilityBadge code={config.feasibilityCode} /></td>
                                        <td>{formatNumber(config.decodeP50)}</td>
                                        <td>{formatNumber(config.prefillP50)}</td>
                                        <td>{formatNumber(config.ttftP50, 0)} ms</td>
                                        <td>{formatNumber(config.memoryRequiredGb, 1)} GB</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>{inputs.planningMode === 'target-first' ? 'Target Model Build Guidance' : 'Model Envelope Snapshot'}</h3>
                    {inputs.planningMode === 'target-first' ? (
                        <div className="estimator-v2-build-card">
                            <p>Target: <strong>{buildAdvice.targetModel}</strong></p>
                            <p>Minimum VRAM per GPU: <strong>{buildAdvice.minPerGpuVramGb} GB</strong></p>
                            <p>Recommended system RAM: <strong>{buildAdvice.recommendedSystemRamGb} GB</strong></p>
                            <p>Recommended CPU cores: <strong>{buildAdvice.recommendedCpuCores}</strong></p>
                            <p>Recommended PCIe: <strong>{buildAdvice.recommendedPcie}</strong></p>
                            <ul className="estimator-recommendations">
                                {buildAdvice.notes.map((note) => <li key={note}>{note}</li>)}
                            </ul>
                        </div>
                    ) : (
                        <div className="estimator-table-wrap">
                            <table className="estimator-table">
                                <thead>
                                    <tr>
                                        <th>Model</th>
                                        <th>Feasibility</th>
                                        <th>Decode p50</th>
                                        <th>Memory p50</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {envelopeRows.map((row) => (
                                        <tr key={row.key}>
                                            <td>{row.modelLabel}</td>
                                            <td><FeasibilityBadge code={row.feasibilityCode} /></td>
                                            <td>{formatNumber(row.decodeP50)}</td>
                                            <td>{formatNumber(row.memoryP50, 1)} GB</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="estimator-section estimator-section-wide">
                    <h3>Realtime Output Mock</h3>
                    <StreamingPreview decodeTps={prediction.throughput.decode.p50} />
                </div>

                <div className="lobby-form">
                    <button type="button" className="btn btn-secondary" onClick={onBack}>Back to Lobby</button>
                    <button type="button" className="btn btn-secondary" onClick={handleSubmitCalibration} disabled={calibrationState.loading}>
                        {calibrationState.loading ? 'Submitting Calibration...' : 'Submit Calibration Sample'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={onSwitchLegacy}>Open Legacy Estimator</button>
                </div>
            </div>
        </div>
    );
}
