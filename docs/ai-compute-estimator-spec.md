# AI Compute Estimator: Technical Specification

## 1. Goals

Build a state-of-the-art local LLM compute estimator that predicts:
- Feasibility (can it run?)
- Throughput (prefill/decode tok/s)
- Latency (TTFT, p50/p95)
- Memory peaks (VRAM + host RAM)
- Bottlenecks and upgrade guidance

Quality target:
- Decode tok/s median error < 10%
- TTFT median error < 15%
- Memory peak error < 5%
- Confidence intervals for all key predictions

## 2. System Architecture

### 2.1 Components

1. `metadata-registry`
- Canonical catalog of model architectures, runtimes, hardware SKUs, quantization methods.

2. `benchmark-harness`
- Executes controlled benchmark sweeps on target systems.
- Emits structured run data and telemetry.

3. `telemetry-collector`
- Captures runtime counters (GPU, CPU, PCIe, memory, I/O, thermals).

4. `prediction-engine`
- Hybrid model:
  - Analytical (roofline/memory path)
  - ML correction model trained on benchmark corpus
- Produces estimates + uncertainty.

5. `config-solver`
- Finds feasible runtime configs and optimal placements for objectives:
  - max throughput
  - min latency
  - max model size
  - best perf per dollar

6. `calibration-service`
- Continuously recalibrates model parameters using fresh production and benchmark data.

7. `estimator-api`
- Public interface for UI and integrations.

8. `ui-client`
- Interactive calculator, what-if scenarios, and upgrade recommendations.

### 2.2 High-Level Data Flow

1. User submits hardware + model target + runtime options.
2. API enriches request from metadata registry.
3. Config solver generates feasible candidate configurations.
4. Prediction engine scores candidates and produces estimates + confidence bounds.
5. UI renders recommendation + alternatives + bottleneck explanations.
6. If run launched, telemetry is ingested to calibration service.

## 3. Canonical Data Model

## 3.1 Model Metadata (`model_specs`)

```json
{
  "model_id": "llama-3.1-70b-instruct",
  "family": "llama",
  "params_b": 70,
  "layers": 80,
  "hidden_size": 8192,
  "n_heads": 64,
  "n_kv_heads": 8,
  "intermediate_size": 28672,
  "context_max": 131072,
  "attention": "gqa",
  "moe": {
    "enabled": false,
    "experts": 0,
    "top_k": 0
  },
  "tokenizer": "sentencepiece",
  "weights_formats": ["fp16", "bf16", "int8", "int4"]
}
```

## 3.2 Runtime Metadata (`runtime_specs`)

```json
{
  "runtime_id": "vllm-0.6.4-cuda12.4",
  "backend": "vllm",
  "cuda_version": "12.4",
  "kernel_flags": {
    "flash_attention": true,
    "paged_kv": true,
    "fused_sampling": true
  },
  "supported_quant": ["awq-int4", "gptq-int4", "fp16", "bf16"],
  "scheduler": "continuous_batching"
}
```

## 3.3 Hardware Metadata (`hardware_profiles`)

```json
{
  "hardware_id": "dual-4090-epyc",
  "gpus": [
    {
      "sku": "RTX 4090",
      "count": 2,
      "vram_gb": 24,
      "mem_bw_gbps": 1008,
      "fp16_tflops": 82,
      "pcie_gen": 4,
      "pcie_lanes": 16
    }
  ],
  "interconnect": {
    "type": "pcie",
    "bw_gbps": 31.5,
    "latency_us": 2.5
  },
  "cpu": {
    "sku": "EPYC 9354",
    "cores": 32,
    "mem_bw_gbps": 205,
    "numa_nodes": 2
  },
  "ram_gb": 256,
  "storage": {
    "type": "nvme",
    "read_gbps": 7
  }
}
```

## 3.4 Benchmark Run Record (`benchmark_runs`)

```json
{
  "run_id": "uuid",
  "timestamp_utc": "2026-02-07T21:00:00Z",
  "model_id": "llama-3.1-70b-instruct",
  "runtime_id": "vllm-0.6.4-cuda12.4",
  "hardware_id": "dual-4090-epyc",
  "quant": "awq-int4",
  "context_tokens": 8192,
  "output_tokens": 512,
  "concurrency": 8,
  "parallelism": {
    "tensor_parallel": 2,
    "pipeline_parallel": 1
  },
  "metrics": {
    "ttft_ms_p50": 420,
    "ttft_ms_p95": 690,
    "prefill_toks_sec": 1650,
    "decode_toks_sec": 168,
    "latency_ms_p50": 940,
    "latency_ms_p95": 1870,
    "vram_peak_gb": 45.8,
    "ram_peak_gb": 71.0,
    "pcie_tx_gbps": 19.1,
    "gpu_util_pct": 87
  },
  "env": {
    "driver": "550.120",
    "os": "ubuntu-24.04",
    "container_hash": "sha256:..."
  }
}
```

## 4. Benchmark Harness Specification

## 4.1 Required Sweep Dimensions

1. Model size class
- 3B, 7/8B, 14B, 32B, 70B, >100B

2. Quantization
- FP16, BF16, INT8, INT4 (AWQ/GPTQ/GGUF variants)

3. Context length
- 2K, 4K, 8K, 16K, 32K, 64K, 128K (if supported)

4. Concurrency
- 1, 2, 4, 8, 16, 32

5. Parallelism
- TP: 1/2/4/8
- PP: 1/2/4

6. Runtime backend
- llama.cpp, vLLM, TensorRT-LLM (as available)

## 4.2 Standardized Prompts

Use fixed corpora buckets:
- short prompt (<= 256 tokens)
- medium prompt (~2K)
- long prompt (~8K)
- very long prompt (~32K)

Each benchmark scenario should include at least 10 repeated runs for p50/p95 stability.

## 5. Prediction Engine Design

## 5.1 Analytical Base Layer

Inputs:
- model architecture fields
- quantization format
- context + output length
- hardware topology
- runtime options

Outputs:
- memory decomposition:
  - weight memory
  - KV cache memory
  - runtime buffers
  - fragmentation reserve
- theoretical throughput ceilings:
  - memory-bound decode ceiling
  - compute-bound prefill ceiling

## 5.2 ML Correction Layer

Model:
- Gradient boosted trees (initial) + optional small MLP

Features:
- analytical outputs
- backend flags
- hardware counters (bandwidth, util, pcie, clocks)
- topology features (numa distance, interconnect class)

Predicted targets:
- decode tok/s
- prefill tok/s
- ttft p50/p95
- latency p50/p95
- vram peak
- ram peak

Uncertainty:
- Quantile regression (p10/p50/p90) or conformal prediction intervals.

## 5.3 Configuration Solver

Given objective and constraints, solver enumerates and ranks candidates:
- quant method
- TP/PP splits
- context window cap
- max concurrency
- offload strategy (none / partial / full layers)

Return top N candidates with:
- feasibility class
- expected metrics + confidence
- failure reasons if infeasible

## 6. API Contract

## 6.1 `POST /v1/estimate`

Request:
```json
{
  "model_id": "llama-3.1-70b-instruct",
  "runtime_id": "vllm-0.6.4-cuda12.4",
  "hardware": { "hardware_id": "dual-4090-epyc" },
  "workload": {
    "context_tokens": 8192,
    "output_tokens": 512,
    "concurrency": 8
  },
  "objective": "throughput"
}
```

Response:
```json
{
  "feasibility": "runs_with_offload",
  "estimates": {
    "decode_toks_sec": { "p50": 162, "p10": 138, "p90": 179 },
    "prefill_toks_sec": { "p50": 1510, "p10": 1290, "p90": 1680 },
    "ttft_ms": { "p50": 460, "p95": 760 },
    "vram_peak_gb": { "p50": 46.1 },
    "ram_peak_gb": { "p50": 69.8 }
  },
  "bottlenecks": [
    "pcie_bandwidth",
    "vram_capacity"
  ],
  "recommended_configs": [
    {
      "quant": "awq-int4",
      "tensor_parallel": 2,
      "pipeline_parallel": 1,
      "expected_decode_toks_sec": 162
    }
  ],
  "explanations": [
    "Model exceeds pure VRAM envelope by 8.2 GB, causing host offload.",
    "PCIe throughput limits sustained decode under current concurrency."
  ]
}
```

## 6.2 `POST /v1/calibrate`

Ingest observed run + telemetry to recalibration queue.

## 6.3 `GET /v1/catalog/*`

Catalog endpoints for models, runtimes, hardware profiles, quant methods.

## 7. Calibration and Drift Management

1. Daily batch retraining for correction model.
2. Trigger retrain on drift alarms:
- decode error median > 12%
- TTFT error median > 18%
- memory error > 7%
3. Keep model versions immutable and tagged by:
- runtime backend version
- driver major/minor
- CUDA version

## 8. Frontend Product Requirements

## 8.1 New UX Modes

1. `Target model first`
- User picks model/context/users.
- UI suggests minimum viable builds and upgrade tiers.

2. `Current hardware first`
- Existing estimator flow.
- Add confidence intervals and assumptions drawer.

3. `What-if optimizer`
- Compare build options side-by-side with perf, power, and cost.

## 8.2 Required UI Enhancements

- Display confidence ranges (not only point estimates).
- Add explicit feasibility classes:
  - `in_vram`
  - `with_offload`
  - `insufficient_memory`
- Show bottleneck breakdown percentages.
- Add backend selector and quant method selector.
- Add exportable permalink with encoded scenario.

## 9. Validation and Quality Gates

1. Offline validation set:
- Stratified by model size, runtime, hardware class.

2. Minimum launch gates:
- Decode tok/s MAPE <= 10%
- Prefill tok/s MAPE <= 12%
- TTFT MAPE <= 15%
- VRAM/RAM MAE <= 5%

3. Runtime monitoring:
- Prediction-vs-observed dashboards
- Drift alarms
- Feasibility false-positive/false-negative rates

## 10. Security and Privacy

- Do not store raw prompts in benchmark telemetry.
- Hash hardware identifiers where possible.
- Anonymize host metadata for shared benchmark pools.
- Signed benchmark artifacts and immutable run records.

## 11. Phased Implementation Plan

## Phase 0: Foundation (1-2 weeks)
- Create schema + catalogs.
- Add versioned benchmark run storage.
- Build `POST /v1/estimate` with current analytical engine.

## Phase 1: Benchmarking (2-4 weeks)
- Build harness and execute baseline sweep matrix.
- Add telemetry collector and standard run manifests.

## Phase 2: ML Correction (2-3 weeks)
- Train first correction model.
- Add confidence interval outputs.
- Integrate drift tracking.

## Phase 3: Solver + UX Upgrade (2-3 weeks)
- Add config solver and recommended candidates.
- Ship target-model-first mode and what-if comparison.

## Phase 4: Continuous Calibration (ongoing)
- Online ingest + periodic retrain.
- Backend/version-specific calibration bundles.

## 12. Non-Goals (Initial Version)

- Cloud deployment cost modeling beyond simple placeholders.
- Full cluster scheduler simulation.
- Vendor-specific proprietary kernel internals.

## 13. Immediate Next Tasks

1. Add backend model (`model_id`, `runtime_id`, `quant`) into current UI state.
2. Replace single-point outputs with `p10/p50/p90` envelope fields.
3. Add explicit feasibility reason codes.
4. Implement estimator endpoint contract and wire client to API.
5. Stand up benchmark harness script and first hardware profile pack.

## 14. Implementation Status (V2 Branch)

The frontend V2 estimator has been implemented while preserving legacy estimator access.

Implemented in app:
- V2 planning modes:
  - `hardware-first`
  - `target-first`
- Runtime + quantization selectors.
- Explicit feasibility codes:
  - `in_vram`
  - `with_offload`
  - `insufficient_memory`
- Confidence ranges (`p10/p50/p90`) for:
  - decode throughput
  - prefill throughput
  - TTFT
  - memory
- Recommended runtime configurations (quant + TP candidates) ranked by objective.
- Target-model build guidance block (minimum VRAM/RAM guidance).
- Realtime streaming mock tied to predicted decode rate.
- Legacy estimator remains available for compatibility.

Current code locations:
- V2 engine/catalogs: `client/src/lib/estimatorV2.js`
- V2 UI: `client/src/components/AiComputeEstimatorV2.jsx`
- Legacy preserved: `client/src/components/AiComputeEstimatorLegacy.jsx`
- Version wrapper: `client/src/components/AiComputeEstimator.jsx`

Still pending for full spec completion:
- Backend API (`/v1/estimate`, `/v1/calibrate`, catalogs) implementation.
- Benchmark harness + telemetry ingestion.
- Learned correction model and drift calibration service.
- Uncertainty calibration from real benchmark corpus (currently heuristic confidence bands).

## 15. Current Backend/UI Integration Status

As of current branch:
- Backend endpoints are implemented under:
  - `GET /api/estimator/v1/catalog/models`
  - `GET /api/estimator/v1/catalog/runtimes`
  - `GET /api/estimator/v1/catalog/quantizations`
  - `GET /api/estimator/v1/catalog/hardware-profiles`
  - `POST /api/estimator/v1/estimate`
  - `POST /api/estimator/v1/calibrate`
  - `GET /api/estimator/v1/calibrate`
- Frontend `AiComputeEstimatorV2` now consumes these endpoints with retry/timeout and local fallback behavior.
- Manual calibration sample submission is available from the UI.

## 16. Local Runbook

1. Start server:
```bash
cd server
npm install
npm run dev
```

2. Start client:
```bash
cd client
npm install
npm run dev
```

3. Open app and launch estimator:
- Lobby -> `AI Compute Estimator` (defaults to V2)
- Use `Open Legacy Estimator` to compare old behavior.

4. Quick verification:
```bash
node scripts/verify-estimator-v2.js
```

## 17. Known Gaps (Post-Integration)

- Calibration queue is in-memory only (non-persistent).
- `/api/estimator/v1/calibrate` does not yet trigger model retraining jobs.
- Confidence intervals are heuristic envelopes, not learned quantile models.
- No benchmark harness ingestion pipeline yet.
- No telemetry collector integration yet.
