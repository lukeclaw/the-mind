import { useRef, useEffect, useState, useCallback } from 'react';

// A curated list of official DoodleNet/QuickDraw labels
const DRAWABLE_CLASSES = [
    'apple', 'banana', 'bicycle', 'birthday cake', 'blackberry', 'bread', 'bus', 'butterfly',
    'candle', 'cat', 'chair', 'cloud', 'coffee cup', 'cookie', 'cup', 'dog', 'donut',
    'envelope', 'eye', 'eyeglasses', 'face', 'flower', 'fork', 'giraffe', 'hammer',
    'hat', 'helicopter', 'horse', 'hot dog', 'house', 'ice cream', 'key', 'knife',
    'light bulb', 'lightning', 'mountain', 'mushroom', 'octopus', 'owl', 'pants',
    'pear', 'pencil', 'piano', 'pizza', 'rainbow', 'sailboat', 'star', 'sun', 'sword',
    'syringe', 'teddy-bear', 'telephone', 'television', 'tent', 'tooth', 'toothbrush',
    'traffic light', 'tree', 'umbrella', 'wheel', 'wristwatch'
];

export default function MinimalistMasterpiece({ gameState, onSubmitScore, onLeave }) {
    const canvasRef = useRef(null);
    const [classifier, setClassifier] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [predictions, setPredictions] = useState([]);
    const [inkUsed, setInkUsed] = useState(0);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [roastMessage, setRoastMessage] = useState(null);
    const [roastTimer, setRoastTimer] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [debugPreview, setDebugPreview] = useState(null); // DataURL for AI vision
    const [showDebug, setShowDebug] = useState(false); // Global debug toggle

    // Game State derived from props - MUST BE AT TOP
    const { targetWord, status, players, round, totalRounds, mode } = gameState;
    const myPlayer = players.find(p => p.isMe) || {};
    const isSandbox = mode === 'sandbox';

    // Refs for real-time values to avoid effect churn
    const targetWordRef = useRef(targetWord);
    const statusRef = useRef(status);
    const isSandboxRef = useRef(isSandbox);
    const myPlayerRef = useRef(myPlayer);
    const inkUsedRef = useRef(inkUsed);

    useEffect(() => { targetWordRef.current = targetWord; }, [targetWord]);
    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { isSandboxRef.current = isSandbox; }, [isSandbox]);
    useEffect(() => { myPlayerRef.current = myPlayer; }, [myPlayer]);
    useEffect(() => { inkUsedRef.current = inkUsed; }, [inkUsed]);

    useEffect(() => {
        let script;
        // Load ml5 script if needed
        if (!window.ml5) {
            script = document.createElement('script');
            script.src = "https://unpkg.com/ml5@0.12.2/dist/ml5.min.js";
            script.async = true;
            script.onload = () => initModel();
            script.onerror = () => {
                console.error("ML5 Script Load Failed");
                setStatusMessage('Failed to load AI library. Check connection.');
            };
            document.body.appendChild(script);
        } else {
            initModel();
        }

        function initModel() {
            setStatusMessage('Loading DoodleNet...');
            console.log('ML5: Initializing DoodleNet...');
            try {
                // Pinning to 'DoodleNet' (case-sensitive in some versions)
                const clf = window.ml5.imageClassifier('DoodleNet', () => {
                    console.log('ML5: SUCCESS - DoodleNet Active');
                    setClassifier(clf);
                    setModelLoaded(true);
                    setStatusMessage('');
                });
            } catch (err) {
                console.error('ML5: Initialization failed:', err);
                setStatusMessage('AI failed to load. Check console.');
            }
        }
    }, []);

    const triggerRoast = (wrongLabel) => {
        if (roastTimer > 0) return; // Already roasting

        setRoastMessage(`It looks like a ${wrongLabel}! Eww.`);
        setRoastTimer(3); // 3 seconds of leak

        // Start leak
        const leakInterval = setInterval(() => {
            setInkUsed(prev => prev + 10); // Leak 10 ink per tick
            setRoastTimer(prev => {
                if (prev <= 0.1) {
                    clearInterval(leakInterval);
                    setRoastMessage(null);
                    return 0;
                }
                return prev - 0.1;
            });
        }, 100);
    };

    // Classification Logic
    const runClassification = useCallback(() => {
        if (!classifier || !canvasRef.current) return;

        const currentStatus = statusRef.current;
        const isSbox = isSandboxRef.current;
        const tWord = targetWordRef.current;

        if (currentStatus !== 'playing' && !isSbox) return;

        // --- AUTO-CROP & INVERSION LOGIC ---
        const mainCanvas = canvasRef.current;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = 400;
        tempCanvas.height = 400;

        const mainCtx = mainCanvas.getContext('2d');
        const imgData = mainCtx.getImageData(0, 0, 400, 400);
        const data = imgData.data;

        let minX = 400, minY = 400, maxX = 0, maxY = 0;
        let found = false;
        for (let y = 0; y < 400; y++) {
            for (let x = 0; x < 400; x++) {
                const idx = (y * 400 + x) * 4;
                if (data[idx] > 50) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        let inputForAI = mainCanvas;
        if (found) {
            const padding = 40;
            const width = maxX - minX + padding * 2;
            const height = maxY - minY + padding * 2;
            const size = Math.max(width, height);

            tempCanvas.width = size;
            tempCanvas.height = size;
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, size, size);

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = width;
            cropCanvas.height = height;
            const cropCtx = cropCanvas.getContext('2d');

            cropCtx.drawImage(mainCanvas, minX - padding, minY - padding, width, height, 0, 0, width, height);

            const cropData = cropCtx.getImageData(0, 0, width, height);
            const d = cropData.data;
            for (let i = 0; i < d.length; i += 4) {
                const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
                if (avg < 50) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; }
                else { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
            }
            cropCtx.putImageData(cropData, 0, 0);
            tempCtx.drawImage(cropCanvas, (size - width) / 2, (size - height) / 2);
            inputForAI = tempCanvas;
        }

        if (inputForAI instanceof HTMLCanvasElement) {
            setDebugPreview(inputForAI.toDataURL());
        }

        setStatusMessage('AI is thinking...');
        classifier.classify(inputForAI, (err, results) => {
            setStatusMessage('');
            if (err) return console.error(err);

            if (results && results.length > 0) {
                console.log("AI Thinking:", results.slice(0, 3).map(r => `${r.label} (${Math.round(r.confidence * 100)}%)`).join(' | '));
                setPredictions(results);

                if (!isSbox && currentStatus === 'playing') {
                    const topResult = results[0];
                    const normalizedLabel = topResult.label.toLowerCase().replace(/[\s_-]/g, '');
                    const normalizedTarget = tWord?.toLowerCase().replace(/[\s_-]/g, '');

                    if (normalizedLabel.includes(normalizedTarget) && topResult.confidence > 0.85) {
                        if (!myPlayerRef.current.finished) {
                            onSubmitScore(inkUsedRef.current);
                        }
                    } else if (topResult.confidence > 0.5 && !normalizedLabel.includes(normalizedTarget)) {
                        triggerRoast(topResult.label);
                    }
                }
            }
        });
    }, [classifier, onSubmitScore, triggerRoast, setPredictions, setDebugPreview, setStatusMessage]);

    // Cleanup effect (no loop anymore)
    useEffect(() => {
        if (classifier) {
            console.log("AI ready for triggers.");
        }
    }, [classifier]);

    const handleSuccess = useCallback(() => {
        if (status !== 'playing') return;
        // Stop classification? Or just submit.
        // We only submit once.
        if (!myPlayer.finished) {
            onSubmitScore(inkUsed);
        }
    }, [inkUsed, status, myPlayer.finished, onSubmitScore]);

    // Canvas Draw Handlers
    const startDrawing = (e) => {
        if (status !== 'playing' || myPlayer.finished) return;
        if (e.cancelable) e.preventDefault(); // Prevent scroll on touch

        const { offsetX, offsetY } = getCoordinates(e);
        setLastPos({ x: offsetX, y: offsetY });
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || status !== 'playing' || myPlayer.finished) return;
        if (e.cancelable) e.preventDefault(); // Prevent scroll on touch

        const ctx = canvasRef.current.getContext('2d');
        const { offsetX, offsetY } = getCoordinates(e);

        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(offsetX, offsetY);
        ctx.strokeStyle = 'white'; // Inverted for DoodleNet
        ctx.lineWidth = 14; // Even thicker for DoodleNet
        ctx.lineCap = 'round';
        ctx.stroke();

        // Calculate distance for Ink usage approximation (or count pixels later)
        // Prompt says "Count of non-white pixels".
        // Counting pixels every frame is expensive (getImageData).
        // Let's approximate with distance first, or just do it periodically?
        // Actually, prompt: "Every pixel drawn consumes Ink".
        // Distance is a good proxy for pixels drawn.
        const dist = Math.sqrt(Math.pow(offsetX - lastPos.x, 2) + Math.pow(offsetY - lastPos.y, 2));
        setInkUsed(prev => prev + Math.ceil(dist));

        setLastPos({ x: offsetX, y: offsetY });
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            runClassification();
        }
    };

    const clearCanvas = () => {
        if (status !== 'playing') return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = 'black'; // Inverted for DoodleNet
        ctx.fillRect(0, 0, 400, 400);
        setInkUsed(0);
    };

    const getCoordinates = (e) => {
        if (e.touches && e.touches[0]) {
            const rect = canvasRef.current.getBoundingClientRect();
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }
        return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
    };

    // Initialize canvas with black background (crucial for DoodleNet/QuickDraw)
    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 400, 400);
        }
    }, [round]); // Reset on new round

    return (
        <div className="game-container" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'white',
            height: '100vh',
            overflowY: 'auto', // Scrollable
            padding: '20px'
        }}>
            <div className="game-header">
                {isSandbox ? (
                    <>
                        <h2>Sandbox Mode</h2>
                        <h1>Draw Anything! <span style={{ color: '#aaa', fontSize: '1rem' }}>(AI is watching)</span></h1>
                    </>
                ) : (
                    <>
                        <h2>Round {round} / {totalRounds}</h2>
                        {status === 'playing' ? (
                            <h1>Draw: <span style={{ color: '#facc15' }}>{targetWord}</span></h1>
                        ) : (
                            <h1>Round Over!</h1>
                        )}
                    </>
                )}
            </div>

            {/* Main Game Area */}
            <div className="game-layout" style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(400px, 1fr) 300px',
                gap: '30px',
                marginTop: '30px',
                width: '100%',
                maxWidth: '850px',
                padding: '0 20px'
            }}>
                <div className="canvas-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="canvas-container" style={{
                        position: 'relative',
                        boxShadow: '0 0 30px rgba(0,0,0,0.5)',
                        borderRadius: '12px',
                        padding: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={400}
                            style={{
                                background: 'black',
                                borderRadius: '8px',
                                cursor: 'crosshair',
                                border: '2px solid #555',
                                touchAction: 'none' // CRITICAL for mobile drawing
                            }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        {roastMessage && (
                            <div style={{
                                position: 'absolute',
                                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                background: 'rgba(255, 0, 0, 0.8)', padding: '10px', borderRadius: '5px',
                                fontWeight: 'bold', pointerEvents: 'none'
                            }}>
                                {roastMessage} <br /> Ink Leaking!
                            </div>
                        )}
                    </div>
                    <button className="btn btn-secondary" style={{ marginTop: '15px', width: '100%' }} onClick={clearCanvas}>
                        🗑️ Clear Canvas
                    </button>
                </div>

                <div className="sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="panel panel-glow ai-vision-panel" style={{
                        padding: '25px',
                        background: 'rgba(15, 23, 42, 1)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                        minHeight: '220px',
                        width: '100%'
                    }}>
                        <h3 style={{ marginBottom: '15px', color: '#facc15', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
                            🤖 AI Vision
                        </h3>

                        {!modelLoaded ? (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                <div className="spinner" style={{
                                    width: '30px', height: '30px',
                                    border: '4px solid #333', borderTopColor: '#facc15',
                                    borderRadius: '50%', animation: 'spin 1s linear infinite',
                                    margin: '0 auto 10px'
                                }} />
                                <p>{statusMessage || 'Loading AI...'}</p>
                            </div>
                        ) : predictions.length === 0 ? (
                            <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                                <div style={{ fontSize: '10px', color: '#444', marginBottom: '10px' }}>
                                    Active Model: {classifier?.modelName || 'DoodleNet'}
                                </div>
                                Waiting for drawing...
                            </div>
                        ) : (
                            <>
                                <div style={{ fontSize: '10px', color: '#444', marginBottom: '10px', textAlign: 'right' }}>
                                    Model: {classifier?.modelName || 'DoodleNet'}
                                </div>
                                {predictions.slice(0, 3).map((p, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '12px',
                                        fontSize: i === 0 ? '1.1rem' : '0.9rem',
                                        fontWeight: i === 0 ? 'bold' : 'normal',
                                        color: i === 0 ? '#4ade80' : 'white'
                                    }}>
                                        <span>{p.label.split(',')[0]}</span>
                                        <span>{Math.round(p.confidence * 100)}%</span>
                                    </div>
                                ))}

                                <div style={{ marginTop: 'auto', paddingTop: '15px' }}>
                                    <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${Math.min(predictions[0]?.confidence * 100 || 0, 100)}%`,
                                            height: '100%',
                                            background: predictions[0]?.confidence > 0.85 ? '#4ade80' : '#3b82f6',
                                            boxShadow: predictions[0]?.confidence > 0.85 ? '0 0 10px #4ade80' : 'none',
                                            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                                        <small style={{ color: '#888' }}>Confidence</small>
                                        <small style={{ color: predictions[0]?.confidence > 0.85 ? '#4ade80' : '#888' }}>Target: 85%</small>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* AI Debug Togle */}
                        <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                            <div
                                style={{
                                    color: '#3b82f6',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    textDecoration: 'underline'
                                }}
                                onClick={() => setShowDebug(!showDebug)}
                            >
                                👁️ {showDebug ? 'Hide AI Vision' : 'Show AI Vision'}
                            </div>

                            {showDebug && debugPreview && (
                                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>What the AI sees:</div>
                                    <img
                                        src={debugPreview}
                                        alt="AI Vision"
                                        style={{
                                            width: '100px',
                                            height: '100px',
                                            border: '1px solid #555',
                                            background: 'white',
                                            imageRendering: 'pixelated'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {!isSandbox && (
                        <div className="panel panel-glow" style={{ padding: '15px', marginTop: '15px', borderColor: roastMessage ? 'red' : undefined }}>
                            <h3>Ink Tank</h3>
                            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{Math.round(inkUsed)} px</p>
                            <div style={{ height: '20px', background: '#333', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{
                                    width: '100%',
                                    backgroundColor: inkUsed < 1000 ? '#4ade80' : inkUsed < 3000 ? '#facc15' : '#ef4444',
                                    height: '100%'
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isSandbox && (
                <div className="leaderboard" style={{ marginTop: '20px', width: '100%', maxWidth: '800px' }}>
                    <h3>Players</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {players.map(p => (
                            <div key={p.id} className="player-card panel" style={{
                                padding: '10px',
                                borderColor: p.finished ? '#4ade80' : '#444',
                                opacity: p.connected ? 1 : 0.5
                            }}>
                                <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                                <div>{p.finished ? (status === 'roundOver' || status === 'gameEnded' ? `${p.inkUsed} ink` : 'Finished!') : 'Drawing...'}</div>
                                <div style={{ fontSize: '12px' }}>Score: {p.score}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button className="btn btn-secondary" style={{ position: 'fixed', bottom: '20px', left: '20px' }} onClick={onLeave}>
                Exit Game
            </button>
        </div>
    );
}

