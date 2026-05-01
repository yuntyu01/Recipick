/**
 * MediaPipe Hand Landmarker 제스처 인식 WebView HTML (단일 소스)
 *
 * cook.tsx의 WebView에서 source={{ html: gestureHtml }} 방식으로 로드합니다.
 * react-native-webview는 "13.15.0"으로 package.json에 이미 포함되어 있습니다.
 *
 * 감지 제스처:
 *   PALM       → 손바닥 (모든 손가락 펼침)
 *   SWIPE_LEFT → 왼쪽 스와이프
 *   SWIPE_RIGHT → 오른쪽 스와이프
 *   OK         → 엄지+검지 붙이기
 *
 * 스와이프 방향: 전면 카메라는 데이터 레벨에서 좌우 반전되어 있으므로
 *   dx > 0 (데이터 기준 오른쪽 이동) = 실제 왼쪽 이동 = SWIPE_LEFT (이전 단계)
 *   dx < 0 (데이터 기준 왼쪽 이동)  = 실제 오른쪽 이동 = SWIPE_RIGHT (다음 단계)
 */
export const gestureHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
        video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: scaleX(-1);
        }
        #status {
        position: absolute;
        bottom: 0;
        width: 100%;
        text-align: center;
        color: #fff;
        font-size: 9px;
        font-family: sans-serif;
        background: rgba(0,0,0,0.55);
        padding: 2px 0;
        letter-spacing: 0.3px;
        }
        #gesture-flash {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 28px;
        opacity: 0;
        transition: opacity 0.1s;
        pointer-events: none;
        }
        #gesture-flash.show { opacity: 1; }
    </style>
    </head>
    <body>
    <video id="video" autoplay playsinline muted></video>
    <div id="gesture-flash"></div>
    <div id="status">초기화 중...</div>

    <script>
    (function () {
        var WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
        var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        var video = document.getElementById('video');
        var statusEl = document.getElementById('status');
        var flashEl = document.getElementById('gesture-flash');

        var handLandmarker = null;
        var lastVideoTime = -1;
        var frameCount = 0;

        // Cooldowns (in detection-loop ticks)
        var COOLDOWN_TICKS = 30;
        var swipeCooldown = 0;
        var palmCooldown = 0;
        var okCooldown = 0;

        // Swipe tracking
        var wristHistory = [];
        var SWIPE_THRESHOLD = 0.10;
        var SWIPE_HISTORY_LEN = 6;

        function setStatus(msg) { statusEl.textContent = msg; }

        function showFlash(emoji) {
        flashEl.textContent = emoji;
        flashEl.classList.add('show');
        setTimeout(function () { flashEl.classList.remove('show'); }, 500);
        }

        function sendGesture(gesture) {
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(gesture);
        }
        }

        function isFingerExtended(lm, tipIdx, mcpIdx) {
        return lm[tipIdx].y < lm[mcpIdx].y;
        }

        function classifyStaticGesture(lm) {
        var indexExt  = isFingerExtended(lm, 8,  5);
        var middleExt = isFingerExtended(lm, 12, 9);
        var ringExt   = isFingerExtended(lm, 16, 13);
        var pinkyExt  = isFingerExtended(lm, 20, 17);

        // PALM: all four fingers extended
        if (indexExt && middleExt && ringExt && pinkyExt) return 'PALM';

        // OK: thumb tip close to index tip, other three extended
        var dist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        if (dist < 0.07 && middleExt && ringExt && pinkyExt) return 'OK';

        return null;
        }

        function detectSwipe(currentX) {
        wristHistory.push(currentX);
        if (wristHistory.length > SWIPE_HISTORY_LEN) wristHistory.shift();
        if (wristHistory.length < 3) return null;
        var dx = wristHistory[wristHistory.length - 1] - wristHistory[0];
        if (dx > SWIPE_THRESHOLD)  return 'SWIPE_LEFT';
        if (dx < -SWIPE_THRESHOLD) return 'SWIPE_RIGHT';
        return null;
        }

        function detectionLoop() {
        if (!handLandmarker || video.readyState < 2) {
            requestAnimationFrame(detectionLoop);
            return;
        }

        frameCount++;
        if (frameCount % 3 !== 0) {
            requestAnimationFrame(detectionLoop);
            return;
        }

        if (video.currentTime === lastVideoTime) {
            requestAnimationFrame(detectionLoop);
            return;
        }
        lastVideoTime = video.currentTime;

        var results;
        try {
            results = handLandmarker.detectForVideo(video, performance.now());
        } catch (e) {
            requestAnimationFrame(detectionLoop);
            return;
        }

        if (swipeCooldown > 0) swipeCooldown--;
        if (palmCooldown  > 0) palmCooldown--;
        if (okCooldown    > 0) okCooldown--;

        if (results && results.landmarks && results.landmarks.length > 0) {
            var lm = results.landmarks[0];
            var wristX = lm[0].x;

            // Swipe
            if (swipeCooldown === 0) {
            var swipe = detectSwipe(wristX);
            if (swipe) {
                sendGesture(swipe);
                showFlash(swipe === 'SWIPE_LEFT' ? '🫲' : '🫱');
                swipeCooldown = COOLDOWN_TICKS;
                wristHistory = [];
            }
            } else {
            wristHistory = [];
            }

            // Static gestures
            var gesture = classifyStaticGesture(lm);
            if (gesture === 'PALM' && palmCooldown === 0) {
            sendGesture('PALM');
            showFlash('✋');
            palmCooldown = COOLDOWN_TICKS * 2;
            } else if (gesture === 'OK' && okCooldown === 0) {
            sendGesture('OK');
            showFlash('👌');
            okCooldown = COOLDOWN_TICKS * 2;
            }
        } else {
            wristHistory = [];
        }

        requestAnimationFrame(detectionLoop);
        }

        async function startCamera() {
        try {
            var stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false,
            });
            video.srcObject = stream;
            video.addEventListener('loadeddata', function () {
            setStatus('손 인식 중...');
            detectionLoop();
            });
        } catch (e) {
            setStatus('카메라 오류: ' + e.message);
        }
        }

        async function init() {
        setStatus('MediaPipe 로딩 중...');
        try {
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.js';
            script.onload = async function () {
            try {
                var vision = window.vision || window['@mediapipe/tasks-vision'];
                if (!vision) {
                setStatus('vision 모듈 로드 실패');
                return;
                }
                var FilesetResolver = vision.FilesetResolver;
                var HandLandmarker = vision.HandLandmarker;

                var filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN);
                handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: MODEL_URL,
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
                });
                setStatus('카메라 시작 중...');
                await startCamera();
            } catch (e) {
                setStatus('초기화 오류: ' + e.message);
            }
            };
            script.onerror = function () { setStatus('스크립트 로드 실패'); };
            document.head.appendChild(script);
        } catch (e) {
            setStatus('오류: ' + e.message);
        }
        }

        init();
    })();
    </script>
</body>
</html>`;
