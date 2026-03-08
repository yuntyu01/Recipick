import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    PanResponder,
    Modal,
    Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';

const BRAND = '#54CDA4';
const BG = '#F3F6F6';
const WHITE = '#FFFFFF';
const TEXT = '#3B4F4E';
const MUTED = '#8A9B9A';
const DANGER = '#FF6B6B';

const { width: SCREEN_W } = Dimensions.get('window');

type Step = {
    id: string;
    title: string;
    body: string;
    startSec: number;
};

function firstString(v: string | string[] | undefined) {
    if (!v) return '';
    return Array.isArray(v) ? v[0] ?? '' : v;
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

export default function CookScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    const videoId = firstString(params.video_id);
    const url = firstString(params.url) || firstString(params.link);

    const steps: Step[] = useMemo(
        () => [
            {
                id: 's1',
                title: 'STEP 1',
                startSec: 0,
                body:
                    '대파는 송송 썰 필요 없이 길게 반을 갈라준 뒤, 5cm 정도 길이로 큼직하게 썰어 준비합니다. 이 요리는 파 맛으로 먹는 제육볶음이기 때문에, 대파는 넉넉하게 준비해 주세요.',
            },
            {
                id: 's2',
                title: 'STEP 2',
                startSec: 55,
                body: '청양고추는 매운맛을 살리기 위해 두껍게 어슷썰기로 큼직하게 썰어 준비합니다.',
            },
            {
                id: 's3',
                title: 'STEP 3',
                startSec: 115,
                body: '고기를 볶다가 양념을 넣고 센불로 빠르게 마무리합니다.',
            },
            {
                id: 's4',
                title: 'STEP 4',
                startSec: 175,
                body: '불을 줄여 한 번 더 볶아 양념이 잘 배도록 마무리합니다.',
            },
        ],
        []
    );

    const [activeIdx, setActiveIdx] = useState(0);
    const webRef = useRef<WebView>(null);

    const [timerOpen, setTimerOpen] = useState(false);
    const [voiceOpen, setVoiceOpen] = useState(false);
    const [alarmOpen, setAlarmOpen] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [remainingSec, setRemainingSec] = useState(0);
    const [manualTimerSec, setManualTimerSec] = useState<number | null>(null);

    const [timerMinInput, setTimerMinInput] = useState('');
    const [timerSecInput, setTimerSecInput] = useState('');

    const [voiceStatusText, setVoiceStatusText] = useState('듣고 있는 중...');

    const alarmSoundRef = useRef<Audio.Sound | null>(null);
    const timerFinishedHandledRef = useRef(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const seekTo = (sec: number) => {
        webRef.current?.postMessage(JSON.stringify({ type: 'SEEK', time: sec }));
    };

    const playVideo = () => {
        webRef.current?.postMessage(JSON.stringify({ type: 'PLAY' }));
    };

    const pauseVideo = () => {
        webRef.current?.postMessage(JSON.stringify({ type: 'PAUSE' }));
    };

    const jumpToStep = (idx: number) => {
        const next = Math.max(0, Math.min(steps.length - 1, idx));
        setActiveIdx(next);
        seekTo(steps[next].startSec);
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
                Animated.parallel([
                    Animated.timing(pulseAnim, {
                        toValue: 1.12,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ]),
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
        if (!isPlaying) return;
        if (remainingSec <= 0) return;
        if (alarmOpen) return;

        const id = setInterval(() => {
            setRemainingSec((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(id);
    }, [isPlaying, remainingSec, alarmOpen]);

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
        if (alarmOpen) return;

        setIsPlaying((prev) => {
            const next = !prev;
            if (next) playVideo();
            else pauseVideo();
            return next;
        });
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
        [activeIdx, steps.length]
    );

    const html = useMemo(() => {
        const id = videoId || '';
        const origin = 'https://localhost';

        return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
    <style>
      html, body { margin:0; padding:0; background:#000; height:100%; }
      #player { position:absolute; inset:0; }
    </style>
  </head>
  <body>
    <div id="player"></div>

<script>
  var tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  var player;

  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      videoId: '${id}',
      playerVars: {
        playsinline: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        origin: '${origin}'
      }
    });
  }

  function safeSeek(t) {
    try {
      if (!player) return;
      player.seekTo(t, true);
      player.playVideo();
    } catch (e) {}
  }

  function safePlay() {
    try { if (player) player.playVideo(); } catch (e) {}
  }

  function safePause() {
    try { if (player) player.pauseVideo(); } catch (e) {}
  }

  function onMsg(data) {
    try {
      var msg = JSON.parse(data);
      if (msg.type === 'SEEK') safeSeek(Number(msg.time || 0));
      if (msg.type === 'PAUSE') safePause();
      if (msg.type === 'PLAY') safePlay();
    } catch (e) {}
  }

  document.addEventListener("message", function(event) { onMsg(event.data); });
  window.addEventListener("message", function(event) { onMsg(event.data); });
</script>
  </body>
</html>
`;
    }, [videoId]);

    const VIDEO_W = SCREEN_W;
    const VIDEO_H = Math.round((VIDEO_W * 9) / 16);

    return (
        <SafeAreaView style={styles.safe} edges={['left', 'right']}>
            <View style={[styles.header, { height: insets.top + 44, paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={TEXT} />
                </TouchableOpacity>

                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={togglePlay} activeOpacity={0.8} style={styles.headerIconBtn}>
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={TEXT} />
                    </TouchableOpacity>

                    <View style={styles.timerPill}>
                        <Ionicons name="alarm-outline" size={14} color={TEXT} />
                        <Text style={styles.timerPillText}>{formatMMSS(remainingSec)}</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1, backgroundColor: BG }}
                contentContainerStyle={{ paddingBottom: 150 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.videoWrap, { width: VIDEO_W, height: VIDEO_H }]}>
                    {videoId ? (
                        <WebView
                            ref={webRef}
                            source={{ html }}
                            style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
                            javaScriptEnabled
                            domStorageEnabled
                            allowsInlineMediaPlayback
                            mediaPlaybackRequiresUserAction={false}
                            allowsFullscreenVideo
                        />
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
                </View>

                <View style={styles.progressWrap}>
                    <View style={styles.progressRow}>
                        {steps.map((_, i) => {
                            const active = i === activeIdx;
                            return (
                                <TouchableOpacity
                                    key={steps[i].id}
                                    activeOpacity={0.85}
                                    onPress={() => jumpToStep(i)}
                                    style={[styles.progressSeg, active && styles.progressSegActive]}
                                />
                            );
                        })}
                    </View>
                </View>

                <View style={styles.hintBox}>
                    <Text style={styles.hintTitle}>손동작으로 조절해봐요!</Text>
                    <Text style={styles.hintLine}>멈추고 싶을 때 ✋</Text>
                    <Text style={styles.hintLine}>전으로 돌아가고 싶을 때 🫲 (왼쪽으로 스와이프)</Text>
                    <Text style={styles.hintLine}>다음으로 넘어가고 싶을 때 🫱 (오른쪽으로 스와이프)</Text>
                    <Text style={styles.hintLine}>타이머 설정하고 싶을 때 👌</Text>
                </View>

                <View style={styles.stepsArea} {...panResponder.panHandlers}>
                    {steps.map((s, idx) => {
                        const active = idx === activeIdx;
                        const mt = idx === 0 ? 0 : 22;

                        return (
                            <TouchableOpacity
                                key={s.id}
                                activeOpacity={0.92}
                                onPress={() => jumpToStep(idx)}
                                style={{ marginTop: mt }}
                            >
                                <View style={[styles.stepCard, active && styles.stepCardActive]}>
                                    <View style={styles.stepTopRow}>
                                        <Text style={[styles.stepTitle, active && { color: BRAND }]}>{s.title}</Text>
                                    </View>

                                    <Text style={styles.stepBody}>{s.body}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <TouchableOpacity activeOpacity={0.9} style={styles.circleBtn} onPress={() => setTimerOpen(true)}>
                    <Ionicons name="alarm-outline" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.9} style={styles.circleBtn} onPress={openVoiceModal}>
                    <Ionicons name="mic" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

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

                        <View style={styles.voicePulseWrap}>
                            <Animated.View
                                style={[
                                    styles.voicePulseOuter,
                                    {
                                        transform: [{ scale: pulseAnim }],
                                    },
                                ]}
                            />
                            <View style={styles.voiceMicCircle}>
                                <Ionicons name="mic" size={34} color="#fff" />
                            </View>
                        </View>

                        <Text style={styles.voiceHint}>이 기능은 현재 준비 중이에요</Text>

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
    style: any;
    maxLength: number;
}) {
    const { TextInput } = require('react-native');

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

    header: {
        backgroundColor: BG,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    headerRight: {
        marginLeft: 'auto',
        marginRight: 14,
        flexDirection: 'row',
        alignItems: 'center',
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

    videoWrap: { backgroundColor: '#000' },
    videoFallback: {
        flex: 1,
        backgroundColor: '#DDE6E6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
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
        marginHorizontal: 18,
        backgroundColor: BG,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 16,
        minHeight: 169,
    },
    stepCardActive: {
        backgroundColor: WHITE,
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
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: TEXT,
        marginBottom: 10,
    },
    stepBody: {
        fontSize: 15,
        fontWeight: '800',
        color: TEXT,
        lineHeight: 22,
        opacity: 0.92,
    },

    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 22,
        paddingTop: 10,
    },
    circleBtn: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: BRAND,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },

    modalBack: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
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
});