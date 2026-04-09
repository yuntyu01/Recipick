import React, { useEffect, useRef, useState } from 'react';
import { getLatestRecipes, LatestRecipe } from '../lib/api';
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
  View,
  ActivityIndicator,
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

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${Math.floor(diffMonth / 12)}년 전`;
}

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
    title: item.title || '제목 없음',
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
    // SecureStore에 저장된 userId를 먼저 확인
    const storedId = await SecureStore.getItemAsync('userId');
    if (storedId) return storedId;

    // 없으면 백엔드에서 가져옴
    const token = await getAccessToken();
    if (!token) return null;

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

      const [historyResult, recommendResult, latestResult] = await Promise.allSettled([
        currentUserId ? getUserHistory(currentUserId, 50) : Promise.resolve([]),
        getRecommendationsByCategory(recommendCategory),
        getLatestRecipes(10),
      ]);

      // 1. 히스토리 처리
      if (historyResult.status === 'fulfilled') {
        const allHistory = normalizeUserHistory(historyResult.value).map(mapHistoryItemToHome);
        setMyRecipes(allHistory.slice(0, 10));
      }

      // 2. 추천 레시피 처리
      if (recommendResult.status === 'fulfilled') {
        const recommendItems = normalizeRecommendations(recommendResult.value).map(mapRecommendationItemToHome);
        setRecommendRecipes(recommendItems.slice(0, 10));
      }

      // 3. 최신 레시피 처리
      if (latestResult.status === 'fulfilled') {
        const latestItems = (latestResult.value as LatestRecipe[]).map(item => ({
          id: `latest-${item.video_id}`,
          source: 'recommend' as const,
          videoId: item.video_id,
          url: item.url,
          title: item.title,
          channelName: item.channel_name,
          channelProfileUrl: item.channel_profile_url || '',
          thumbUrl: item.thumbnail_url,
          recipeData: null,
          savedAt: item.created_at || '',
        }));
        setRecentRecipes(latestItems);
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
              const dataWithVideoId = { ...finalRes.data, video_id: finalRes.video_id ?? videoId };
              await createUserHistorySafe(currentId, dataWithVideoId);
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
    if (!resolvedUserId) return;

    try {
      const payload = buildUserHistoryPayloadFromRecipe(recipe);
      console.log('[서버 저장 시도]:', payload.title);
      const response = await createUserHistory(resolvedUserId, payload);
      console.log('[저장 성공]:', response);
    } catch (error: any) {
      console.warn('[저장 실패]:', error.message);
    }
  };

  return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- 🟢 [새로운] 상단 통합 영역 (시안 반영) --- */}
        <View style={styles.topSectionFull}>
          <View style={{ height: insets.top }} />
            <View style={styles.navRow}>
            <View style={{ width: s(40) }} /> {/* 로고 중앙 정렬을 위한 왼쪽 빈 공간 */}
            <Text style={styles.logoInline}>Recipick!</Text>
            <TouchableOpacity
              onPress={() => router.push('/mypage')}
              hitSlop={10}
              style={styles.profileBtnInline}
            >
              <Ionicons name="person" size={s(20)} color="#000" />
            </TouchableOpacity>
          </View>

          {/* (C) 질문 텍스트 */}
          <Text style={styles.questionInline}>어떤 요리 찾고 있어요?</Text>

          {/* (D) 카테고리 가로 스크롤 */}
          <FlatList
            horizontal
            data={CATEGORIES}
            keyExtractor={(item) => `cat-${item.key}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryListInline}
            ItemSeparatorComponent={() => <View style={{ width: s(6) }} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.categoryItemInline}
                onPress={() => router.push(`/category/${encodeURIComponent(String(item.key))}`)}
              >
                <Image source={item.icon} style={styles.categoryImgInline} resizeMode="contain" />
                <Text style={styles.categoryTextInline}>{item.key}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* --- 메뉴 그리드 영역 --- */}
        <View style={styles.menuSectionWrap}>
          <View style={styles.menuGridNew}>
            <View style={styles.menuLeftNew}>
              {/* 1. 냉장고 파먹기 */}
              <TouchableOpacity style={styles.menuCardNew} onPress={() => router.push('/fridge-recipe')}>
                <Text style={styles.menuTitleNew}>냉장고 파먹기</Text>
                <Text style={styles.menuSubTextNew}>냉장고 속 재료를 활용해{"\n"}요리를 만들어 보세요</Text>
              </TouchableOpacity>

              {/* 2. 메뉴 추천 받기 */}
              <TouchableOpacity style={styles.menuCardNew} onPress={() => router.push('/recommend-flow')}>
                <Text style={styles.menuTitleNew}>메뉴 추천 받기</Text>
                <Text style={styles.menuSubTextNew}>메뉴가 고민될 때 기분에{"\n"}따라 추천을 받아보세요</Text>
              </TouchableOpacity>
            </View>

            {/* 3. 레시피 만들기 */}
            <TouchableOpacity style={styles.menuCardLargeNew} onPress={() => setShowCreatePanel(!showCreatePanel)}>
              <Text style={styles.menuTitleNew}>레시피 만들기</Text>
              <Text style={[styles.menuSubTextNew, { marginTop: s(10) }]}>유튜브 링크로 레시피를{"\n"}만들어 보세요</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ [image_744b60.png 디자인 반영] 레시피 만들기 Inline 버전 */}
        {showCreatePanel && (
          <View style={styles.createPanelWrapInline}>
            <View style={styles.createPanelInline}>
              <TouchableOpacity onPress={handleClosePanel} style={styles.createCloseNewInline}>
                <Ionicons name="close-circle" size={24} color="#D1D1D1" />
              </TouchableOpacity>

              <TextInput
                value={link}
                onChangeText={handleLinkChange}
                placeholder="링크를 붙여넣으면 AI가 레시피로 정리해줘요!"
                placeholderTextColor="#9AA8A7"
                style={styles.createInputNewInline}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* 유튜브 미리보기 영역 */}
              {oembedLoading ? (
                <View style={[styles.previewBox, { justifyContent: 'center' }]}>
                  <ActivityIndicator color={BRAND} size="small" />
                </View>
              ) : videoMeta ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.previewBox}
                  onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoMeta.videoId}`)}
                >
                  <View style={styles.previewThumbContainer}>
                    <Image source={{ uri: videoMeta.thumbnailUrl }} style={styles.previewThumbLarge} />
                    <View style={styles.playIconOverlay}>
                      <Ionicons name="play-circle" size={30} color="white" />
                    </View>
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewTitleLarge} numberOfLines={2}>{videoMeta.title}</Text>
                    <Text style={styles.previewChannelLarge}>{videoMeta.channelName}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <View style={styles.createNoticeNewInline}>
                <Text style={styles.createBulletNewInline}>• 지원 가능: 유튜브</Text>
                <Text style={styles.createBulletNewInline}>• 30분 이상 영상은 분석이 불가능해요</Text>
                <Text style={styles.createBulletNewInline}>• 분석에는 약 3분의 시간이 걸립니다</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.createDoneBtnNewInline, (analyzeLoading || !link) && { opacity: 0.5 }]}
                onPress={handleDone}
                disabled={analyzeLoading || !link}
              >
                <Text style={styles.createDoneTextNewInline}>{analyzeLoading ? '분석 중...' : '완료'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. 홈 피드 리스트 */}


        {/* --- 🟢 [새로운] 레시피 통합 블록 (나의 레시피 + 인기 레시피) --- */}
        <View style={styles.combinedRecipeBlock}>

          {/* (A) 나의 레시피 섹션 */}
          <View style={styles.innerSection}>
            <View style={styles.recipeHeaderRow}>
              <Text style={styles.recipeSectionTitle}>나의 레시피</Text>
              <TouchableOpacity onPress={() => router.push('/my-recipes')}>
                <Text style={styles.recipeMoreText}>더보기 &gt;</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={myRecipes}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipeListContent}
              ItemSeparatorComponent={() => <View style={{ width: s(10) }} />}
              renderItem={({ item }) => (
                <HorizontalVideoCard data={item} onPress={() => goToRecipeDetail(item)} />
              )}
            />
          </View>

          {/* 섹션 사이 간격 조절용 선 (선택 사항) */}
          <View style={{ height: s(25) }} />

          {/* (B) 인기 레시피 섹션 */}
          <View style={styles.innerSection}>
            <View style={styles.recipeHeaderRow}>
              <Text style={styles.recipeSectionTitle}>인기 레시피</Text>
              <TouchableOpacity onPress={() => router.push(`/category/${encodeURIComponent('한식')}`)}>
                <Text style={styles.recipeMoreText}>더보기 &gt;</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={recommendRecipes}
              keyExtractor={(_, index) => `recommend-item-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipeListContent}
              ItemSeparatorComponent={() => <View style={{ width: s(10) }} />}
              renderItem={({ item }) => (
                <HorizontalVideoCard data={item} onPress={() => goToRecipeDetail(item)} />
              )}
            />
          </View>
        </View>

        {/* --- 3. 최근 레시피 섹션 통합 블록 --- */}
        <View style={styles.recentSectionBlock}>
          {/* (A) 상단 헤더: 제목과 더보기 */}
          <View style={styles.recentHeaderRow}>
            <Text style={styles.sectionTitle}>최근 레시피</Text>
            <TouchableOpacity onPress={() => router.push('/my-recipes')}>
              <Text style={styles.moreText}>더보기 &gt;</Text>
            </TouchableOpacity>
          </View>

          {/* (B) 가장 최신 레시피 (배열의 0번째 항목) */}
          {recentRecipes.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.recentSingleCard}
              onPress={() => goToRecipeDetail(recentRecipes[0])}
            >
              <View style={styles.recentInner}>
                <View style={styles.recentLeft}>
                  <Image source={{ uri: recentRecipes[0].thumbUrl }} style={styles.recentThumb} />
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentTitle} numberOfLines={2}>{recentRecipes[0].title}</Text>
                  <View style={styles.channelRow2}>
                    <Text style={styles.channelName}>{recentRecipes[0].channelName}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* (C) 나머지 최근 레시피 리스트 (1번째 항목부터 끝까지) */}
        <View style={styles.recentBox}>
          {recentRecipes.slice(1).map((r) => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.92}
              style={styles.recentCard}
              onPress={() => goToRecipeDetail(r)}
            >
              <View style={styles.recentInner}>
                <View style={styles.recentLeft}>
                  <Image source={{ uri: r.thumbUrl }} style={styles.recentThumb} borderRadius={s(13.5)} />
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentTitle} numberOfLines={2}>{r.title}</Text>
                  <View style={styles.channelRow2}>
                    <Text style={styles.channelName}>{r.channelName}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
      {/* 여기서 onPressRight가 전달되지 않으면 버튼을 눌러도 아무 반응이 없습니다 */}
      <TouchableOpacity onPress={onPressRight} style={styles.moreBtn}>
        <Text style={styles.moreText}>더보기 &gt;</Text>
      </TouchableOpacity>
    </View>
  );
}

function HorizontalVideoCard({ data, onPress }: { data: HomeRecipeItem; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.hVideoCard} onPress={onPress}>
      <Image source={{ uri: data.thumbUrl }} style={styles.hThumb} borderRadius={s(14)} />
      <Text style={styles.hTitle} numberOfLines={2}>{data.title}</Text>
    </TouchableOpacity>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: s(24) },
  topBar: { position: 'relative' },
  logo: {
    position: 'absolute',
    left: 0, right: 0,
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
    backgroundColor: '#FFF',
  },

  // --- 카테고리 섹션 ---
  question: {
    fontSize: s(20),
    fontWeight: '900',
    color: Q_TITLE,
    marginLeft: s(28),
    marginBottom: s(20),
  },
  categoryList: {
    paddingHorizontal: s(20), // 전체 리스트의 좌우 여백
  },
  categoryItem: {
    alignItems: 'center',
    justifyContent: 'center',
    // width: s(70) 대신 가변 너비를 사용하고 마진으로 간격 고정
    marginHorizontal: s(2),
  },
  categoryImg: {
    width: s(84),
    height: s(84),
    resizeMode: 'contain',
  },
  categoryText: {
    fontSize: s(14), // 글씨도 조금 더 키우는게 균형이 맞아요
    fontWeight: '800',
    color: SECTION,
    marginTop: s(4),
  },

  // --- 메뉴 그리드 ---
  menuGrid: {
    flexDirection: 'row',
    paddingHorizontal: s(28),
    gap: s(12),
    marginTop: s(24),
  },
  leftColumn: { flex: 1, gap: s(12) },
  menuCardSmall: {
    backgroundColor: CARD,
    borderRadius: s(24),
    padding: s(16),
    height: s(100),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  menuCardLarge: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: s(24),
    padding: s(16),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  menuTitle: { fontSize: s(16), fontWeight: '900', color: SECTION },
  menuSubText: { fontSize: s(11), fontWeight: '700', color: SECTION, opacity: 0.5, lineHeight: s(15) },

  /* --- 🟢 레시피 만들기 Inline 스타일 (강화 버전 통합) --- */
  createPanelWrapInline: {
    marginHorizontal: s(10),
    marginTop: s(10),
    marginBottom: s(10),
  },
  createPanelInline: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: s(24),
    padding: s(20),
    paddingTop: s(40),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  createCloseNewInline: {
    position: 'absolute',
    top: s(14),
    right: s(14),
  },
  createInputNewInline: {
    fontSize: s(14),
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
    paddingBottom: s(10),
    textAlign: 'center',
    marginBottom: s(20),
  },
  // 강화된 미리보기 박스
  previewBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFB',
    borderRadius: s(16),
    padding: s(12),
    marginBottom: s(20),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: s(100),
  },
  previewThumbContainer: { position: 'relative' },
  previewThumbLarge: {
    width: s(120),
    height: s(67.5),
    borderRadius: s(10),
    backgroundColor: '#DDE6E6',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: s(10),
  },
  previewInfo: {
    flex: 1,
    marginLeft: s(14),
    justifyContent: 'center',
  },
  previewTitleLarge: {
    fontSize: s(14),
    fontWeight: '900',
    color: '#3B4F4E',
    lineHeight: s(19),
    marginBottom: s(6),
  },
  previewChannelLarge: {
    fontSize: s(12),
    fontWeight: '700',
    color: '#8A9B9A',
  },
  createNoticeNewInline: { marginBottom: s(20) },
  createBulletNewInline: {
    fontSize: s(15),
    color: '#475569',
    lineHeight: s(22),
  },
  createDoneBtnNewInline: {
    width: '100%',
    height: s(50),
    backgroundColor: '#1E2F2D',
    borderRadius: s(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  createDoneTextNewInline: { color: '#FFF', fontSize: s(15), fontWeight: '800' },

  /* --- 기타 피드 스타일 --- */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: s(28),
    marginTop: s(14),
    marginBottom: s(12),
  },
  sectionTitle: { fontSize: s(16), fontWeight: '900', color: Q_TITLE },
  moreBtn: { justifyContent: 'center' },
  moreText: { fontSize: s(12), color: SECTION, fontWeight: '700' },
  hVideoCard: { width: s(200), marginLeft: s(10) },
  hThumb: { width: s(200), height: s(112) },
  hTitle: { fontSize: s(14), fontWeight: '800', color: SECTION, marginTop: s(8) },
  recentBox: { paddingHorizontal: s(28), gap: s(12) },
  recentCard: { backgroundColor: CARD, borderRadius: s(18), padding: s(12) },
  recentInner: { flexDirection: 'row', gap: s(12) },
  recentLeft: { width: s(120) },
  recentThumb: { width: '100%', aspectRatio: 16 / 9 },
  recentRight: { flex: 1, justifyContent: 'center' },
  recentTitle: { fontSize: s(14), fontWeight: '900', color: SECTION, lineHeight: s(18) },
  channelRow2: { marginTop: s(4) },
  channelName: { fontSize: s(11), fontWeight: '800', color: SECTION, opacity: 0.6 },

  /* --- 통합 블록 스타일 --- */
    recentSectionBlock: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: s(20),
      borderRadius: s(24),
      padding: s(20),
      marginTop: s(24),
      marginBottom: s(12), // 밑에 깔리는 리스트와의 간격
      borderWidth: 1.5,
      borderColor: '#E2E8F0',
    },
    recentHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: s(16),
    },
    /* --- 1. 최근 레시피 통합 블록 (맨 위 묶음) --- */
      recentSectionBlock: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: s(10), // 전체 화면에서의 여백 (다른 블록과 통일)
        borderRadius: s(24),
        paddingTop: s(20),
        paddingBottom: s(20),
        paddingHorizontal: s(16), // 내부 여백을 살짝 줄여서 이미지 위치 조정
        marginTop: s(14),
        marginBottom: s(8),
      },
      recentHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: s(15),
        paddingHorizontal: s(4), // 제목 글자 위치를 이미지 선에 맞춤
      },
      recentSingleCard: {
        backgroundColor: 'transparent',
        padding: 0,
      },

      /* --- 2. 하단 개별 리스트 (아래 나열되는 것들) --- */
      recentBox: {
        paddingHorizontal: s(10), // 위 블록의 marginHorizontal과 동일하게 설정
        gap: s(8),
      },
      recentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: s(24), // 위 블록과 동일한 곡률
        padding: s(16),
      },

      /* --- 3. 공통 요소 (위아래 위치를 맞추는 핵심) --- */
      recentInner: {
        flexDirection: 'row',
        gap: s(12),
        alignItems: 'center',
      },
      recentLeft: {
        width: s(120), // 위아래 썸네일 너비를 동일하게 고정
      },
      recentThumb: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: s(12),
      },
      recentRight: {
        flex: 1,
        justifyContent: 'center',
      },

  /* topSectionBlock을 위한 스타일 정의 */
 /* StyleSheet.create 내부 */

   topSectionBlock: {
     backgroundColor: '#FFFFFF',
     marginHorizontal: s(20),
     borderRadius: s(28),
     paddingTop: s(25),      // 상단 여백을 좀 더 주어 위치 조정
     paddingBottom: s(25),
     marginTop: s(50),       // 1번 요청: 블록 전체를 아까 위치만큼 아래로 내림
     marginBottom: s(20),
     elevation: 3,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.08,
     shadowRadius: 8,
     overflow: 'hidden',     // 내부 내용이 넘치지 않게
   },
   navRow: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingHorizontal: s(20),
     marginBottom: s(30),    // 질문과의 간격
   },
   logoInline: {
     fontSize: s(20),
     fontWeight: '900',
     color: BRAND,
     textAlign: 'center',
   },
   profileBtnInline: {       // 2번 요청: 프로필 버튼 스타일
     width: s(40),
     height: s(40),
     borderRadius: s(20),
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: '#F3F6F6',
   },
   questionInline: {
     fontSize: s(22),
     fontWeight: '900',
     color: Q_TITLE,
     paddingHorizontal: s(24),
     marginBottom: s(20),
   },
   // 3번 요청: 가로 스크롤용 카테고리 스타일
   categoryListInline: {
     paddingHorizontal: s(20),
     paddingBottom: s(5),
   },
   categoryItemInline: {
     alignItems: 'center',
     justifyContent: 'center',
     width: s(85),           // 한 줄에 적당히 보이도록 너비 고정
   },
   categoryImgInline: {
     width: s(75),
     height: s(75),
   },
   categoryTextInline: {
     fontSize: s(13),
     fontWeight: '800',
     color: SECTION,
     marginTop: s(4),
   },
/* StyleSheet.create 내부 스타일 정의 */

  screen: { flex: 1, backgroundColor: BG }, // BG 색상은 약간 회색빛 도는 '#F3F6F6' 유지
  content: { paddingBottom: s(24) },

  // --- 🟢 [새로운] 시안 반영 상단 통합 영역 스타일 ---
  topSectionFull: {
    backgroundColor: '#FFFFFF', // 맨 위부터 카테고리까지 전체가 흰색
    paddingBottom: s(25),      // 카테고리 아래 여백
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(20),
    marginTop: s(15),          // 상태바 아래 간격
    marginBottom: s(30),       // 질문과의 간격
  },
  logoInline: {
    fontSize: s(20),
    fontWeight: '900',
    color: BRAND,              // 민트색 로고
    textAlign: 'center',
  },
  profileBtnInline: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6F6', // 약간 회색 배경으로 버튼 강조
  },
  questionInline: {
    fontSize: s(18),           // 시안처럼 조금 작게 조정
    fontWeight: '900',
    color: Q_TITLE,
    paddingHorizontal: s(28),
    marginBottom: s(10),
  },
  categoryListInline: {
    paddingHorizontal: s(20),
    paddingBottom: s(5),
  },
  categoryItemInline: {
    alignItems: 'center',
    justifyContent: 'center',
    width: s(85),              // 가로 스크롤에 맞는 너비 고정
  },
  categoryImgInline: {
    width: s(75),
    height: s(75),
  },
  categoryTextInline: {
    fontSize: s(13),
    fontWeight: '800',
    color: SECTION,
    marginTop: s(4),
  },

  // --- 🟢 [새로운] 메뉴 그리드 영역 스타일 (시안 반영) ---
  menuSectionWrap: {
    backgroundColor: BG,       // 하단은 투명하거나 BG 색상 (카드가 돋보이게)
    paddingVertical: s(10),    // 상단 흰색 영역과의 간격
  },
  menuGridNew: {
    flexDirection: 'row',
    paddingHorizontal: s(10),
    gap: s(8),
  },
  menuLeftNew: { flex: 1, gap: s(10) },
  menuCardNew: {
      backgroundColor: CARD,
      borderRadius: s(24),
      padding: s(16),
      height: s(110),
      borderWidth: 0,
      borderColor: 'transparent',
      // ----------------------
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
  menuCardLargeNew: {
      flex: 1,
      backgroundColor: CARD,
      borderRadius: s(24),
      padding: s(16),
      height: s(232),
      borderWidth: 0,
      borderColor: 'transparent',
      // ----------------------
      justifyContent: 'flex-start',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
  menuTitleNew: {
    fontSize: s(16),
    fontWeight: '900',
    color: '#000', // 시안처럼 검은색 글씨
  },
  mintText: { color: BRAND },  // 제목 내의 민트색 텍스트
  menuSubTextNew: {
    fontSize: s(11),
    fontWeight: '600',
    color: SECTION,
    opacity: 0.5,
    lineHeight: s(15),
    marginTop: s(4),
  },

/* StyleSheet.create 내부 스타일 정의 */

  /* StyleSheet.create 내부 스타일 정의 */

    // --- 🟢 두 섹션을 하나로 묶는 큰 흰색 박스 ---
    combinedRecipeBlock: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: s(10),  // 양 끝 여백 통일
      borderRadius: s(24),
      paddingVertical: s(25),   // 내부 상하 여백
      marginHorizontal: 0,
      borderWidth: 0,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },

    innerSection: {
      // 개별 섹션 스타일 (필요시 추가 여백 조정)
    },

    recipeHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: s(20),
      marginBottom: s(15),
    },

    recipeSectionTitle: {
      fontSize: s(16),
      fontWeight: '900',
      color: '#000',           // 제목 검은색 통일
    },

    recipeMoreText: {
      fontSize: s(12),
      color: '#8A9B9A',
      fontWeight: '700',
    },

    recipeListContent: {
      paddingHorizontal: s(10), // 리스트 시작 여백
    },
});