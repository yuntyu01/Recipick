import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { buildUserHistoryPayloadFromRecipe, createUserHistory, getHistoryMemo, getMeWithToken, getUserIdFromMe, updateHistoryMemo, type RecipeData } from '../lib/api';
import { auth } from '../lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from "react-native-youtube-iframe";

const BRAND = '#54CDA4';
const BG = '#F3F6F6';
const WHITE = '#FFFFFF';
const BORDER = '#D9D9D9';
const TEXT = '#3B4F4E';
const MUTED = '#8A9B9A';

type TabKey = 'recipe' | 'ingredient' | 'nutrition';

type Step = {
  id: string;
  title: string;
  body: string;
  timerSec?: string;
  videoTimestamp?: string;
};

type NutritionItem = {
  label: string;
  value: string;
  unit: string;
};

type SubItem = {
  id: string;
  name: string;
  amount: string;
  price?: string;
};

type Ingredient = {
  id: string;
  name: string;
  amount: string;
  price?: string;
  subs?: SubItem[];
};

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

function buildYoutubeUrl(videoId?: string) {
  if (!videoId) return '';
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function formatWon(value: any) {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).replace(/[^\d.-]/g, '');
  const num = Number(raw);

  if (Number.isNaN(num)) {
    return String(value).includes('원') ? String(value) : `${value}원`;
  }

  return `${num.toLocaleString('ko-KR')}원`;
}

function safeText(value: any, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

function parseWonToNumber(value: any): number {
  if (value === undefined || value === null || value === '') return 0;
  const raw = String(value).replace(/[^\d.-]/g, '');
  const num = Number(raw);
  return Number.isNaN(num) ? 0 : num;
}

export default function CreateLink() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const playerRef = useRef<any>(null);

  const handleSeekTo = (timestamp: string) => {
      if (!timestamp || !playerRef.current) return;
      const parts = timestamp.split(':').map(Number);
      const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
      playerRef.current.seekTo(seconds, true);
    };

  const params = useLocalSearchParams();
  const paramLink = firstString(params.link);
  const paramUrl = firstString(params.url);
  const videoId = firstString(params.video_id);
  const titleParam = firstString(params.title);
  const channelParam = firstString(params.channel_name);
  const thumbParam = firstString(params.thumbnail_url);
  const recipeDataParam = firstString(params.recipe_data);

  const link = paramLink || paramUrl || buildYoutubeUrl(videoId);

  const recipeData = useMemo(() => {
    try {
      return recipeDataParam ? JSON.parse(recipeDataParam) : null;
    } catch (e) {
      console.log('[CREATE-LINK] recipe_data parse error:', e);
      return null;
    }
  }, [recipeDataParam]);

  console.log('[CREATE-LINK recipeData]', recipeData);

  const thumbUrl =
    thumbParam || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '');

  const title =
    titleParam ||
    safeText(recipeData?.title, '') ||
    '제목을 불러오지 못했어요';

  const channelName =
    channelParam ||
    safeText(recipeData?.channel_name, '') ||
    '채널명을 불러오지 못했어요';

  const [tab, setTab] = useState<TabKey>('recipe');
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  const [expandedIngId, setExpandedIngId] = useState<string | null>(null);
  const [selectedIngItem, setSelectedIngItem] = useState<Record<string, string>>({});

  const scrollY = useRef(new Animated.Value(0)).current;

  const steps: Step[] = useMemo(() => {
    if (!recipeData?.steps || !Array.isArray(recipeData.steps)) return [];

    return recipeData.steps.map((item: any, index: number) => {
      const stepNo = safeText(item?.step, String(index + 1));
      const desc = safeText(item?.desc, '');
      const timestamp = safeText(item?.video_timestamp, '');
      const timerSec = safeText(item?.timer_sec, '');

      return {
        id: `step-${stepNo}-${index}`,
        title: `STEP ${stepNo}`,
        body: desc,
        timerSec,
        videoTimestamp: timestamp,
      };
    });
  }, [recipeData]);

  const ingredients: Ingredient[] = useMemo(() => {
    if (!recipeData?.ingredients || !Array.isArray(recipeData.ingredients)) return [];

    return recipeData.ingredients.map((item: any, index: number) => ({
      id: item?.name ? `${item.name}-${index}` : `ingredient-${index}`,
      name: safeText(item?.name, '재료'),
      amount: safeText(item?.amount, ''),
      price: formatWon(item?.estimated_price),
      subs: Array.isArray(item?.alternatives)
        ? item.alternatives.map((alt: any, altIndex: number) => ({
          id: alt?.name ? `${alt.name}-${altIndex}` : `alt-${altIndex}`,
          name: safeText(alt?.name, '대체 재료'),
          amount: safeText(alt?.amount, ''),
          price: formatWon(alt?.estimated_price),
        }))
        : [],
    }));
  }, [recipeData]);

  const nutrition: NutritionItem[] = useMemo(() => {
    const items: NutritionItem[] = [];

    // total_calorie (최상위 필드)
    if (recipeData?.total_calorie) {
      const raw = String(recipeData.total_calorie).replace(/[^\d.]/g, '');
      if (raw) items.push({ label: '칼로리', value: raw, unit: 'kcal' });
    }

    // nutrition_details 내 필드를 라벨 매핑으로 동적 처리
    const labelMap: Record<string, { label: string; unit: string }> = {
      carbs_g: { label: '탄수화물', unit: 'g' },
      protein_g: { label: '단백질', unit: 'g' },
      fat_g: { label: '지방', unit: 'g' },
      sodium_mg: { label: '나트륨', unit: 'mg' },
      sugar_g: { label: '당류', unit: 'g' },
    };

    const nd = recipeData?.nutrition_details;
    if (nd && typeof nd === 'object') {
      // labelMap에 있는 키는 정해진 순서대로, 나머지는 뒤에 동적 추가
      const knownKeys = Object.keys(labelMap);
      const allKeys = Object.keys(nd);

      // 알려진 키 먼저
      for (const key of knownKeys) {
        const val = nd[key];
        if (val === undefined || val === null || String(val).trim() === '') continue;
        const raw = String(val).replace(/[^\d.]/g, '');
        if (!raw || raw === '0') continue;
        const info = labelMap[key];
        items.push({ label: info.label, value: raw, unit: info.unit });
      }

      // API에서 새로운 필드가 추가되면 자동으로 표시
      for (const key of allKeys) {
        if (knownKeys.includes(key)) continue;
        const val = nd[key];
        if (val === undefined || val === null || String(val).trim() === '') continue;
        const raw = String(val).replace(/[^\d.]/g, '');
        if (!raw || raw === '0') continue;

        // 키 이름에서 라벨과 단위 추출 (예: fiber_g -> fiber, g)
        const match = key.match(/^(.+?)_([a-zA-Z]+)$/);
        const label = match ? match[1].replace(/_/g, ' ') : key;
        const unit = match ? match[2] : '';
        items.push({ label, value: raw, unit });
      }
    }

    return items;
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

  const handleOpenYoutube = async () => {
    if (!link) return;
    try {
      await Linking.openURL(link);
    } catch (e) {
      console.log('[CREATE-LINK] open url error', e);
    }
  };

  const handleStartCook = () => {
    if (!recipeDataParam) return;

    router.push({
      pathname: '/cook',
      params: {
        video_id: videoId,
        url: link,
        link,
        title,
        channel_name: channelName,
        thumbnail_url: thumbUrl,
        recipe_data: recipeDataParam,
      },
    });
  };

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

  const totalPrice = useMemo(() => {
    if (recipeData?.total_estimated_price) {
      return parseWonToNumber(recipeData.total_estimated_price);
    }
    return ingredients.reduce((sum, ing) => sum + parseWonToNumber(ing.price), 0);
  }, [recipeData, ingredients]);

  const remainingPrice = useMemo(() => {
    let selected = 0;
    for (const ing of ingredients) {
      const chosenId = selectedIngItem[ing.id];
      if (!chosenId) continue;
      if (chosenId === ing.id) {
        selected += parseWonToNumber(ing.price);
      } else {
        const sub = ing.subs?.find(s => s.id === chosenId);
        if (sub) selected += parseWonToNumber(sub.price);
      }
    }
    return Math.max(totalPrice - selected, 0);
  }, [totalPrice, ingredients, selectedIngItem]);

  // 메모
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedUserId = useRef<string | null>(null);

  const resolveUserId = async () => {
    if (resolvedUserId.current) return resolvedUserId.current;
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    const me = await getMeWithToken(token);
    const uid = getUserIdFromMe(me);
    resolvedUserId.current = uid;
    return uid;
  };

  useEffect(() => {
    if (recipeData?.memo) setMemo(recipeData.memo);
    // 서버에서 메모 불러오기
    if (videoId) {
      (async () => {
        try {
          const uid = await resolveUserId();
          if (!uid) return;
          const res = await getHistoryMemo(uid, videoId);
          if (res?.memo) setMemo(res.memo);
        } catch (e) {
          // 히스토리 없으면 무시
        }
      })();
    }
  }, [recipeData]);

  const handleMemoChange = useCallback((text: string) => {
    setMemo(text);
    setMemoSaved(false);
    setMemoError(null);
    if (memoTimer.current) clearTimeout(memoTimer.current);
    memoTimer.current = setTimeout(async () => {
      if (!videoId) return;
      try {
        const uid = await resolveUserId();
        if (!uid) return;

        try {
          await updateHistoryMemo(uid, videoId, text);
        } catch (memoErr: any) {
          // 히스토리가 없으면 생성 후 재시도
          if (memoErr?.message?.includes('찾을 수 없습니다') && recipeData) {
            const payload = buildUserHistoryPayloadFromRecipe({ ...recipeData, video_id: videoId } as RecipeData);
            await createUserHistory(uid, payload);
            await updateHistoryMemo(uid, videoId, text);
          } else {
            throw memoErr;
          }
        }
        setMemoSaved(true);
      } catch (e: any) {
        console.log('[MEMO] save error', e?.message || e);
        setMemoError('저장 실패');
      }
    }, 1000);
  }, [videoId, recipeData]);

  const contentBottomPad = CTA_BTN_H + CTA_GAP + Math.max(insets.bottom, 10) + 18;
  const FIXED_TOP_H = VIDEO_H;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.fixedTop, { paddingTop: insets.top }]}>
        <View style={styles.videoWrap}>
          <YoutubePlayer
            ref={playerRef}
            height={VIDEO_H}
            play={false}
            videoId={videoId}
          />
          <TouchableOpacity onPress={() => router.back()} hitSlop={14} style={styles.videoBackBtn}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
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
        <View style={styles.metaSection}>
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

        <View style={styles.tabsWrap}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setTab('recipe')} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === 'recipe' && styles.tabTextActive]}>레시피</Text>
            <View style={[styles.tabLine, tab === 'recipe' && styles.tabLineActive]} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} onPress={() => setTab('ingredient')} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === 'ingredient' && styles.tabTextActive]}>재료</Text>
            <View style={[styles.tabLine, tab === 'ingredient' && styles.tabLineActive]} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} onPress={() => setTab('nutrition')} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === 'nutrition' && styles.tabTextActive]}>부가사항</Text>
            <View style={[styles.tabLine, tab === 'nutrition' && styles.tabLineActive]} />
          </TouchableOpacity>
        </View>
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
                      onPress={() => {
                        setActiveStepIdx(idx);
                        if (s.videoTimestamp) handleSeekTo(s.videoTimestamp);
                      }}
                      style={[styles.stepCard, idx > 0 && { marginTop: 10 }, active && styles.stepCardActive]}
                    >
                      <View style={styles.stepHeader}>
                        <Text style={[styles.stepTitle, active && { color: BRAND }]}>{s.title}</Text>
                        {!!s.videoTimestamp && (
                          <Text style={styles.stepTimestamp}>{s.videoTimestamp}</Text>
                        )}
                      </View>

                      <Text style={styles.stepBody}>{s.body}</Text>

                      {!!s.timerSec && s.timerSec !== '0' && (
                        <Text style={styles.stepTimer}>타이머 {s.timerSec}초</Text>
                      )}

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
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>레시피 분석 결과가 아직 없어요.</Text>
                </View>
              )}
            </View>
          ) : tab === 'ingredient' ? (
            <View>
              <Text style={styles.ingHint}>준비된 재료는 터치해 주세요!</Text>

              <View style={styles.ingHeaderRow}>
                <Text style={styles.ingHeaderName}>재료</Text>
                <Text style={styles.ingHeaderAmount}>용량</Text>
                <Text style={styles.ingHeaderPrice}>가격</Text>
              </View>

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
                              <Text style={[styles.ingName, baseSelected && styles.selectedText]} numberOfLines={1}>
                                {ing.name}
                              </Text>
                              <Text style={[styles.ingAmount, baseSelected && styles.selectedText]} numberOfLines={1}>
                                {ing.amount}
                              </Text>
                              <Text style={[styles.ingPrice, baseSelected && styles.selectedText]} numberOfLines={1}>
                                {ing.price ?? ''}
                              </Text>
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
                                      <Text style={[styles.subName, sel && styles.selectedText]} numberOfLines={1}>
                                        {sub.name}
                                      </Text>
                                      <Text style={[styles.subAmount, sel && styles.selectedText]} numberOfLines={1}>
                                        {sub.amount}
                                      </Text>
                                      <Text style={[styles.subPrice, sel && styles.selectedText]} numberOfLines={1}>
                                        {sub.price ?? ''}
                                      </Text>
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

              {totalPrice > 0 && (
                <View style={styles.bottomPriceRow}>
                  <Text style={styles.totalPriceText}>
                    총 <Text style={styles.totalPriceValue}>{totalPrice.toLocaleString('ko-KR')}원</Text>
                  </Text>
                  <Text style={styles.remainingText}>
                    아직 필요한 금액  <Text style={styles.remainingValue}>{remainingPrice.toLocaleString('ko-KR')}원</Text>
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={{ paddingHorizontal: PAD_LR }}>
              <View style={styles.memoCard}>
                <View style={styles.memoHeader}>
                  <Text style={styles.memoTitle}>메모</Text>
                  {memoSaved && <Text style={styles.memoSavedText}>저장됨</Text>}
                  {!!memoError && <Text style={[styles.memoSavedText, { color: '#D14B4B' }]}>{memoError}</Text>}
                </View>
                <TextInput
                  style={styles.memoInput}
                  value={memo}
                  onChangeText={handleMemoChange}
                  placeholder="나만의 메모를 남겨보세요"
                  placeholderTextColor={MUTED}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {nutrition.length > 0 ? (
                <View style={styles.nutCard}>
                  <View style={styles.nutTitleRow}>
                    <Text style={styles.nutTitleText}>영양성분</Text>
                  </View>

                  {nutrition.map((item, idx) => {
                    const isCalorie = item.label === '칼로리';
                    return (
                      <View
                        key={item.label}
                        style={[
                          styles.nutRow,
                          idx > 0 && styles.nutRowBorder,
                          isCalorie && styles.nutRowCalorie,
                        ]}
                      >
                        <Text style={[styles.nutLabel, isCalorie && styles.nutLabelCalorie]}>
                          {item.label}
                        </Text>
                        <View style={styles.nutValueWrap}>
                          <Text style={[styles.nutValue, isCalorie && styles.nutValueCalorie]}>
                            {item.value}
                          </Text>
                          <Text style={[styles.nutUnit, isCalorie && styles.nutUnitCalorie]}>
                            {item.unit}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  <Text style={styles.nutDisclaimer}>
                    * AI 추정치이며 실제 영양성분과 다를 수 있습니다.
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>영양성분 정보가 아직 없어요.</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <View style={[styles.bottomCta, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={handleStartCook}
          disabled={!recipeDataParam}
          style={({ pressed }) => [
            styles.startBtn,
            pressed && styles.startBtnPressed,
            !recipeDataParam && styles.startBtnDisabled,
          ]}
        >
          {({ pressed }) => (
            <Text style={[styles.startText, pressed && styles.startTextPressed]}>
              {recipeDataParam ? '요리 시작' : '레시피 없음'}
            </Text>
          )}
        </Pressable>
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

  videoWrap: {
    width: SCREEN_W,
    height: VIDEO_H,
    backgroundColor: '#DDE6E6',
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
  videoImg: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeBadge: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.55)',
  },

  metaFixed: {
    height: META_H,
    backgroundColor: WHITE,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT,
    flexShrink: 1,
    lineHeight: 20,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DDE6E6',
  },
  channelText: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT,
    flexShrink: 1,
    opacity: 0.9,
  },

  tabsWrapFixed: {
    height: TAB_H,
    backgroundColor: WHITE,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-end',
  },
  tabBtn: {
    width: SCREEN_W / 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 6,
    paddingBottom: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '900',
    color: TEXT,
    opacity: 0.55,
  },
  tabTextActive: { opacity: 1 },
  tabLine: {
    marginTop: 12,
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  tabLineActive: { backgroundColor: BRAND },

  contentWrap: {
    backgroundColor: BG,
    paddingTop: 4,
  },

  metaSection: {
    backgroundColor: WHITE,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  tabsWrap: {
    height: TAB_H,
    backgroundColor: WHITE,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-end',
  },

  stepCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepCardActive: {},
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT,
  },
  stepTimestamp: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
  },
  stepBody: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 20,
  },
  stepTimer: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: BRAND,
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
    borderWidth: 2,
    borderColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnPressed: {
    backgroundColor: WHITE,
    borderColor: BRAND,
  },
  startBtnDisabled: {
    opacity: 0.45,
  },
  startText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
  },
  startTextPressed: {
    color: BRAND,
  },

  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 8,
  },
  totalPriceText: {
    fontSize: 13,
    fontWeight: '800',
    color: MUTED,
  },
  totalPriceValue: {
    fontWeight: '900',
    color: TEXT,
  },
  remainingText: {
    fontSize: 13,
    fontWeight: '800',
    color: MUTED,
  },
  remainingValue: {
    fontWeight: '900',
    color: TEXT,
  },

  ingHint: {
    marginTop: 4,
    marginLeft: 30,
    fontSize: 10,
    fontWeight: '700',
    color: '#8A9B9A',
  },
  ingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingVertical: 8,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDED',
  },
  ingHeaderName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: MUTED,
  },
  ingHeaderAmount: {
    width: 70,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: MUTED,
  },
  ingHeaderPrice: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: MUTED,
  },
  ingListWrap: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },

  ingBox: {
    width: '100%',
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: '#E8EDED',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },

  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: TEXT,
    paddingRight: 8,
  },
  ingAmount: {
    width: 70,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
  },
  ingPrice: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '900',
    color: TEXT,
  },

  selectedText: { color: BRAND },
  selectedBorder: { borderColor: BRAND, borderWidth: 1.5 },

  subToggleBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  subToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT,
    opacity: 0.7,
  },

  subList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  subRowBtn: {
    height: SUB_ROW_H,
    justifyContent: 'center',
    paddingVertical: SUB_PAD_V,
  },
  subDivider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: TEXT,
    paddingRight: 8,
  },
  subAmount: {
    width: 70,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: TEXT,
  },
  subPrice: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
    color: TEXT,
  },

  nutCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 8,
  },
  nutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  nutTitleText: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT,
  },
  nutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  nutRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E8EDED',
  },
  nutRowCalorie: {
    paddingVertical: 14,
    backgroundColor: '#F0FAF6',
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  nutLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
  },
  nutLabelCalorie: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND,
  },
  nutValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  nutValue: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT,
  },
  nutValueCalorie: {
    fontSize: 20,
    color: BRAND,
  },
  nutUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
  },
  nutUnitCalorie: {
    fontSize: 13,
    color: BRAND,
  },
  nutDisclaimer: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    textAlign: 'center',
  },

  memoCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 8,
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  memoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT,
  },
  memoSavedText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND,
  },
  memoInput: {
    backgroundColor: BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    minHeight: 100,
    lineHeight: 20,
  },

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