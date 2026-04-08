import React, { useEffect, useRef, useState } from 'react';
import { getTrendingRecipes, TrendingRecipe } from '../lib/api';
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
  channelProfileUrl?: string;
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
    channelProfileUrl: item.channel_profile_url || '',
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
    channelProfileUrl: item.channel_profile_url || '',
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
  const [trendingRecipes, setTrendingRecipes] = useState<HomeRecipeItem[]>([]);

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

      const [historyResult, recommendResult, trendingResult] = await Promise.allSettled([
        currentUserId ? getUserHistory(currentUserId, 50) : Promise.resolve([]),
        getRecommendationsByCategory(recommendCategory),
        getTrendingRecipes(10), // 여기서 세 번째로 요청을 보내고 있으므로 위에서도 세 번째 변수로 받아야 함
      ]);

      // 1. 히스토리 처리
      if (historyResult.status === 'fulfilled') {
        const allHistory = normalizeUserHistory(historyResult.value).map(mapHistoryItemToHome);
        setMyRecipes(allHistory.slice(0, 10));
        setRecentRecipes(allHistory.slice(0, 5));
      }

      // 2. 추천 레시피 처리
      if (recommendResult.status === 'fulfilled') {
        const recommendItems = normalizeRecommendations(recommendResult.value).map(mapRecommendationItemToHome);
        setRecommendRecipes(recommendItems.slice(0, 10));
      }

      if (trendingResult.status === 'fulfilled') {
        const trendingItems = (trendingResult.value as TrendingRecipe[]).map(item => ({
          id: `trending-${item.video_id}`,
          source: 'recommend' as const,
          videoId: item.video_id,
          url: item.url,
          title: item.title,
          channelName: item.channel_name,
          thumbUrl: item.thumbnail_url,
          likeCount: String(item.like_count || '0'),
          commentCount: String(item.comment_count || '0'),
          shareCount: String(item.share_count || '0'),
          recipeData: null,
        }));
        setTrendingRecipes(trendingItems);
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
      <View style={[styles.topBar, { height: s(150)}]}>
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


      </View>

      {showCreatePanel && (
        <View style={styles.createPanelWrap}>
          <View style={styles.createPanel}>
            {/* 닫기 버튼 (우측 상단) */}
            <TouchableOpacity
              onPress={handleClosePanel}
              style={styles.createCloseNew}
            >
              <Ionicons name="close-circle" size={24} color="#D1D1D1" />
            </TouchableOpacity>

            {/* 입력창 (중앙 정렬) */}
            <TextInput
              value={link}
              onChangeText={handleLinkChange}
              placeholder="링크를 붙여넣으면 AI가 레시피로 정리해줘요!"
              placeholderTextColor="#9AA8A7"
              style={styles.createInputNew}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* 안내 문구 (불렛 포인트) */}
            <View style={styles.createNoticeNew}>
              <Text style={styles.createBulletNew}>• 지원 가능: 유튜브</Text>
              <Text style={styles.createBulletNew}>• 30분 이상 영상 길이는 분석이 불가능해요</Text>
              <Text style={styles.createBulletNew}>• 분석에는 약 3분의 시간이 걸립니다</Text>
            </View>

            {/* 상태 메시지 (로딩/에러) */}
            {oembedLoading || analyzeLoading ? (
              <Text style={styles.statusHint}>레시피 분석 중...</Text>
            ) : null}
            {!!(oembedError || analyzeError) && (
              <Text style={styles.statusError}>{oembedError || analyzeError}</Text>
            )}

            {/* 완료 버튼 */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.createDoneBtnNew, (analyzeLoading || !link) && { opacity: 0.5 }]}
              onPress={handleDone}
              disabled={analyzeLoading || !link}
            >
              <Text style={styles.createDoneTextNew}>
                {analyzeLoading ? '분석 중...' : '완료'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* 1. 카테고리 섹션 (맨 위로 올림) */}
      <Text style={[styles.question, { marginTop: s(20) }]}>어떤 요리 찾고 있어요?</Text>
      <FlatList
        horizontal
        data={CATEGORIES}
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
            onPress={() =>
              router.push(`/category/${encodeURIComponent(String(item.key || index))}`)
            }
          >
            <Image source={item.icon} style={styles.categoryImg} resizeMode="contain" />
            <Text style={styles.categoryText}>{item.key || '미지정'}</Text>
          </TouchableOpacity>
        )}
      />

      {/* 2. 메뉴 카드 섹션 */}
            <View style={styles.menuGrid}>
                    <View style={styles.leftColumn}>
                      <TouchableOpacity style={styles.menuCardSmall} onPress={() => router.push('/fridge-recipe')}>
                        <Text style={styles.menuTitle}>냉장고 파먹기</Text>
                        <Text style={styles.menuSubText}>냉장고 속 재료를 활용해{"\n"}요리를 만들어 보세요</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.menuCardSmall} onPress={() => router.push('/recommend-flow')}>
                        <Text style={styles.menuTitle}>메뉴 추천 받기</Text>
                        <Text style={styles.menuSubText}>메뉴가 고민될 때 기분에{"\n"}따라 추천을 받아보세요</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.menuCardLarge} onPress={() => setShowCreatePanel(true)}>
                      <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: s(4) }}>
                        <Text style={styles.menuTitle}>레시피 만들기</Text>
                        <Text style={[styles.menuSubText, { marginTop: s(4) }]}>유튜브 링크로 레시피를 {"\n"}만들어 보세요</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

            {/* 3. 홈 피드 로딩 및 에러 메시지들 */}
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
              keyExtractor={(_, index) => `recommend-item-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: s(18), paddingRight: s(18) }}
              ItemSeparatorComponent={() => <View style={{ width: s(10) }} />}
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
                    <View style={styles.recentInner}>
                      <View style={styles.recentLeft}>
                        <Image source={{ uri: r.thumbUrl }} style={styles.recentThumb} borderRadius={s(13.5)} />
                        <Text style={styles.timeAgoLeft}>
                          {r.savedAt ? '최근 저장한 레시피' : 'Recipick 분석 완료'}
                        </Text>
                      </View>

                      <View style={styles.recentRight}>
                        <Text style={styles.recentTitle} numberOfLines={2}>
                          {r.title}
                        </Text>

<<<<<<< HEAD
                        <View style={styles.channelRow2}>
                          {/* 채널 아바타가 있으면 uri를 넣으세요 */}
                          <Image source={{ uri: r.channelProfileUrl }} style={styles.channelAvatar} borderRadius={999} />
                          <Text style={styles.channelName} numberOfLines={1}>
                            {r.channelName}
                          </Text>
                        </View>
=======
                  <View style={styles.channelRow2}>
                    <Thumb style={styles.channelAvatar} uri={r.channelProfileUrl || undefined} borderRadius={999} />
                    <Text style={styles.channelName} numberOfLines={1}>
                      {r.channelName}
                    </Text>
                  </View>
>>>>>>> 0b4c143bcf7059579d03328535c7ec1b39d71ff2

                        <View style={styles.metaRow}>
                          <Meta icon="heart-outline" text={String(r.likeCount || 0)} />
                          <Meta icon="chatbubble-outline" text={String(r.commentCount || 0)} />
                          <Meta icon="share-social-outline" text={String(r.shareCount || 0)} />
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
  content: { paddingBottom: s(24) },

  // --- 상단 로고 및 프로필 ---
  topBar: { position: 'relative' },
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

  // --- 🟢 레시피 만들기 팝업 (새 버전으로 통합) ---
  createPanelWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  createPanel: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: s(24),
    padding: s(24),
    paddingTop: s(44),
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  createCloseNew: {
    position: 'absolute',
    top: s(16),
    right: s(16),
  },
  createInputNew: {
    fontSize: s(14),
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
    paddingBottom: s(10),
    textAlign: 'center',
    marginBottom: s(24),
  },
  createNoticeNew: { marginBottom: s(32) },
  createBulletNew: {
    fontSize: s(13),
    color: '#64748B',
    lineHeight: s(22),
    fontWeight: '500',
  },
  createDoneBtnNew: {
    width: '100%',
    height: s(54),
    backgroundColor: '#1E2F2D',
    borderRadius: s(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  createDoneTextNew: { color: '#FFF', fontSize: s(16), fontWeight: '800' },
  statusHint: { color: BRAND, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  statusError: { color: '#EF4444', fontSize: 12, marginBottom: 10, textAlign: 'center' },

hVideoCard: {
    width: H_CARD_W, // s(229)
    marginRight: s(10),
  },
  hThumb: {
    width: H_CARD_W,
    height: H_THUMB_H, // s(127)
    backgroundColor: THUMB_BG,
  },
  hTitle: {
    marginTop: s(8),
    fontSize: s(14),
    fontWeight: '900',
    color: SECTION,
    lineHeight: s(18),
  },

  // --- 카테고리 섹션 ---
  question: {
    marginLeft: s(28),
    marginBottom: s(12),
    fontSize: s(15),
    fontWeight: '900',
    color: Q_TITLE,
  },
  categoryList: { paddingLeft: s(20), paddingRight: s(20), paddingBottom: s(12) },
  categoryItem: { width: s(82), alignItems: 'center' },
  categoryImg: { width: s(80), height: s(80) },
  categoryText: { marginTop: s(2), fontSize: s(12), fontWeight: '800', color: SECTION },

  // --- 메뉴 그리드 ---
  menuGrid: {
    flexDirection: 'row',
    paddingHorizontal: s(28),
    marginTop: s(20),
    justifyContent: 'space-between',
    gap: s(12),
  },
  leftColumn: { flex: 1, gap: s(12) },
  menuCardSmall: {
    height: s(100),
    backgroundColor: CARD,
    borderRadius: s(16),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: s(16),
    justifyContent: 'center',
  },
  menuCardLarge: {
    flex: 1,
    height: s(212),
    backgroundColor: CARD,
    borderRadius: s(16),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: s(16),
    position: 'relative',
  },
  menuTitle: { fontSize: s(16), fontWeight: '900', color: SECTION, marginBottom: s(4) },
  menuSubText: { fontSize: s(12), fontWeight: '600', color: SECTION, opacity: 0.5, lineHeight: s(16) },

  // --- 피드 및 기타 ---
  sectionHeader: {
    marginTop: s(14),
    marginBottom: s(10),
    paddingHorizontal: s(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: s(15), fontWeight: '900', color: Q_TITLE },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  moreText: { fontSize: s(11), fontWeight: '800', color: SECTION },
  moreArrow: { fontSize: s(11), fontWeight: '900', color: SECTION },

  recentBox: { paddingHorizontal: s(18) },
  recentCard: {
    backgroundColor: CARD,
    borderRadius: s(18),
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: s(6),
  },
  recentInner: { flexDirection: 'row', gap: s(12), padding: s(12) },
  recentLeft: { width: '45%' },
  recentThumb: { width: '100%', aspectRatio: 16 / 9 },
  recentRight: { flex: 1, justifyContent: 'space-between' },
  recentTitle: { fontSize: s(14), fontWeight: '900', color: SECTION, lineHeight: s(18), minHeight: s(36) },

  channelRow2: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  channelAvatar: { width: s(18), height: s(18) },
  channelName: { fontSize: s(11), fontWeight: '800', color: SECTION },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: s(2) },
  metaText: { fontSize: s(11), fontWeight: '700', color: SECTION },
  priceText: { marginLeft: 'auto', fontSize: s(11), fontWeight: '900', color: SECTION },

  emptyText: { paddingLeft: s(28), fontSize: s(12), fontWeight: '700', color: SECTION, opacity: 0.7 },
  homeFeedHint: { marginTop: s(10), marginLeft: s(28), fontSize: s(12), color: SECTION },
  timeAgoLeft: { marginTop: s(6), fontSize: s(11), color: SECTION, opacity: 0.75 },
});