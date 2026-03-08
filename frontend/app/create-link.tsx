import React, { useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND = '#54CDA4';
const BG = '#F3F6F6';
const WHITE = '#FFFFFF';
const BORDER = '#D9D9D9';
const TEXT = '#3B4F4E';

type TabKey = 'recipe' | 'ingredient';
type Step = { id: string; title: string; body: string };
type SubItem = { id: string; name: string; amount: string; price?: string };
type Ingredient = { id: string; name: string; amount: string; price?: string; subs?: SubItem[] };

const { width: SCREEN_W } = Dimensions.get('window');

const TOPBAR_H = 44;
const VIDEO_H = 210;
const META_H = 90;
const TAB_H = 42;

const CTA_BTN_H = 45;
const CTA_GAP = 12;

const PAD_LR = 18;
const ING_GAP = 5;

const ING_RADIUS = 14;
const ING_BORDER_W = 1.5;

const SUB_ROW_H = 56;
const SUB_PAD_V = 12;

function firstString(v: string | string[] | undefined) {
  if (!v) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

function formatWon(value: any) {
  if (value === undefined || value === null || value === '') return '';

  const num = Number(value);

  if (Number.isNaN(num)) {
    return `${value}원`;
  }

  return `${num.toLocaleString('ko-KR')}원`;
}

export default function CreateLink() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams();
  const link = firstString(params.link) || firstString(params.url);
  const videoId = firstString(params.video_id);
  const titleParam = firstString(params.title);
  const channelParam = firstString(params.channel_name);
  const thumbParam = firstString(params.thumbnail_url);
  const recipeDataParam = firstString(params.recipe_data);

  const recipeData = useMemo(() => {
    try {
      return recipeDataParam ? JSON.parse(recipeDataParam) : null;
    } catch (e) {
      console.log('[CREATE-LINK] recipe_data parse error:', e);
      return null;
    }
  }, [recipeDataParam]);

  console.log('[CREATE-LINK recipeData]', recipeData);

  const thumbUrl = thumbParam || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '');

  const title = titleParam || '제목을 불러오지 못했어요';
  const channelName = channelParam || '채널명을 불러오지 못했어요';

  const [tab, setTab] = useState<TabKey>('recipe');
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  const [expandedIngId, setExpandedIngId] = useState<string | null>(null);
  const [selectedIngItem, setSelectedIngItem] = useState<Record<string, string>>({});

  const scrollY = useRef(new Animated.Value(0)).current;

  const steps: Step[] = useMemo(() => {
    if (!recipeData?.steps || !Array.isArray(recipeData.steps)) return [];

    return recipeData.steps.map((item: any, index: number) => ({
      id: `s${item.step ?? index + 1}`,
      title: `STEP ${item.step ?? index + 1}`,
      body: item.desc ?? '',
    }));
  }, [recipeData]);

  const ingredients: Ingredient[] = useMemo(() => {
    if (!recipeData?.ingredients || !Array.isArray(recipeData.ingredients)) return [];

    return recipeData.ingredients.map((item: any, index: number) => ({
      id: item.name ? `${item.name}-${index}` : `ingredient-${index}`,
      name: item.name ?? '',
      amount: item.amount ?? '',
      price: formatWon(item.estimated_price),
      subs: Array.isArray(item.alternatives)
        ? item.alternatives.map((alt: any, altIndex: number) => ({
          id: alt.name ? `${alt.name}-${altIndex}` : `alt-${altIndex}`,
          name: alt.name ?? '',
          amount: alt.amount ?? '',
          price: formatWon(alt.estimated_price),
        }))
        : [],
    }));
  }, [recipeData]);

  const handleSelectIng = (ingId: string, itemId: string) => {
    setSelectedIngItem((prev) => {
      if (prev[ingId] === itemId) {
        const next = { ...prev };
        delete next[ingId];
        return next;
      }
      return { ...prev, [ingId]: itemId };
    });
  };

  const isSelected = (ingId: string, itemId: string) => selectedIngItem[ingId] === itemId;

  const contentBottomPad = CTA_BTN_H + CTA_GAP + Math.max(insets.bottom, 10) + 18;
  const FIXED_TOP_H = TOPBAR_H + VIDEO_H + META_H + TAB_H;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.fixedTop, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>

        <View style={styles.videoWrap} pointerEvents="none">
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.videoImg} resizeMode="cover" />
          ) : (
            <View style={[styles.videoImg, { backgroundColor: '#DDE6E6' }]} />
          )}

          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={26} color="#fff" />
            </View>
          </View>
          <Text style={styles.youtubeBadge}>YouTube</Text>
        </View>

        <View style={styles.metaFixed}>
          <Text style={styles.titleText} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.channelRow}>
            <View style={styles.avatar} />
            <Text style={styles.channelText} numberOfLines={1}>
              {channelName}
            </Text>
          </View>
        </View>

        <View style={styles.tabsWrapFixed}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setTab('recipe')} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === 'recipe' && styles.tabTextActive]}>레시피</Text>
            <View style={[styles.tabLine, tab === 'recipe' && styles.tabLineActive]} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} onPress={() => setTab('ingredient')} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === 'ingredient' && styles.tabTextActive]}>재료</Text>
            <View style={[styles.tabLine, tab === 'ingredient' && styles.tabLineActive]} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: FIXED_TOP_H,
          paddingBottom: contentBottomPad,
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      >
        <View style={styles.contentWrap}>
          {tab === 'recipe' ? (
            <View style={{ paddingHorizontal: PAD_LR }}>
              {steps.length > 0 ? (
                steps.map((s, idx) => {
                  const active = idx === activeStepIdx;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.92}
                      onPress={() => setActiveStepIdx(idx)}
                      style={[styles.stepCard, idx > 0 && { marginTop: 14 }]}
                    >
                      <Text style={[styles.stepTitle, active && { color: BRAND }]}>{s.title}</Text>
                      <Text style={styles.stepBody}>{s.body}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>레시피 분석 결과가 아직 없어요.</Text>
                </View>
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.ingHint}>준비된 재료는 터치해 주세요!</Text>

              <View style={styles.ingListWrap}>
                {ingredients.length > 0 ? (
                  ingredients.map((ing) => {
                    const baseSelected = isSelected(ing.id, ing.id);
                    const expanded = expandedIngId === ing.id;

                    return (
                      <View key={ing.id} style={{ marginBottom: ING_GAP }}>
                        <View style={[styles.ingBox, baseSelected && styles.selectedBorder]}>
                          <TouchableOpacity activeOpacity={0.92} onPress={() => handleSelectIng(ing.id, ing.id)}>
                            <View style={styles.ingRow}>
                              <Text style={[styles.ingName, baseSelected && styles.selectedText]}>{ing.name}</Text>
                              <Text style={[styles.ingAmount, baseSelected && styles.selectedText]}>{ing.amount}</Text>
                              <Text style={[styles.ingPrice, baseSelected && styles.selectedText]}>{ing.price ?? ''}</Text>
                            </View>
                          </TouchableOpacity>

                          {(ing.subs?.length ?? 0) > 0 && (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => setExpandedIngId(expanded ? null : ing.id)}
                              hitSlop={10}
                              style={styles.subToggleBtn}
                            >
                              <Text style={styles.subToggleText}>대체품목</Text>
                              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={TEXT} />
                            </TouchableOpacity>
                          )}

                          {expanded && (ing.subs?.length ?? 0) > 0 && (
                            <View style={styles.subList}>
                              {ing.subs!.map((sub, i) => {
                                const sel = isSelected(ing.id, sub.id);
                                return (
                                  <TouchableOpacity
                                    key={sub.id}
                                    activeOpacity={0.92}
                                    onPress={() => handleSelectIng(ing.id, sub.id)}
                                    style={[styles.subRowBtn, i > 0 && styles.subDivider]}
                                  >
                                    <View style={styles.subRow}>
                                      <Text style={[styles.subName, sel && styles.selectedText]}>{sub.name}</Text>
                                      <Text style={[styles.subAmount, sel && styles.selectedText]}>{sub.amount}</Text>
                                      <Text style={[styles.subPrice, sel && styles.selectedText]}>{sub.price ?? ''}</Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>재료 분석 결과가 아직 없어요.</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <View style={[styles.bottomCta, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.startBtn}
          onPress={() => {
            router.push({
              pathname: '/cook',
              params: {
                video_id: videoId,
                url: link,
                title,
                channel_name: channelName,
                thumbnail_url: thumbUrl,
                recipe_data: recipeDataParam,
              },
            });
          }}
        >
          <Text style={styles.startText}>요리 시작</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  fixedTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 1000,
    backgroundColor: WHITE,
  },
  topBar: {
    height: TOPBAR_H,
    backgroundColor: WHITE,
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  videoWrap: { width: SCREEN_W, height: VIDEO_H, backgroundColor: '#DDE6E6' },
  videoImg: { width: '100%', height: '100%' },
  playOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  youtubeBadge: { position: 'absolute', right: 10, bottom: 8, fontWeight: '900', color: 'rgba(0,0,0,0.55)' },

  metaFixed: {
    height: META_H,
    backgroundColor: WHITE,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    justifyContent: 'center',
  },
  titleText: { fontSize: 15, fontWeight: '900', color: TEXT, flexShrink: 1, lineHeight: 20 },
  channelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#DDE6E6' },
  channelText: { fontSize: 12, fontWeight: '800', color: TEXT, flexShrink: 1, opacity: 0.9 },

  tabsWrapFixed: {
    height: TAB_H,
    backgroundColor: WHITE,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-end',
  },
  tabBtn: {
    width: SCREEN_W / 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 6,
    paddingBottom: 0,
  },
  tabText: { fontSize: 14, fontWeight: '900', color: TEXT, opacity: 0.55 },
  tabTextActive: { opacity: 1 },
  tabLine: {
    marginTop: 12,
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  tabLineActive: { backgroundColor: BRAND },

  contentWrap: { backgroundColor: BG, paddingTop: 4 },

  stepCard: { backgroundColor: BG, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  stepTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 8 },
  stepBody: { fontSize: 15, fontWeight: '700', color: TEXT, lineHeight: 20 },

  bottomCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: CTA_GAP,
    backgroundColor: 'transparent',
  },
  startBtn: {
    width: 208,
    height: CTA_BTN_H,
    borderRadius: 30,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { color: WHITE, fontSize: 16, fontWeight: '900' },

  ingHint: {
    marginTop: 2,
    marginLeft: 30,
    fontSize: 10,
    fontWeight: '700',
    color: '#8A9B9A',
  },
  ingListWrap: { marginTop: 6, paddingHorizontal: 18, paddingBottom: 10 },

  ingBox: {
    width: '100%',
    borderRadius: ING_RADIUS,
    backgroundColor: WHITE,
    borderWidth: ING_BORDER_W,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },

  ingRow: { flexDirection: 'row', alignItems: 'center' },
  ingName: { flex: 1, fontSize: 20, fontWeight: '900', color: TEXT },
  ingAmount: { width: 80, textAlign: 'right', fontSize: 16, fontWeight: '800', color: TEXT },
  ingPrice: { width: 90, textAlign: 'right', fontSize: 16, fontWeight: '900', color: TEXT },

  selectedText: { color: BRAND },
  selectedBorder: { borderColor: BRAND },

  subToggleBtn: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  subToggleText: { fontSize: 10, fontWeight: '800', color: TEXT, opacity: 0.7 },

  subList: { marginTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  subRowBtn: { height: SUB_ROW_H, justifyContent: 'center', paddingVertical: SUB_PAD_V },
  subDivider: { borderTopWidth: 1, borderTopColor: BORDER },

  subRow: { flexDirection: 'row', alignItems: 'center' },
  subName: { flex: 1, fontSize: 14, fontWeight: '900', color: TEXT },
  subAmount: { width: 80, textAlign: 'right', fontSize: 14, fontWeight: '800', color: TEXT },
  subPrice: { width: 90, textAlign: 'right', fontSize: 14, fontWeight: '900', color: TEXT },

  emptyBox: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8A9B9A',
    textAlign: 'center',
  },
});