import { useState } from 'react';
import AiComputeEstimatorLegacy from './AiComputeEstimatorLegacy';
import AiComputeEstimatorV2 from './AiComputeEstimatorV2';

export default function AiComputeEstimator({ onBack }) {
    const [version, setVersion] = useState('v2');

    if (version === 'legacy') {
        return <AiComputeEstimatorLegacy onBack={onBack} />;
    }

    return <AiComputeEstimatorV2 onBack={onBack} onSwitchLegacy={() => setVersion('legacy')} />;
}
