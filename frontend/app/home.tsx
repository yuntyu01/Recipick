import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

import {
  analyzeRecipe,
  buildUserHistoryPayloadFromRecipe,
  createUserHistory,
  getMeWithToken,
  getRecipe,
  getRecommendationsByCategory,
  getUserHistory,
  getUserIdFromMe,
  normalizeRecommendations,
  normalizeUserHistory,
  waitRecipeCompleted,
  type RecommendationItem,
  type RecipeCategory,
  type RecipeData,
  type UserHistoryItem,
  type UserHistoryRecipeData,
} from '../lib/api';
import { buildYoutubeMetaFromUrl, extractYouTubeVideoId } from '../lib/youtube';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ================== FIGMA SCALE (430 기준) ================== */
const FIGMA_W = 430;
const { width: SCREEN_W } = Dimensions.get('window');
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

/* ---------- theme ---------- */
const BRAND = '#54CDA4';
const Q_TITLE = '#3B4F4E';
const SECTION = '#4C6664';

const BG = '#F3F6F6';
const CARD = '#FFFFFF';
const THUMB_BG = '#DDE6E6';

/* ---------- category icons ---------- */
const CATEGORY_ICONS = {
  한식: require('../assets/images/categories/korean.png'),
  일식: require('../assets/images/categories/japanese.png'),
  중식: require('../assets/images/categories/chinese.png'),
  양식: require('../assets/images/categories/western.png'),
  분식: require('../assets/images/categories/snack.png'),
  디저트: require('../assets/images/categories/dessert.png'),
} as const;

type CategoryKey = keyof typeof CATEGORY_ICONS;
type CategoryItem = { key: CategoryKey; icon: any };

const CATEGORIES: CategoryItem[] = (Object.keys(CATEGORY_ICONS) as CategoryKey[]).map((key) => ({
  key,
  icon: CATEGORY_ICONS[key],
}));

/* ---------- home feed types ---------- */
type HomeRecipeItem = {
  id: string;
  source: 'history' | 'recommend';
  videoId: string;
  url: string;
  title: string;
  channelName: string;
  thumbUrl?: string;
  category?: string;
  totalEstimatedPrice?: string;
  likeCount?: string;
  commentCount?: string;
  shareCount?: string;
  recipeData?: RecipeData | UserHistoryRecipeData | null;
  savedAt?: string;
};

const TWO_COL_GAP = s(10);
const TWO_COL_SIDE = s(18);
const TWO_COL_CARD_W = (SCREEN_W - TWO_COL_SIDE * 2 - TWO_COL_GAP) / 2;
const YT_THUMB_H = TWO_COL_CARD_W * (127 / 229);

/* ===== Figma absolute positions (430 기준) ===== */
const FIGMA_LOGO_L = 152;
const FIGMA_LOGO_R = 151;
const FIGMA_LOGO_T = 70;

const FIGMA_PROFILE_L = 369;
const FIGMA_PROFILE_T = 98;
const FIGMA_PROFILE_SIZE = 41;

const FIGMA_CTA_L = 32;
const FIGMA_CTA_R = 32;
const FIGMA_CTA_T = 149;
const FIGMA_CTA_H = 48;

const FIGMA_QUESTION_GAP = 27;

/* ===== Horizontal cards ===== */
const H_LIST_LEFT = s(18);
const H_LIST_GAP = s(10);
const H_CARD_W = s(229);
const H_THUMB_H = s(127);

function formatWon(value: any) {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).replace(/[^\d.-]/g, '');
  const num = Number(raw);

  if (Number.isNaN(num)) {
    return String(value).includes('원') ? String(value) : `${value}원`;
  }

  return `${num.toLocaleString('ko-KR')}원`;
}

function mapHistoryItemToHome(item: UserHistoryItem): HomeRecipeItem {
  const videoId = item.video_id ?? '';
  const url =
    item.original_url ||
    item.url ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

  return {
    id: `history-${videoId}-${item.saved_at || item.created_at || Math.random()}`,
    source: 'history',
    videoId,
    url,
    title: item.recipe_title || item.title || '제목 없음',
    channelName: item.channel_name || '채널명 없음',
    thumbUrl: item.thumbnail_url || '',
    category: item.category || '',
    totalEstimatedPrice: formatWon(item.total_estimated_price),
    likeCount: String(item.like_count ?? '0'),
    commentCount: String(item.comment_count ?? '0'),
    shareCount: String(item.share_count ?? '0'),
    recipeData: item.recipe_data ?? null,
    savedAt: item.saved_at || item.created_at || '',
  };
}

function mapRecommendationItemToHome(item: RecommendationItem): HomeRecipeItem {
  return {
    id: `recommend-${item.video_id}`,
    source: 'recommend',
    videoId: item.video_id,
    url: item.url || `https://www.youtube.com/watch?v=${item.video_id}`,
    title: item.title || '제목 없음',
    channelName: item.channel_name || '채널명 없음',
    thumbUrl: item.thumbnail_url || '',
    category: item.category || '',
    totalEstimatedPrice: '',
    likeCount: '0',
    commentCount: '0',
    shareCount: '0',
    recipeData: null,
  };
}

function isFullRecipeData(data: any): data is RecipeData {
  return !!data && Array.isArray(data.steps) && Array.isArray(data.ingredients);
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [link, setLink] = useState('');
  const isExpanded = link.trim().length > 0;

  const [oembedLoading, setOembedLoading] = useState(false);
  const [oembedError, setOembedError] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{
    videoId: string;
    title: string;
    channelName: string;
    thumbnailUrl?: string;
  } | null>(null);

  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // string 또는 null이 모두 가능하다고 정의합니다.
  const [userId, setUserId] = useState<string | null>(null);
  const [myRecipes, setMyRecipes] = useState<HomeRecipeItem[]>([]);
  const [recommendRecipes, setRecommendRecipes] = useState<HomeRecipeItem[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<HomeRecipeItem[]>([]);

  const [homeFeedLoading, setHomeFeedLoading] = useState(false);
  const [homeFeedError, setHomeFeedError] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const oembedTimer = useRef<any>(null);

  const TOP_TUNE = s(50);
  const logoTop = insets.top + s(FIGMA_LOGO_T) - TOP_TUNE;
  const profileTop = insets.top + s(FIGMA_PROFILE_T) - TOP_TUNE;
  const ctaTop = insets.top + s(FIGMA_CTA_T) - TOP_TUNE;
  const topAreaHeight = ctaTop + s(FIGMA_CTA_H) + s(16);

  const getAccessToken = async () => {
  let token = null;

  if (Platform.OS === 'web') {
    token = localStorage.getItem('accessToken') || localStorage.getItem('access_token');
  } else {
    token =
      (await SecureStore.getItemAsync('accessToken')) ||
      (await SecureStore.getItemAsync('access_token'));
  }

  // 💡 수정: 에러를 던지지 않고 null을 반환합니다. 
  // 그래야 로그인이 안 된 사용자도 홈 화면을 볼 수 있습니다.
  return token || null; 
};;

  const getCurrentUserId = async () => {
  try {
    const token = await getAccessToken();
    if (!token) return null; // 토큰 없으면 바로 null 반환

    const me = await getMeWithToken(token);
    return getUserIdFromMe(me);
  } catch (e) {
    console.log("[HOME AUTH ERROR]", e);
    return null;
  }
};

  const handleLinkChange = (text: string) => {
    setLink(text);
    setOembedError(null);
    setVideoMeta(null);
    setAnalyzeLoading(false);
    setAnalyzeError(null);

    if (oembedTimer.current) clearTimeout(oembedTimer.current);

    const trimmed = text.trim();
    if (!trimmed) return;

    const vid = extractYouTubeVideoId(trimmed);
    if (!vid) return;

    oembedTimer.current = setTimeout(async () => {
      try {
        setOembedLoading(true);

        const meta = await buildYoutubeMetaFromUrl(trimmed);

        setVideoMeta({
          videoId: meta.video_id,
          title: meta.title,
          channelName: meta.channel_name,
          thumbnailUrl: meta.thumbnail_url,
        });
      } catch (e) {
        setOembedError('유튜브 정보를 가져오지 못했어요. 링크를 다시 확인해줘.');
      } finally {
        setOembedLoading(false);
      }
    }, 400);
  };

  const handleClosePanel = () => {
    setLink('');
    setShowCreatePanel(false);

    setOembedLoading(false);
    setOembedError(null);
    setVideoMeta(null);

    setAnalyzeLoading(false);
    setAnalyzeError(null);

    if (oembedTimer.current) clearTimeout(oembedTimer.current);
  };

  const openCreateLinkScreen = ({
    url,
    videoId,
    title,
    channelName,
    thumbnailUrl,
    recipeData,
  }: {
    url: string;
    videoId: string;
    title: string;
    channelName: string;
    thumbnailUrl?: string;
    recipeData: any;
  }) => {
    router.push({
      pathname: '/create-link',
      params: {
        link: url,
        url,
        video_id: videoId,
        title,
        channel_name: channelName,
        thumbnail_url: thumbnailUrl || '',
        recipe_data: JSON.stringify(recipeData ?? null),
      },
    });
  };

  const goToRecipeDetail = async (item: HomeRecipeItem) => {
    try {
      setAnalyzeError(null);
      setDetailLoadingId(item.id);

      // 1. 상세 데이터 가져오기
      const detail = await getRecipe(item.videoId);

      if (detail.status === 'COMPLETED' && detail.data) {

        // ✅ [핵심 추가] 상세 페이지 진입 시 서버 DB에 '최근 본 레시피'로 저장!
        if (userId) {
          try {
            // api.ts에 있는 저장 함수 호출
            await createUserHistorySafe(userId, detail.data);
            // 저장 후 메인 피드를 다시 불러와야 목록에 즉시 반영됩니다.
            await loadHomeFeed(userId);
          } catch (historyErr) {
            console.log("히스토리 저장 실패(무시가능):", historyErr);
          }
        }

        openCreateLinkScreen({
          url: item.url,
          videoId: detail.video_id,
          title: detail.title || item.title,
          channelName: detail.channel_name || item.channelName,
          thumbnailUrl: detail.thumbnail_url || item.thumbUrl || '',
          recipeData: detail.data,
        });
        return;
      }

      if (item.source === 'recommend') {
        setAnalyzeError('이 추천 영상은 아직 분석된 레시피가 없어서 먼저 분석이 필요해.');
        return;
      }

      setAnalyzeError('레시피 상세 정보를 불러오지 못했어.');
    } catch (e: any) {
      console.error('[GO TO RECIPE DETAIL ERROR]', e);
      setAnalyzeError(e?.message || '레시피 상세 조회 중 오류가 났어.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const loadHomeFeed = async (resolvedUserId?: string) => {
    try {
      setHomeFeedLoading(true);
      setHomeFeedError(null);

      let currentUserId = resolvedUserId || userId;

      if (!currentUserId) {
        const fetchedId = await getCurrentUserId();
        if (fetchedId) {
          setUserId(fetchedId);
          currentUserId = fetchedId;
        } else {
    
          setUserId(null); 
          currentUserId = null;
        }
      }
      

      const recommendCategory: RecipeCategory = '한식';

      const [historyResult, recommendResult] = await Promise.allSettled([
            currentUserId ? getUserHistory(currentUserId, 50) : Promise.resolve([]), // 넉넉히 50개 가져오기
            getRecommendationsByCategory(recommendCategory),
          ]);

      if (historyResult.status === 'fulfilled') {
        // 서버에서 받아온 전체 히스토리 데이터를 정리합니다.
        const allHistory = normalizeUserHistory(historyResult.status === 'fulfilled' ? historyResult.value : []).map(mapHistoryItemToHome);

        setMyRecipes(allHistory.slice(0, 10));

        setRecentRecipes(allHistory.slice(0, 5));

      } else {
        console.log('[HOME HISTORY ERROR]', historyResult.reason);
        setMyRecipes([]);
        setRecentRecipes([]);
      }

      if (recommendResult.status === 'fulfilled') {
        const recommendItems = normalizeRecommendations(recommendResult.value).map(
          mapRecommendationItemToHome
        );
        setRecommendRecipes(recommendItems.slice(0, 10));
      } else {
        console.log('[HOME RECOMMEND ERROR]', recommendResult.reason);
        setRecommendRecipes([]);
      }
    } catch (e: any) {
      console.log('[HOME loadHomeFeed error]', e);
      setHomeFeedError(e?.message || '홈 데이터를 불러오지 못했어요.');
    } finally {
      setHomeFeedLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. 타입을 string | null로 명시해서 변수를 생성합니다.
        const resolvedUserId: string | null = await getCurrentUserId().catch(() => null);

        if (!mounted) return;

        // 2. 상태 업데이트
        setUserId(resolvedUserId);
        
        // 3. null일 경우 undefined를 넘겨서 loadHomeFeed의 타입 에러를 방지합니다.
        await loadHomeFeed(resolvedUserId || undefined);
      } catch (e: any) {
        console.log('[HOME INIT ERROR]', e);
        if (!mounted) return;
        setHomeFeedError(e?.message || '사용자 정보를 불러오지 못했어요.');
        await loadHomeFeed();
      } finally {
        // 4. [핵심] 여기서 setIsLoading을 호출하면 65라인의 상태와 정확히 연결됩니다.
        if (mounted) {
          setHomeFeedLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (oembedTimer.current) clearTimeout(oembedTimer.current);
    };
  }, []);

  const handleDone = async () => {
    const trimmed = link.trim();

    if (!trimmed) {
      setAnalyzeError('링크를 입력해줘.');
      return;
    }

    setAnalyzeError(null);

    try {
      setAnalyzeLoading(true);

      const videoId = extractYouTubeVideoId(trimmed);

      if (!videoId) {
        setAnalyzeError('유효한 유튜브 링크가 아니야.');
        return;
      }

      let resolvedUserId = userId;

      if (!resolvedUserId) {
        try {
          resolvedUserId = await getCurrentUserId();
          setUserId(resolvedUserId);
        } catch (e) {
          // 토큰이 없어도 에러를 던지지 않고 null로 둡니다.
          let resolvedUserId = null; 
          console.log('비로그인 상태로 분석을 진행합니다.');
        }
      }

      const safeTitle = videoMeta?.title?.trim() || '제목 없음';
      const safeChannelName = videoMeta?.channelName?.trim() || '채널명 없음';

      const requestBody = {
        video_id: videoId,
        original_url: `https://www.youtube.com/watch?v=${videoId}`,
        sharer_nickname: '익명',
        title: safeTitle,
        channel_name: safeChannelName,
      };

      console.log('[ANALYZE REQUEST BODY]', requestBody);

      const first = await analyzeRecipe(requestBody);

      console.log('[ANALYZE FIRST RESPONSE]', first);

      const finalRes =
        first.status === 'PROCESSING'
          ? await waitRecipeCompleted(first.video_id, {
            intervalMs: 1500,
            timeoutMs: 180000,
          })
          : first;

      console.log('[CATEGORY RAW]', finalRes.data?.category);
      console.log('[FULL ANALYSIS DATA]', finalRes.data);
      console.log('[ANALYZE FINAL RESPONSE]', finalRes);

      if (finalRes.status === 'FAILED') {
        setAnalyzeError('분석에 실패했어. 다른 링크로 다시 시도해줘.');
        return;
      }

      if (finalRes.status !== 'COMPLETED' || !finalRes.data) {
        setAnalyzeError('분석 결과가 아직 준비되지 않았어.');
        return;
      }

      try {
            // [수정] resolvedUserId가 확실히 있는지 한 번 더 확인합니다.
            let currentId = resolvedUserId || userId;
            if (!currentId) {
              currentId = await getCurrentUserId();
              setUserId(currentId);
            }

            if (currentId) {
              // 1. 서버에 저장 요청 (이게 성공해야 내 레시피에 들어갑니다)
              await createUserHistorySafe(currentId, finalRes.data);
              console.log('[저장 완료] 내 히스토리에 추가되었습니다.');

              // 2. [핵심] 저장 직후에 목록을 다시 불러옵니다. (ID를 인자로 꼭 넘겨주세요)
              await loadHomeFeed(currentId);
            }
          } catch (historyError) {
            console.log('[CREATE USER HISTORY ERROR]', historyError);
          }

      openCreateLinkScreen({
            url: trimmed,
            videoId: finalRes.video_id ?? videoId,
            title: finalRes.title || safeTitle,
            channelName: finalRes.channel_name || safeChannelName,
            thumbnailUrl: finalRes.thumbnail_url || videoMeta?.thumbnailUrl || '',
            recipeData: finalRes.data,
          });

          setShowCreatePanel(false);
          setLink('');
          setVideoMeta(null);

      await loadHomeFeed(resolvedUserId!);
    } catch (e: any) {
      console.error('[HANDLE DONE ERROR]', e);
      setAnalyzeError(e?.message || '분석 요청 중 오류가 났어.');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Home.tsx 내의 createUserHistorySafe 함수 수정

  const createUserHistorySafe = async (resolvedUserId: string, recipe: RecipeData) => {
    // 💡 추가: 유저 ID가 없으면 시도조차 하지 않음 (500 에러 방지)
    if (!resolvedUserId) return;

    try {
      const payload = {
        video_id: videoMeta?.videoId || recipe.video_id || '',
        title: videoMeta?.title || '제목 없음',
        channel_name: videoMeta?.channelName || '채널명 없음',
        thumbnail_url: videoMeta?.thumbnailUrl || '',
        original_url: link,
        // 💡 중요: recipe_data 내부의 불필요한 필드를 제거하거나 형식을 맞춤
        recipe_data: {
          ...recipe,
          steps: recipe.steps || [],
          ingredients: recipe.ingredients || []
        },
        category: recipe.category || '한식',
        total_estimated_price: String(recipe.total_estimated_price || '0'),
      };

      console.log('[서버 저장 시도]:', payload.title);
      const response = await createUserHistory(resolvedUserId, payload);
      console.log('[저장 성공]:', response);
    } catch (error: any) {
      // 500 에러가 나도 앱이 죽지 않게 처리
      console.warn('[저장 실패] 서버 500 오류 가능성:', error.message);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.topBar, { height: topAreaHeight }]}>
        <Text style={[styles.logo, { top: logoTop }]}>Recipick!</Text>

        <TouchableOpacity
          onPress={() => router.push('/mypage')}
          hitSlop={10}
          style={[
            styles.profileBtn,
            {
              top: profileTop,
              left: s(FIGMA_PROFILE_L),
              width: s(FIGMA_PROFILE_SIZE),
              height: s(FIGMA_PROFILE_SIZE),
            },
          ]}
        >
          <Ionicons name="person" size={18} color="#111" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.cta,
            {
              top: ctaTop,
              left: s(FIGMA_CTA_L),
              right: s(FIGMA_CTA_R),
              height: s(FIGMA_CTA_H),
            },
          ]}
          onPress={() => setShowCreatePanel(true)}
        >
          <Text style={styles.ctaText}>레시피 만들기</Text>
        </TouchableOpacity>
      </View>

      {showCreatePanel && (
        <View style={styles.createPanelWrap}>
          <View style={styles.createPanel}>
            <View style={styles.createInputRow}>
              <TextInput
                value={link}
                onChangeText={handleLinkChange}
                placeholder="링크를 붙여넣으면 AI가 레시피로 정리해줘요!"
                placeholderTextColor="#9AA8A7"
                style={styles.createInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleClosePanel}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.createClose}
              >
                <Ionicons name="close" size={18} color="#6B7C7A" />
              </TouchableOpacity>
            </View>

            {oembedLoading && <Text style={styles.oembedHint}>유튜브 정보 불러오는 중...</Text>}
            {!!oembedError && <Text style={styles.oembedError}>{oembedError}</Text>}

            {!!videoMeta && (
              <View style={styles.oembedPreview}>
                <Thumb uri={videoMeta.thumbnailUrl} style={styles.oembedThumb} borderRadius={s(10)} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.oembedTitle} numberOfLines={2}>
                    {videoMeta.title}
                  </Text>
                  <Text style={styles.oembedChannel} numberOfLines={1}>
                    {videoMeta.channelName}
                  </Text>
                </View>
              </View>
            )}

            {analyzeLoading && <Text style={styles.oembedHint}>레시피 분석 중...</Text>}
            {!!analyzeError && <Text style={styles.oembedError}>{analyzeError}</Text>}

            <View style={styles.createNotice}>
              <Text style={styles.createBullet}>• 지원 가능: 유튜브, 인스타</Text>
              <Text style={styles.createBullet}>• 30분 이상 영상 길이는 분석이 불가능해요</Text>
              <Text style={styles.createBullet}>• 분석에는 약 3분의 시간이 걸립니다</Text>
            </View>

            <View style={styles.createButtonsWrap}>
              {isExpanded ? (
                <View style={styles.createActionRow}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.createGhostBtn}
                    onPress={() => Linking.openURL('https://www.youtube.com')}
                  >
                    <Text style={styles.createGhostText}>유튜브 바로가기</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.createDoneBtn, analyzeLoading && { opacity: 0.5 }]}
                    onPress={handleDone}
                    disabled={analyzeLoading}
                  >
                    <Text style={styles.createDoneText}>{analyzeLoading ? '분석중...' : '완료'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.createDoneBtnFull, analyzeLoading && { opacity: 0.5 }]}
                  onPress={handleDone}
                  disabled={analyzeLoading}
                >
                  <Text style={styles.createDoneText}>{analyzeLoading ? '분석중...' : '완료'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      <Text style={[styles.question, { marginTop: s(FIGMA_QUESTION_GAP) }]}>어떤 요리 찾고 있어요?</Text>

      <FlatList
        horizontal
        data={CATEGORIES}
        // 수정 포인트: item.key가 없어도 index(순서)를 사용해 고유한 이름표를 만듭니다.
        keyExtractor={(item, index) => 
          item.key ? `category-${item.key}` : `category-fallback-${index}`
        }
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        ItemSeparatorComponent={() => <View style={{ width: s(6) }} />}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.categoryItem}
            // item.key가 없을 때를 대비해 안전하게 문자열로 변환합니다.
            onPress={() => 
              router.push(`/category/${encodeURIComponent(String(item.key || index))}`)
            }
          >
            <Image source={item.icon} style={styles.categoryImg} resizeMode="contain" />
            <Text style={styles.categoryText}>{item.key || '미지정'}</Text>
          </TouchableOpacity>
        )}
      />

      {homeFeedLoading && <Text style={styles.homeFeedHint}>홈 레시피 불러오는 중...</Text>}
      {!!homeFeedError && <Text style={styles.oembedError}>{homeFeedError}</Text>}
      {!!detailLoadingId && <Text style={styles.homeFeedHint}>레시피 상세 정보 불러오는 중...</Text>}

      <SectionHeader
        title="내 레시피"
        onPressRight={() => router.push({ pathname: '/my-recipes', params: { title: '내 레시피' } })}
      />
      <FlatList
        horizontal
        data={myRecipes}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: s(18), paddingRight: s(18) }}
        ItemSeparatorComponent={() => <View style={{ width: s(10) }} />}
        ListEmptyComponent={
          <View style={{ width: SCREEN_W - s(36), paddingLeft: s(10) }}>
            <Text style={styles.emptyText}>아직 분석한 레시피가 없어요.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <HorizontalVideoCard data={item} onPress={() => goToRecipeDetail(item)} />
        )}
      />

      <SectionHeader title="Recipick! 추천 레시피" onPressRight={() => router.push('/category/한식')} />
      <FlatList
        horizontal
        data={recommendRecipes}
        // id가 있든 없든, 그냥 순서(index)를 이름표로 써서 절대로 안 겹치게 만듭니다.
        keyExtractor={(_, index) => `recommend-item-${index}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: H_LIST_LEFT, paddingRight: s(18) }}
        ItemSeparatorComponent={() => <View style={{ width: H_LIST_GAP }} />}
        snapToInterval={H_CARD_W + H_LIST_GAP}
        decelerationRate="fast"
        ListEmptyComponent={
          !homeFeedLoading ? (
            <Text style={styles.emptyText}>추천 레시피가 아직 없어.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <HorizontalVideoCard data={item} onPress={() => goToRecipeDetail(item)} />
        )}
      />

      <SectionHeader
        title="최근 많이 사용한 레시피"
        onPressRight={() => router.push('/my-recipes')}
      />

      <View style={styles.recentBox}>
        {recentRecipes.length === 0 && !homeFeedLoading ? (
          <Text style={[styles.emptyText, { marginLeft: s(10) }]}>
            최근 레시피가 아직 없어.
          </Text>
        ) : (
          recentRecipes.map((r, idx) => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.92}
              style={[styles.recentCard, idx > 0 && { marginTop: s(12) }]}
              onPress={() => goToRecipeDetail(r)}
            >
              {/* ... (기존 내부 render 로직 동일) ... */}
              <View style={styles.recentInner}>
                <View style={styles.recentLeft}>
                  <Thumb style={styles.recentThumb} uri={r.thumbUrl} borderRadius={s(13.5)} />
                  <Text style={styles.timeAgoLeft}>
                    {r.savedAt ? '최근 저장한 레시피' : 'Recipick 분석 완료'}
                  </Text>
                </View>

                <View style={styles.recentRight}>
                  <Text style={styles.recentTitle} numberOfLines={2}>
                    {r.title}
                  </Text>

                  <View style={styles.channelRow2}>
                    <Thumb style={styles.channelAvatar} uri={undefined} borderRadius={999} />
                    <Text style={styles.channelName} numberOfLines={1}>
                      {r.channelName}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Meta icon="heart-outline" text={r.likeCount || '0'} />
                    <Meta icon="chatbubble-outline" text={r.commentCount || '0'} />
                    <Meta icon="share-social-outline" text={r.shareCount || '0'} />
                    <Text style={styles.priceText}>{r.totalEstimatedPrice || ''}</Text>
                  </View>

                  <Text style={styles.userTag}>Recipick 유저</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: s(40) }} />
    </ScrollView>
  );
}

/* ================= components ================= */

function SectionHeader({ title, onPressRight }: { title: string; onPressRight?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <TouchableOpacity onPress={onPressRight} hitSlop={10} style={styles.moreBtn}>
        <Text style={styles.moreText}>더보기</Text>
        <Text style={styles.moreArrow}>&gt;</Text>
      </TouchableOpacity>
    </View>
  );
}

function HorizontalVideoCard({ data, onPress }: { data: HomeRecipeItem; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.hVideoCard} onPress={onPress}>
      <Thumb style={styles.hThumb} uri={data.thumbUrl} borderRadius={s(14)} />
      <Text style={styles.hTitle} numberOfLines={2}>
        {data.title}
      </Text>
    </TouchableOpacity>
  );
}

function Meta({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={s(14)} color={SECTION} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function Thumb({ uri, style, borderRadius }: { uri?: string; style: any; borderRadius: number }) {
  if (uri) {
    return <Image source={{ uri }} style={[style, { borderRadius }]} resizeMode="cover" />;
  }
  return <View style={[style, { borderRadius, backgroundColor: THUMB_BG }]} />;
}

/* ================= styles ================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  content: {
    paddingBottom: s(24),
  },

  topBar: {
    position: 'relative',
  },

  logo: {
    position: 'absolute',
    left: s(FIGMA_LOGO_L),
    right: s(FIGMA_LOGO_R),
    textAlign: 'center',
    fontSize: s(18),
    fontWeight: '900',
    color: BRAND,
  },

  profileBtn: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cta: {
    position: 'absolute',
    borderRadius: s(16),
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: s(4) },
    elevation: 3,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: s(17),
  },

  createPanelWrap: {
    paddingHorizontal: s(18),
    marginTop: s(14),
    marginBottom: s(6),
  },

  createPanel: {
    backgroundColor: CARD,
    borderRadius: s(18),
    padding: s(12),
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: s(10),
    shadowOffset: { width: 0, height: s(4) },
    elevation: 3,
  },

  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF3F2',
    borderRadius: s(12),
    paddingLeft: s(12),
    paddingRight: s(8),
    height: s(40),
  },

  createInput: {
    flex: 1,
    fontSize: s(12),
    fontWeight: '700',
    color: '#2F3F3E',
  },

  createClose: {
    width: s(32),
    height: s(32),
    alignItems: 'center',
    justifyContent: 'center',
  },

  oembedHint: {
    marginTop: s(10),
    paddingHorizontal: s(6),
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.8,
  },
  homeFeedHint: {
    marginTop: s(10),
    marginLeft: s(28),
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.8,
  },
  oembedError: {
    marginTop: s(10),
    paddingHorizontal: s(6),
    fontSize: s(12),
    fontWeight: '900',
    color: '#D14B4B',
  },
  oembedPreview: {
    marginTop: s(12),
    flexDirection: 'row',
    gap: s(10),
    paddingHorizontal: s(6),
    alignItems: 'center',
  },
  oembedThumb: {
    width: s(88),
    height: s(50),
    backgroundColor: THUMB_BG,
  },
  oembedTitle: {
    fontSize: s(12),
    fontWeight: '900',
    color: SECTION,
    lineHeight: s(16),
  },
  oembedChannel: {
    marginTop: s(4),
    fontSize: s(11),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.75,
  },

  createBullet: {
    fontSize: s(13),
    fontWeight: '700',
    color: '#3B4F3E',
    lineHeight: s(16),
    marginTop: s(10),
  },

  createDoneBtn: {
    flex: 1,
    height: s(44),
    borderRadius: s(14),
    backgroundColor: '#2F3F3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createNotice: {
    marginTop: s(10),
    paddingHorizontal: s(6),
  },

  createGhostBtn: {
    flex: 1,
    height: s(44),
    borderRadius: s(14),
    backgroundColor: '#EEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  createGhostText: {
    color: '#2F3F3E',
    fontSize: s(13),
    fontWeight: '900',
  },

  createDoneText: {
    color: '#FFFFFF',
    fontSize: s(14),
    fontWeight: '900',
  },

  question: {
    marginLeft: s(28),
    marginBottom: s(12),
    fontSize: s(15),
    fontWeight: '900',
    color: Q_TITLE,
  },

  categoryList: {
    paddingLeft: s(20),
    paddingRight: s(20),
    paddingBottom: s(12),
  },
  categoryItem: {
    width: s(82),
    alignItems: 'center',
  },
  categoryImg: {
    width: s(80),
    height: s(80),
  },
  categoryText: {
    marginTop: s(2),
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
  },

  sectionHeader: {
    marginTop: s(14),
    marginBottom: s(10),
    paddingLeft: s(28),
    paddingRight: s(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: s(15),
    fontWeight: '900',
    color: Q_TITLE,
  },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  moreText: {
    fontSize: s(11),
    fontWeight: '800',
    color: SECTION,
    includeFontPadding: false,
    lineHeight: s(14),
  },
  moreArrow: {
    fontSize: s(11),
    fontWeight: '900',
    color: SECTION,
    includeFontPadding: false,
    lineHeight: s(14),
  },

  hVideoCard: {
    width: H_CARD_W,
    backgroundColor: 'transparent',
  },
  hThumb: {
    width: H_CARD_W,
    height: H_THUMB_H,
  },
  hTitle: {
    marginTop: s(10),
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    lineHeight: s(16),
  },

  recentHeader: {
    marginTop: s(22),
    marginBottom: s(12),
    marginLeft: s(28),
    fontSize: s(15),
    fontWeight: '900',
    color: Q_TITLE,
  },
  recentBox: {
    paddingLeft: s(18),
    paddingRight: s(18),
  },
  recentCard: {
    backgroundColor: CARD,
    borderRadius: s(18),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: s(6),
    shadowOffset: { width: 0, height: s(2) },
    elevation: 2,
  },
  recentInner: {
    flexDirection: 'row',
    gap: s(12),
    paddingLeft: s(11),
    paddingTop: s(10),
    paddingRight: s(11),
    paddingBottom: s(14),
  },

  recentLeft: {
    width: '45%',
  },
  recentThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  timeAgoLeft: {
    marginTop: s(6),
    paddingLeft: s(8),
    fontSize: s(11),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.75,
  },

  recentRight: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: s(2),
  },

  recentTitle: {
    fontSize: s(14),
    fontWeight: '900',
    color: SECTION,
    lineHeight: s(18),
    minHeight: s(36),
  },

  channelRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  channelAvatar: {
    width: s(18),
    height: s(18),
  },
  channelName: {
    fontSize: s(11),
    fontWeight: '800',
    color: SECTION,
    flexShrink: 1,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    flexWrap: 'nowrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: s(2) },
  metaText: { fontSize: s(11), fontWeight: '700', color: SECTION },
  priceText: { marginLeft: 'auto', fontSize: s(11), fontWeight: '900', color: SECTION },

  userTag: {
    fontSize: s(11),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.75,
    alignSelf: 'flex-end',
  },

  createButtonsWrap: {
    marginTop: s(16),
  },

  createActionRow: {
    flexDirection: 'row',
    gap: s(10),
  },

  createDoneBtnFull: {
    height: s(44),
    borderRadius: s(14),
    backgroundColor: '#2F3F3E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    paddingLeft: s(28),
    fontSize: s(12),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.7,
  },
});