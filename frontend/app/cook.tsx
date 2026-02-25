import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';

const BRAND = '#54CDA4';
const BG = '#F3F6F6';
const WHITE = '#FFFFFF';
const TEXT = '#3B4F4E';
const MUTED = '#8A9B9A';

const { width: SCREEN_W } = Dimensions.get('window');

type Step = { id: string; title: string; body: string; startSec: number };

function firstString(v: string | string[] | undefined) {
  if (!v) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
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
      { id: 's2', title: 'STEP 2', startSec: 55, body: '청양고추는 매운맛을 살리기 위해 두껍게 어슷썰기로 큼직하게 썰어 준비합니다.' },
      { id: 's3', title: 'STEP 3', startSec: 115, body: '고기를 볶다가 양념을 넣고 센불로 빠르게 마무리합니다.' },
      { id: 's4', title: 'STEP 4', startSec: 175, body: '불을 줄여 한 번 더 볶아 양념이 잘 배도록 마무리합니다.' },
    ],
    []
  );

  const [activeIdx, setActiveIdx] = useState(0);

  // ---- YouTube seek via postMessage ----
  const webRef = useRef<WebView>(null);
  const seekTo = (sec: number) => {
    webRef.current?.postMessage(JSON.stringify({ type: 'SEEK', time: sec }));
  };
  const jumpToStep = (idx: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, idx));
    setActiveIdx(next);
    seekTo(steps[next].startSec);
  };

  // ---- horizontal swipe (won't block vertical scroll) ----
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
          if (g.dx <= -threshold) jumpToStep(activeIdx + 1);
          if (g.dx >= threshold) jumpToStep(activeIdx - 1);
        },
      }),
    [activeIdx, steps]
  );

  // ---- YouTube IFrame API HTML ----
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

      function onMsg(data) {
        try {
          var msg = JSON.parse(data);
          if (msg.type === 'SEEK') safeSeek(Number(msg.time || 0));
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
      {/* Header (뒤로가기 겹침 방지: top inset을 여기서만 먹음) */}
      <View style={[styles.header, { height: insets.top + 44, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Video */}
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
              <Text style={{ color: MUTED, fontWeight: '800' }}>video_id가 없어서 영상을 띄울 수 없어요</Text>
              {!!url && (
                <Text style={{ color: MUTED, marginTop: 6, fontSize: 12 }} numberOfLines={1}>
                  {url}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 위치바 */}
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

        {/* Instruction */}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>손동작으로 조절해봐요!</Text>
          <Text style={styles.hintLine}>멈추고 싶을 때 ✋</Text>
          <Text style={styles.hintLine}>전으로 돌아가고 싶을 때 👈 (왼쪽으로 스와이프)</Text>
          <Text style={styles.hintLine}>다음으로 넘어가고 싶을 때 👉 (오른쪽으로 스와이프)</Text>
          <Text style={styles.hintLine}>타이머 설정하고 싶을 때 ⏱</Text>
        </View>

        {/* Steps: 전부 카드 크기 고정, active일 때만 색 바뀜 */}
        <View style={styles.stepsArea} {...panResponder.panHandlers}>
          {steps.map((s, idx) => {
            const active = idx === activeIdx;

            // ✅ 카드 사이 간격 넓게 (원래도 STEP2처럼 벌어져 있어야)
            const mt = idx === 0 ? 0 : 22;

            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.92}
                onPress={() => jumpToStep(idx)}
                style={{ marginTop: mt }}
              >
                <View style={[styles.stepCard, active && styles.stepCardActive]}>
                  <Text style={[styles.stepTitle, active && { color: BRAND }]}>{s.title}</Text>
                  <Text style={styles.stepBody}>{s.body}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity activeOpacity={0.9} style={styles.circleBtn} onPress={() => {}}>
          <Ionicons name="alarm-outline" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} style={styles.circleBtn} onPress={() => {}}>
          <Ionicons name="mic-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: BG,
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  videoWrap: { backgroundColor: '#000' },
  videoFallback: {
    flex: 1,
    backgroundColor: '#DDE6E6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  // 위치바
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

  // ✅ 전부 동일 카드 레이아웃(안 눌러도 간격/크기 유지)
  stepCard: {
    marginHorizontal: 18,
    backgroundColor: BG, // ✅ 기본은 배경색(눌러도 크기는 그대로)
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 169,
  },

  // ✅ active일 때만 "흰색 카드"로 강조
  stepCardActive: {
    backgroundColor: WHITE,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
});