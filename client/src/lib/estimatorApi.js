const DEFAULT_TIMEOUT_MS = 6000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            const text = await response.text();
            const compact = (text || response.statusText || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 160);
            throw new Error(`HTTP ${response.status} (${url}) ${compact}`);
        }

        try {
            return await response.json();
        } catch {
            const raw = await response.text().catch(() => '');
            const snippet = raw ? raw.slice(0, 120) : 'empty response';
            throw new Error(`Invalid JSON response from ${url}: ${snippet}`);
        }
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchWithRetry(url, options = {}) {
    const retries = options.retries ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 220;

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fetchJson(url, options);
        } catch (error) {
            lastError = error;
            if (attempt >= retries) break;
            await sleep(retryDelayMs * (attempt + 1));
        }
    }

    throw lastError;
}

function normalizeEstimateResponse(response) {
    if (!response?.estimates) return null;

    return {
        feasibilityCode: response.feasibility,
        feasibilityLabel: response.feasibilityLabel,
        throughput: {
            decode: response.estimates.decode_toks_sec,
            prefill: response.estimates.prefill_toks_sec
        },
        latency: {
            ttftMs: response.estimates.ttft_ms
        },
        memory: response.estimates.memory_gb,
        bottlenecks: (response.bottlenecks || []).map((item) => item.code),
        bottleneckLabels: (response.bottlenecks || []).map((item) => item.label),
        recommendedConfigs: response.recommended_configs || [],
        minimumBuild: response.minimum_build || null,
        envelope: response.envelope || [],
        diagnostics: response.diagnostics || null,
        explanations: response.explanations || []
    };
}

export async function loadEstimatorCatalogs(apiBase) {
    const [modelsJson, runtimesJson, quantsJson, hwJson] = await Promise.all([
        fetchWithRetry(`${apiBase}/api/estimator/v1/catalog/models`, { retries: 1 }),
        fetchWithRetry(`${apiBase}/api/estimator/v1/catalog/runtimes`, { retries: 1 }),
        fetchWithRetry(`${apiBase}/api/estimator/v1/catalog/quantizations`, { retries: 1 }),
        fetchWithRetry(`${apiBase}/api/estimator/v1/catalog/hardware-profiles`, { retries: 1 })
    ]);

    return {
        models: modelsJson.items || [],
        runtimes: runtimesJson.items || [],
        quantizations: quantsJson.items || [],
        hardwareProfiles: hwJson.items || []
    };
}

export async function requestEstimate(apiBase, payload, options = {}) {
    const response = await fetchWithRetry(`${apiBase}/api/estimator/v1/estimate`, {
        method: 'POST',
        body: JSON.stringify(payload),
        retries: options.retries ?? 2,
        retryDelayMs: options.retryDelayMs ?? 240,
        timeoutMs: options.timeoutMs ?? 7000
    });

    return normalizeEstimateResponse(response);
}

export async function submitCalibration(apiBase, payload) {
    return fetchWithRetry(`${apiBase}/api/estimator/v1/calibrate`, {
        method: 'POST',
        body: JSON.stringify(payload),
        retries: 1,
        timeoutMs: 6000
    });
}
