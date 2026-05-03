import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    PermissionsAndroid,
    Dimensions,
    Linking,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TextStyle,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import VoiceSearch from '../components/VoiceSearch';
import YoutubePlayer from "react-native-youtube-iframe";
import { gestureHtml } from '../lib/gestureHtml';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND = '#54CDA4';
const BG = '#F3F6F6';
const WHITE = '#FFFFFF';
const TEXT = '#3B4F4E';
const MUTED = '#8A9B9A';
const DANGER = '#FF6B6B';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Step = {
    id: string;
    title: string;
    body: string;
    startSec: number;
    timerSec?: number;
};

type Ingredient = {
    id: string;
    name: string;
    amount: string;
};

type RawStep = {
    step?: number;
    desc?: string;
    video_timestamp?: string;
    timer_sec?: number | string;
};

type RawIngredient = {
    name?: unknown;
    amount?: unknown;
};

type YoutubePlayerRef = {
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

function firstString(v: string | string[] | undefined) {
    if (!v) return '';
    return Array.isArray(v) ? (v[0] ?? '') : v;
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function formatMMSS(sec: number) {
    const safe = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${pad2(m)}:${pad2(s)}`;
}

function timestampToSec(ts?: string) {
    if (!ts) return 0;

    const parts = String(ts)
        .split(':')
        .map((v) => Number(v));

    if (parts.some((v) => Number.isNaN(v))) return 0;

    if (parts.length === 2) {
        const [m, s] = parts;
        return m * 60 + s;
    }

    if (parts.length === 3) {
        const [h, m, s] = parts;
        return h * 3600 + m * 60 + s;
    }

    return 0;
}

export default function CookScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();



    const videoId = firstString(params.video_id);
    const url = firstString(params.url) || firstString(params.link);
    const recipeDataParam = firstString(params.recipe_data);

    const recipeData = useMemo(() => {
        try {
            return recipeDataParam ? JSON.parse(recipeDataParam) : null;
        } catch (e) {
            console.log('[COOK] recipe_data parse error:', e);
            return null;
        }
    }, [recipeDataParam]);


    const steps: Step[] = useMemo(() => {
        if (!recipeData?.steps || !Array.isArray(recipeData.steps)) return [];

        return recipeData.steps.map((item: RawStep, index: number) => ({
            id: `s${item.step ?? index + 1}`,
            title: `STEP ${item.step ?? index + 1}`,
            body: item.desc ?? '',
            startSec: timestampToSec(item.video_timestamp),
            timerSec: Number(item.timer_sec ?? 0),
        }));
    }, [recipeData]);

    const ingredients: Ingredient[] = useMemo(() => {
        if (!recipeData?.ingredients || !Array.isArray(recipeData.ingredients)) return [];
        return recipeData.ingredients.map((item: RawIngredient, index: number) => ({
            id: item?.name ? `${item.name}-${index}` : `ingredient-${index}`,
            name: String(item?.name ?? '재료').trim(),
            amount: String(item?.amount ?? '').trim(),
        }));
    }, [recipeData]);

    const stepIngredients = useMemo(() => {
        if (!steps.length || !ingredients.length) return {};
        const map: Record<number, Ingredient[]> = {};
        steps.forEach((s, idx) => {
            const body = s.body.toLowerCase();
            const matched = ingredients.filter(ing => body.includes(ing.name.toLowerCase()));
            if (matched.length > 0) map[idx] = matched;
        });
        return map;
    }, [steps, ingredients]);

    const [activeIdx, setActiveIdx] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const stepYPositions = useRef<number[]>([]);
    const stepsAreaY = useRef(0);
    const webRef = useRef<WebView>(null);

    const [fabOpen, setFabOpen] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [testGesture, setTestGesture] = useState('');
    const [guideDontShow, setGuideDontShow] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('cook_guide_hidden').then((val) => {
            if (val !== 'true') setGuideOpen(true);
        });
    }, []);

    const closeGuide = () => {
        setGuideOpen(false);
        setTestGesture('');
    };
    const [timerOpen, setTimerOpen] = useState(false);
    const [voiceOpen, setVoiceOpen] = useState(false);
    const [alarmOpen, setAlarmOpen] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [remainingSec, setRemainingSec] = useState(0);
    const [manualTimerSec, setManualTimerSec] = useState<number | null>(null);

    const [timerMinInput, setTimerMinInput] = useState('');
    const [timerSecInput, setTimerSecInput] = useState('');

    const [voiceStatusText, setVoiceStatusText] = useState('듣고 있는 중...');
    const [videoError, setVideoError] = useState(false);

    const alarmSoundRef = useRef<Audio.Sound | null>(null);
    const timerFinishedHandledRef = useRef(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const playerRef = useRef<YoutubePlayerRef | null>(null);
    useEffect(() => {
        console.log('[isPlaying]', isPlaying);
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);
    const youtubeWebViewRef = useRef<any>(null);

    // handleGestureMessage 수정
    const handleGestureMessage = (gesture: string) => {
        if (gesture === 'PALM') {
            gestureRef.current = true;
            const playing = isPlayingRef.current;
            if (playing) {
                youtubeWebViewRef.current?.injectJavaScript('player.pauseVideo(); true;');
                setIsPlaying(false);
            } else {
                youtubeWebViewRef.current?.injectJavaScript('player.playVideo(); true;');
                setIsPlaying(true);
            }
            setTimeout(() => { gestureRef.current = false; }, 1000);
        }
        else if (gesture === 'SWIPE_LEFT') jumpToStep(activeIdx - 1);
        else if (gesture === 'SWIPE_RIGHT') jumpToStep(activeIdx + 1);
        else if (gesture === 'OK') setTimerOpen(true);
    };
    useEffect(() => {
        console.log('[COOK PARAMS]', params);
    }, [params]);

    const seekTo = (sec: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(Math.max(0, Math.floor(sec)), true);
        }
    };

    // 상단에 ref 추가
    const gestureRef = useRef(false); 
    const isPlayingRef = useRef(isPlaying);
    
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);
    const playVideo = () => {
    //playerRef.current?.playVideo();
        setIsPlaying(true);
    };

    const pauseVideo = () => {
    //playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
    };

    const jumpToStep = (idx: number) => {
        if (steps.length === 0) return;

        const next = Math.max(0, Math.min(steps.length - 1, idx));
        const targetStep = steps[next];

        setActiveIdx(next);
        seekTo(targetStep.startSec);

        if (scrollRef.current && stepYPositions.current[next] != null) {
            scrollRef.current.scrollTo({ y: Math.max(0, stepsAreaY.current + stepYPositions.current[next] - SCREEN_H + 315), animated: true });
        }

        if ((targetStep.timerSec ?? 0) > 0) {
            setManualTimerSec(targetStep.timerSec ?? 0);
            setRemainingSec(targetStep.timerSec ?? 0);
            timerFinishedHandledRef.current = false;
            setAlarmOpen(false);
            Vibration.cancel();
        }
    };

    const stopAlarmSound = async () => {
        try {
            if (alarmSoundRef.current) {
                await alarmSoundRef.current.stopAsync().catch(() => { });
                await alarmSoundRef.current.unloadAsync().catch(() => { });
                alarmSoundRef.current = null;
            }
        } catch (e) {
            console.log('stop alarm error', e);
        }
    };

    const playAlarmSound = async () => {
        try {
            if (alarmSoundRef.current) {
                await alarmSoundRef.current.stopAsync().catch(() => { });
                await alarmSoundRef.current.unloadAsync().catch(() => { });
                alarmSoundRef.current = null;
            }

            const { sound } = await Audio.Sound.createAsync(
                require('../assets/sounds/timer-alarm.wav'),
                {
                    shouldPlay: false,
                    volume: 1.0,
                    isMuted: false,
                    isLooping: true,
                }
            );

            alarmSoundRef.current = sound;
            await sound.setVolumeAsync(1.0);
            await sound.setIsLoopingAsync(true);
            await sound.playAsync();
        } catch (e) {
            console.log('alarm sound error', e);
        }
    };

    const stopAlarm = async () => {
        await stopAlarmSound();
        Vibration.cancel();
        setAlarmOpen(false);
        setIsPlaying(false);
        setManualTimerSec(null);
        setRemainingSec(0);
        timerFinishedHandledRef.current = false;
    };

    const openVoiceModal = () => {
        setVoiceOpen(true);
        setVoiceStatusText('듣고 있는 중...');
    };

    const closeVoiceModal = () => {
        setVoiceOpen(false);
    };

    const openYoutubeExternally = async () => {
        const targetUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
        if (!targetUrl) return;

        try {
            await Linking.openURL(targetUrl);
        } catch (e) {
            console.log('[OPEN YOUTUBE ERROR]', e);
        }
    };

    useEffect(() => {
        if (Platform.OS === 'android') {
            PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                    title: '카메라 권한 요청',
                    message: '손 제스처 인식을 위해 카메라 권한이 필요해요.',
                    buttonPositive: '허용',
                    buttonNegative: '거부',
                }
            );
        }
    }, []);
    useEffect(() => {
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
        }).catch((e) => console.log('audio mode error', e));

        return () => {
            if (alarmSoundRef.current) {
                alarmSoundRef.current.unloadAsync().catch(() => { });
                alarmSoundRef.current = null;
            }
            Vibration.cancel();
        };
    }, []);

    useEffect(() => {
        if (!voiceOpen) {
            pulseAnim.stopAnimation();
            fadeAnim.stopAnimation();
            pulseAnim.setValue(1);
            fadeAnim.setValue(0);
            return;
        }

        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
        }).start();

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.12,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();

        const statusTimer1 = setTimeout(() => {
            setVoiceStatusText('말씀을 기다리고 있어요...');
        }, 1800);

        const statusTimer2 = setTimeout(() => {
            setVoiceStatusText('듣고 있는 중...');
        }, 3600);

        return () => {
            loop.stop();
            clearTimeout(statusTimer1);
            clearTimeout(statusTimer2);
            pulseAnim.setValue(1);
        };
    }, [voiceOpen, pulseAnim, fadeAnim]);

    const applyTimer = (sec: number) => {
        const v = Math.max(0, Math.floor(sec));
        setManualTimerSec(v);
        setRemainingSec(v);
        setTimerOpen(false);
        setTimerMinInput('');
        setTimerSecInput('');
        timerFinishedHandledRef.current = false;
        setAlarmOpen(false);
        Vibration.cancel();
    };

    const applyCustomTimer = () => {
        const mins = Number(timerMinInput || '0');
        const secs = Number(timerSecInput || '0');

        if (!Number.isFinite(mins) || !Number.isFinite(secs)) return;

        const total = Math.max(0, mins * 60 + secs);
        if (total <= 0) return;

        setManualTimerSec(total);
        setRemainingSec(total);
        setTimerOpen(false);
        setTimerMinInput('');
        setTimerSecInput('');
        timerFinishedHandledRef.current = false;
        setAlarmOpen(false);
        Vibration.cancel();
    };

    const clearTimer = () => {
        setManualTimerSec(null);
        setRemainingSec(0);
        setTimerMinInput('');
        setTimerSecInput('');
        timerFinishedHandledRef.current = false;
        setAlarmOpen(false);
        Vibration.cancel();
        stopAlarmSound();
    };

    useEffect(() => {
        if (remainingSec > 0) {
            timerFinishedHandledRef.current = false;
        }
    }, [remainingSec]);

    useEffect(() => {
        if (remainingSec <= 0) return;
        if (alarmOpen) return;

        const id = setInterval(() => {
            setRemainingSec((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(id);
    }, [remainingSec, alarmOpen]);

    useEffect(() => {
        if (!isPlaying) return;
        if (remainingSec !== 0) return;
        if (!manualTimerSec || manualTimerSec <= 0) return;
        if (timerFinishedHandledRef.current) return;

        timerFinishedHandledRef.current = true;

        setIsPlaying(false);
        pauseVideo();
        setAlarmOpen(true);

        Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
        playAlarmSound();
    }, [remainingSec, isPlaying, manualTimerSec]);

    const togglePlay = () => {
        if (alarmOpen || videoError) return;
        gestureRef.current = true;
        setIsPlaying(prev => !prev);
        setTimeout(() => { gestureRef.current = false; }, 1000);
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, g) => {
                    const ax = Math.abs(g.dx);
                    const ay = Math.abs(g.dy);
                    return ax > 12 && ax > ay * 1.3;
                },
                onPanResponderRelease: (_, g) => {
                    const threshold = 60;
                    if (g.dx <= -threshold) jumpToStep(activeIdx - 1);
                    if (g.dx >= threshold) jumpToStep(activeIdx + 1);
                },
            }),
        [activeIdx, steps]
    );


    const VIDEO_W = SCREEN_W;
    const VIDEO_H = Math.round((VIDEO_W * 9) / 16);

    return (
        <SafeAreaView style={styles.safe} edges={['left', 'right']}>
            <View style={[styles.fixedVideo, { paddingTop: insets.top }]}>
                <View style={[styles.videoWrap, { width: VIDEO_W, height: VIDEO_H }]}>
                    {videoId ? (
                        <>
                            <YoutubePlayer
                                ref={playerRef}
                                height={VIDEO_H}
                                play={isPlaying}
                                videoId={videoId}
                                // YoutubePlayer onChangeState 수정
                                onChangeState={(state: string) => {
                                    if (gestureRef.current) return;        // 제스처 중엔 무시
                                    if (state === "ended") setIsPlaying(false);
                                    if (state === "playing") setIsPlaying(true);   // ← 주석 해제
                                    if (state === "paused") setIsPlaying(false);
                                }}
                                webViewProps={{
                                    ref: youtubeWebViewRef, 
                                    androidLayerType: "hardware",
                                    allowsFullscreenVideo: true,
                                    userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
                                }}
                                onReady={() => setVideoError(false)}
                                onError={(e: string) => {
                                    console.log('[YOUTUBE ERROR]', e);
                                    setVideoError(true);
                                }}
                            />
                            {videoError && (
                                <View style={styles.videoErrorOverlay}>
                                    <Text style={styles.videoErrorTitle}>영상을 불러올 수 없어요</Text>
                                    <Text style={styles.videoErrorSub}>
                                        잠시 후 다시 시도하거나 유튜브에서 직접 열어보세요.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.videoErrorBtn}
                                        onPress={openYoutubeExternally}
                                        activeOpacity={0.9}
                                    >
                                        <Text style={styles.videoErrorBtnText}>유튜브에서 열기</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={styles.videoFallback}>
                            <Text style={{ color: MUTED, fontWeight: '800' }}>
                                video_id가 없어서 영상을 띄울 수 없어요
                            </Text>
                            {!!url && (
                                <Text style={{ color: MUTED, marginTop: 6, fontSize: 12 }} numberOfLines={1}>
                                    {url}
                                </Text>
                            )}
                        </View>
                    )}
                    <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={styles.videoBackBtn}>
                        <Ionicons name="arrow-back" size={22} color={WHITE} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.progressFixed, { top: VIDEO_H + insets.top }]}>
                <View style={styles.progressRow}>
                    {steps.length > 0 ? (
                        steps.map((_, i) => {
                            const active = i === activeIdx;
                            return (
                                <TouchableOpacity
                                    key={steps[i].id}
                                    activeOpacity={0.85}
                                    onPress={() => jumpToStep(i)}
                                    style={[styles.progressSeg, active && styles.progressSegActive]}
                                />
                            );
                        })
                    ) : (
                        <View style={styles.progressSeg} />
                    )}
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                style={{ flex: 1, backgroundColor: BG }}
                contentContainerStyle={{ paddingTop: VIDEO_H + insets.top + 30, paddingBottom: 150 }}
                showsVerticalScrollIndicator={false}
            >

                <View style={styles.stepsArea} {...panResponder.panHandlers} onLayout={(e) => { stepsAreaY.current = e.nativeEvent.layout.y; }}>
                    {steps.length > 0 ? (
                        steps.map((s, idx) => {
                            const active = idx === activeIdx;
                            const mt = idx === 0 ? 0 : 10;

                            return (
                                <TouchableOpacity
                                    key={s.id}
                                    activeOpacity={0.92}
                                    onPress={() => jumpToStep(idx)}
                                    style={{ marginTop: mt }}
                                    onLayout={(e) => {
                                        stepYPositions.current[idx] = e.nativeEvent.layout.y;
                                    }}
                                >
                                    <View style={[styles.stepCard, active && styles.stepCardActive]}>
                                        <View style={styles.stepTopRow}>
                                            <Text style={[styles.stepTitle, active && { color: BRAND }]}>{s.title}</Text>
                                            {(s.timerSec ?? 0) > 0 && (
                                                <Text style={styles.stepTimerBadge}>{formatMMSS(s.timerSec ?? 0)}</Text>
                                            )}
                                        </View>

                                        <Text style={styles.stepBody}>{s.body}</Text>

                                        {stepIngredients[idx] && stepIngredients[idx].length > 0 && (
                                            <View style={styles.stepIngRow}>
                                                {stepIngredients[idx].map((ing) => (
                                                    <View key={ing.id} style={styles.stepIngTag}>
                                                        <Text style={styles.stepIngName}>{ing.name}</Text>
                                                        {!!ing.amount && (
                                                            <Text style={styles.stepIngAmount}>{ing.amount}</Text>
                                                        )}
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyWrap}>
                            <Text style={styles.emptyText}>레시피 분석 결과가 아직 없어요.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={styles.gestureOverlay} pointerEvents="box-none">
                <WebView
                    style={StyleSheet.absoluteFill}
                    source={{ uri : 'https://curious-jalebi-61448d.netlify.app/gesture.html' }}
                    javaScriptEnabled={true}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    mediaCapturePermissionGrantType="grant"
                    originWhitelist={['*']}
                    onPermissionRequest={(request: any) => request.grant()}
                    domStorageEnabled={true}
                    allowFileAccess={true}
                    mixedContentMode="always"
                    onMessage={(event) => {console.log('[GESTURE 수신]', event.nativeEvent.data); // 임시 추가
                        handleGestureMessage(event.nativeEvent.data);
                    }}
                />
            </View>

            {fabOpen && (
                <View style={[styles.bottomTabBar, { paddingBottom: 5 }]}>
                    <TouchableOpacity activeOpacity={0.7} style={styles.bottomTabItem} onPress={() => { setFabOpen(false); openVoiceModal(); }}>
                        <Ionicons name="mic" size={24} color={MUTED} />
                        <Text style={styles.bottomTabLabel}>음성</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.bottomTabItem} onPress={() => { setFabOpen(false); setTimerOpen(true); }}>
                        {remainingSec > 0 ? (
                            <Text style={styles.bottomTabTimer}>{formatMMSS(remainingSec)}</Text>
                        ) : (
                            <Ionicons name="alarm" size={24} color={MUTED} />
                        )}
                        <Text style={styles.bottomTabLabel}>타이머</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.bottomTabItem} onPress={() => { setFabOpen(false); setGuideOpen(true); }}>
                        <Text style={{ color: MUTED, fontSize: 22, fontWeight: '900' }}>?</Text>
                        <Text style={styles.bottomTabLabel}>가이드</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={styles.bottomTabItem} onPress={() => setFabOpen(false)}>
                        <Ionicons name="close" size={28} color={MUTED} />
                        <Text style={styles.bottomTabLabel}>닫기</Text>
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.fabBtn, { bottom: 12, right: 110, display: fabOpen ? 'none' : 'flex' }]}
                onPress={() => setFabOpen(true)}
            >
                {remainingSec > 0 ? (
                    <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700' }}>{formatMMSS(remainingSec)}</Text>
                ) : (
                    <Ionicons name="ellipsis-horizontal" size={22} color={MUTED} />
                )}
            </TouchableOpacity>

            <Modal visible={guideOpen} transparent animationType="fade" onRequestClose={() => { closeGuide(); }}>
                <TouchableOpacity style={styles.modalBack} activeOpacity={1} onPress={() => { closeGuide(); }}>
                    <View style={styles.guideCard} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <Text style={styles.guideTitle}>사용 가이드</Text>
                            <TouchableOpacity onPress={() => { closeGuide(); }} hitSlop={14} style={{ padding: 2 }}>
                                <Ionicons name="close" size={22} color={MUTED} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.guideTestWrap}>
                            <View style={styles.guideTestCamera}>
                                <WebView
                                    style={StyleSheet.absoluteFill}
                                    source={{ uri: 'https://curious-jalebi-61448d.netlify.app/gesture.html' }}
                                    javaScriptEnabled={true}
                                    allowsInlineMediaPlayback={true}
                                    mediaPlaybackRequiresUserAction={false}
                                    mediaCapturePermissionGrantType="grant"
                                    onMessage={(event) => {
                                        const g = event.nativeEvent.data;
                                        const labels: Record<string, string> = {
                                            PALM: '✋ 멈춤',
                                            SWIPE_LEFT: '👈 이전',
                                            SWIPE_RIGHT: '👉 다음',
                                            OK: '👌 타이머',
                                        };
                                        setTestGesture(labels[g] || g);
                                        setTimeout(() => setTestGesture(''), 1500);
                                    }}
                                />
                            </View>
                            <View style={styles.guideTestResult}>
                                <Text style={styles.guideTestGesture}>{testGesture || '손동작을 해보세요'}</Text>
                                <View style={{ height: 10 }} />
                                <Text style={styles.guideItem}>✋  재생 / 일시정지</Text>
                                <Text style={styles.guideItem}>👈  이전 단계</Text>
                                <Text style={styles.guideItem}>👉  다음 단계</Text>
                                <Text style={styles.guideItem}>👌  타이머 열기</Text>
                            </View>
                        </View>

                        <View style={styles.guideDivider} />

                        <Text style={styles.guideSectionTitle}>화면 조작</Text>
                        <Text style={styles.guideItem}>카드를 터치하면 해당 단계로 이동</Text>
                        <Text style={styles.guideItem}>좌우 스와이프로 단계 전환</Text>
                        <Text style={styles.guideItem}>우측 하단 카메라로 제스처 인식</Text>

                        <View style={styles.guideDivider} />

                        <Text style={styles.guideSectionTitle}>음성 / 타이머</Text>
                        <Text style={styles.guideItem}>🎤  음성으로 요리 관련 질문</Text>
                        <Text style={styles.guideItem}>⏰  타이머 설정 시 자동 알림</Text>

                        <View style={{ height: 20 }} />

                        <View style={styles.guideButtonRow}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={styles.guideButtonGhost}
                                onPress={() => {
                                    AsyncStorage.setItem('cook_guide_hidden', 'true');
                                    closeGuide();
                                }}
                            >
                                <Text style={styles.guideButtonGhostText}>다시 안 보기</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={styles.guideButtonFill}
                                onPress={() => closeGuide()}
                            >
                                <Text style={styles.guideButtonFillText}>닫기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={timerOpen} transparent animationType="fade" onRequestClose={() => setTimerOpen(false)}>
                <View style={styles.modalBack}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>타이머 설정</Text>

                        <View style={styles.presetRow}>
                            <PresetBtn label="30초" onPress={() => applyTimer(30)} />
                            <PresetBtn label="1분" onPress={() => applyTimer(60)} />
                            <PresetBtn label="3분" onPress={() => applyTimer(180)} />
                            <PresetBtn label="5분" onPress={() => applyTimer(300)} />
                        </View>

                        <View style={{ height: 14 }} />

                        <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>현재 설정</Text>
                            <Text style={styles.modalValue}>{formatMMSS(remainingSec)}</Text>
                        </View>

                        <View style={{ height: 14 }} />

                        <Text style={styles.modalLabel}>직접 입력</Text>

                        <View style={styles.customTimerRow}>
                            <AnimatedTextInput
                                value={timerMinInput}
                                onChangeText={setTimerMinInput}
                                placeholder="분"
                                style={styles.customTimerInput}
                                maxLength={3}
                            />
                            <Text style={styles.customTimerUnit}>분</Text>

                            <AnimatedTextInput
                                value={timerSecInput}
                                onChangeText={setTimerSecInput}
                                placeholder="초"
                                style={styles.customTimerInput}
                                maxLength={2}
                            />
                            <Text style={styles.customTimerUnit}>초</Text>
                        </View>

                        <View style={{ height: 10 }} />

                        <TouchableOpacity
                            style={styles.customTimerApplyBtn}
                            onPress={applyCustomTimer}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.customTimerApplyText}>입력 시간 적용</Text>
                        </TouchableOpacity>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalBtnGhost} onPress={clearTimer} activeOpacity={0.9}>
                                <Text style={styles.modalBtnGhostText}>해제</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modalBtn} onPress={() => setTimerOpen(false)} activeOpacity={0.9}>
                                <Text style={styles.modalBtnText}>닫기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={voiceOpen} transparent animationType="fade" onRequestClose={closeVoiceModal}>
            <View style={styles.voiceBackdrop}>
                <Animated.View style={[styles.voiceCard, { opacity: fadeAnim }]}>
                <Text style={styles.voiceTitle}>말하세요</Text>
                <Text style={styles.voiceSub}>{voiceStatusText}</Text>

                <VoiceSearch 
                    videoId={videoId} 
                    currentStep={activeIdx} 
                />

                <TouchableOpacity style={styles.voiceCloseBtn} onPress={closeVoiceModal} activeOpacity={0.9}>
                    <Text style={styles.voiceCloseText}>닫기</Text>
                </TouchableOpacity>

                </Animated.View>
            </View>
            </Modal>

            <Modal visible={alarmOpen} transparent animationType="fade" onRequestClose={stopAlarm}>
                <View style={styles.alarmBackdrop}>
                    <View style={styles.alarmCard}>
                        <View style={styles.alarmIconWrap}>
                            <Ionicons name="alarm-outline" size={34} color="#fff" />
                        </View>

                        <Text style={styles.alarmTitle}>타이머가 끝났어요</Text>
                        <Text style={styles.alarmSub}>확인을 누르면 알람이 종료돼요.</Text>

                        <View style={styles.alarmTimeBox}>
                            <Text style={styles.alarmTimeText}>{formatMMSS(manualTimerSec ?? 0)}</Text>
                        </View>

                        <TouchableOpacity style={styles.alarmConfirmBtn} onPress={stopAlarm} activeOpacity={0.9}>
                            <Text style={styles.alarmConfirmText}>확인</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function PresetBtn({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.presetBtn}>
            <Text style={styles.presetText}>{label}</Text>
        </TouchableOpacity>
    );
}

function AnimatedTextInput({
    value,
    onChangeText,
    placeholder,
    style,
    maxLength,
}: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    style: StyleProp<TextStyle>;
    maxLength: number;
}) {
    return (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9AA0A6"
            keyboardType="number-pad"
            style={style}
            maxLength={maxLength}
        />
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },

    container: { flex: 1 },
    recipeHeader: {
        flexDirection: 'row', // 가로로 배치 (글자 옆에 카메라)
        justifyContent: 'space-between',
        padding: 15,
        alignItems: 'center',
        elevation: 2,
    },

    hintAndCameraRow: {
        flexDirection: 'row',        // 가로 배치
        alignItems: 'center',        // 세로 중앙 정렬
        justifyContent: 'space-between', 
        backgroundColor: WHITE,      // 박스 배경색
        marginHorizontal: 18,
        marginTop: 15,
        padding: 15,
        borderRadius: 20,
        elevation: 3,                // 그림자 효과
    },

    gestureOverlay: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 100,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: BRAND,
        zIndex: 200,
    },
    cameraPreviewContainer: {
        width: 80,  // 가로 크기
        height: 100, // 세로 크기
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: BRAND,
    },

    miniCamera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    cameraLabel: {
        position: 'absolute',
        bottom: 5,
        width: '100%',
        textAlign: 'center',
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 2,
    },

    fixedVideo: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#000',
    },
    videoBackBtn: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    controlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 14,
        paddingVertical: 8,
        gap: 10,
    },
    headerIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: WHITE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        height: 34,
        borderRadius: 17,
        backgroundColor: WHITE,
    },
    timerPillText: { fontWeight: '900', color: TEXT, fontSize: 12 },

    videoWrap: {
        backgroundColor: '#000',
        position: 'relative',
    },
    videoFallback: {
        flex: 1,
        backgroundColor: '#DDE6E6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    videoErrorOverlay: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(20, 20, 20, 0.82)',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    videoErrorTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    videoErrorSub: {
        marginTop: 6,
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
    },
    videoErrorBtn: {
        marginTop: 12,
        height: 40,
        borderRadius: 12,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoErrorBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '900',
    },

    progressFixed: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: BG,
        paddingHorizontal: 5,
        paddingTop: 8,
        paddingBottom: 8,
        zIndex: 100,
    },
    progressWrap: {
        backgroundColor: BG,
        paddingHorizontal: 5,
        paddingTop: 8,
        paddingBottom: 8,
    },
    progressRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 1,
    },
    progressSeg: {
        flex: 1,
        height: 8,
        borderRadius: 2,
        backgroundColor: '#CFE3E1',
    },
    progressSegActive: { backgroundColor: BRAND },

    hintBox: {
        flex: 1,
        marginRight: 10,
        backgroundColor: BG,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
    },
    hintTitle: { fontSize: 12, fontWeight: '900', color: TEXT, marginBottom: 6 },
    hintLine: { fontSize: 11, fontWeight: '800', color: TEXT, opacity: 0.8, marginTop: 2 },

    stepsArea: {
        backgroundColor: BG,
        paddingTop: 8,
        paddingBottom: 18,
    },

    stepCard: {
        marginHorizontal: 10,
        backgroundColor: WHITE,
        borderRadius: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#E2E8F0',
        paddingHorizontal: 18,
        paddingVertical: 16,
        minHeight: 169,
        justifyContent: 'space-between',
    },
    stepCardActive: {
        borderLeftColor: BRAND,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },

    stepTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: TEXT,
        marginBottom: 10,
        flex: 1,
    },
    stepBody: {
        fontSize: 15,
        fontWeight: '800',
        color: TEXT,
        lineHeight: 22,
        opacity: 0.92,
    },
    stepTimerBadge: {
        fontSize: 12,
        fontWeight: '900',
        color: BRAND,
        backgroundColor: '#E9F6F1',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },

    emptyWrap: {
        marginHorizontal: 18,
        backgroundColor: WHITE,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '700',
        color: MUTED,
        textAlign: 'center',
    },

    fabBtn: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E8EAED',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        zIndex: 301,
    },
    bottomTabBar: {
        position: 'absolute',
        left: 4,
        right: 110,
        bottom: 0,
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E8EAED',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 5,
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        zIndex: 300,
    },
    bottomTabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 2,
    },
    bottomTabItemCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        marginTop: -18,
        gap: 2,
    },
    bottomTabCenterIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    bottomTabLabel: {
        fontSize: 10,
        color: MUTED,
        fontWeight: '600',
    },
    bottomTabTimer: {
        fontSize: 14,
        fontWeight: '800',
        color: BRAND,
    },

    modalBack: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    guideCard: {
        width: '100%',
        backgroundColor: WHITE,
        borderRadius: 18,
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    guideTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: TEXT,
    },
    guideSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: BRAND,
        marginBottom: 6,
    },
    guideItem: {
        fontSize: 14,
        color: TEXT,
        lineHeight: 24,
        paddingLeft: 2,
    },
    guideDivider: {
        height: 1,
        backgroundColor: '#E8EAED',
        marginVertical: 14,
    },
    guideButtonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    guideButtonGhost: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    guideButtonGhostText: {
        fontSize: 14,
        fontWeight: '700',
        color: MUTED,
    },
    guideButtonFill: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
    },
    guideButtonFillText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    guideTestWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginTop: 8,
    },
    guideTestCamera: {
        width: 120,
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: BRAND,
    },
    guideTestResult: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    guideTestLabel: {
        fontSize: 12,
        color: MUTED,
        marginBottom: 6,
    },
    guideTestGesture: {
        fontSize: 18,
        fontWeight: '800',
        color: BRAND,
        textAlign: 'center',
    },
    modalCard: {
        width: '100%',
        backgroundColor: WHITE,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    modalTitle: { fontSize: 16, fontWeight: '900', color: TEXT },

    presetRow: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    presetBtn: {
        paddingHorizontal: 14,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E9F6F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetText: { fontSize: 12, fontWeight: '900', color: TEXT },

    modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalLabel: { fontSize: 12, fontWeight: '800', color: MUTED },
    modalValue: { fontSize: 14, fontWeight: '900', color: TEXT },

    customTimerRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    customTimerInput: {
        width: 72,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F2F4F4',
        paddingHorizontal: 12,
        fontSize: 14,
        fontWeight: '800',
        color: TEXT,
    },
    customTimerUnit: {
        fontSize: 13,
        fontWeight: '800',
        color: TEXT,
        marginRight: 8,
    },
    customTimerApplyBtn: {
        height: 42,
        borderRadius: 12,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
    },
    customTimerApplyText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 13,
    },

    modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    modalBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnText: { color: '#fff', fontWeight: '900' },
    modalBtnGhost: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F2F4F4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnGhostText: { color: TEXT, fontWeight: '900' },

    voiceBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.42)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    voiceCard: {
        width: '100%',
        backgroundColor: WHITE,
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 22,
        alignItems: 'center',
    },
    voiceTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: TEXT,
    },
    voiceSub: {
        marginTop: 8,
        fontSize: 15,
        fontWeight: '700',
        color: MUTED,
    },
    voicePulseWrap: {
        width: 150,
        height: 150,
        marginTop: 24,
        marginBottom: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voicePulseOuter: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#DDF4EC',
    },
    voiceMicCircle: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    voiceHint: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9AA8A7',
        marginBottom: 18,
    },
    voiceCloseBtn: {
        width: '100%',
        height: 52,
        borderRadius: 16,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceCloseText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '900',
    },

    alarmBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    alarmCard: {
        width: '100%',
        backgroundColor: WHITE,
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 24,
        alignItems: 'center',
    },
    alarmIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: DANGER,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alarmTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: TEXT,
    },
    alarmSub: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '700',
        color: MUTED,
        textAlign: 'center',
        lineHeight: 20,
    },
    alarmTimeBox: {
        marginTop: 18,
        minWidth: 140,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#FFF1F1',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    alarmTimeText: {
        fontSize: 24,
        fontWeight: '900',
        color: DANGER,
    },
    alarmConfirmBtn: {
        marginTop: 20,
        width: '100%',
        height: 50,
        borderRadius: 14,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
    },
    alarmConfirmText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 16,
    },

    stepIngRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 'auto',
        paddingTop: 10,
    },
    stepIngTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BG,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4,
    },
    stepIngName: {
        fontSize: 12,
        fontWeight: '800',
        color: MUTED,
    },
    stepIngAmount: {
        fontSize: 11,
        fontWeight: '700',
        color: MUTED,
    },
});