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
  sharerNickname?: string;
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
    totalEstimatedPrice: formatWon(item.total_estimated_price),
    likeCount: String(item.like_count ?? '0'),
    commentCount: String(item.comment_count ?? '0'),
    shareCount: String(item.share_count ?? '0'),
    recipeData: null,
  };
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [link, setLink] = useState('');

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

  const [userId, setUserId] = useState<string | null>(null);
  const [myRecipes, setMyRecipes] = useState<HomeRecipeItem[]>([]);
  const [recommendRecipes, setRecommendRecipes] = useState<HomeRecipeItem[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<HomeRecipeItem[]>([]);

  const [homeFeedLoading, setHomeFeedLoading] = useState(false);
  const [homeFeedError, setHomeFeedError] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const oembedTimer = useRef<any>(null);

  const getAccessToken = async () => {
    let token = null;
    if (Platform.OS === 'web') {
      token = localStorage.getItem('accessToken') || localStorage.getItem('access_token');
    } else {
      token =
        (await SecureStore.getItemAsync('accessToken')) ||
        (await SecureStore.getItemAsync('access_token'));
    }
    return token || null;
  };

  const getCurrentUserId = async () => {
    try {
      const storedId = await SecureStore.getItemAsync('userId');
      if (storedId) return storedId;

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
        setOembedError('유튜브 정보를 가져오지 못했어요.');
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
    url, videoId, title, channelName, thumbnailUrl, recipeData,
  }: {
    url: string; videoId: string; title: string; channelName: string; thumbnailUrl?: string; recipeData: any;
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

      const detail = await getRecipe(item.videoId);

      if (detail.status === 'COMPLETED' && detail.data) {
        if (userId) {
          try {
            await createUserHistorySafe(userId, detail.data);
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

      if (historyResult.status === 'fulfilled') {
        const allHistory = normalizeUserHistory(historyResult.value).map(mapHistoryItemToHome);
        setMyRecipes(allHistory.slice(0, 10));
      }

      if (recommendResult.status === 'fulfilled') {
        const recommendItems = normalizeRecommendations(recommendResult.value).map(mapRecommendationItemToHome);
        setRecommendRecipes(recommendItems.slice(0, 10));
      }

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
          sharerNickname: item.sharer_nickname || '',
          totalEstimatedPrice: formatWon(item.total_estimated_price),
          likeCount: String(item.like_count ?? '0'),
          commentCount: String(item.comment_count ?? '0'),
          shareCount: String(item.share_count ?? '0'),
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
        const resolvedUserId: string | null = await getCurrentUserId().catch(() => null);
        if (!mounted) return;
        setUserId(resolvedUserId);
        await loadHomeFeed(resolvedUserId || undefined);
      } catch (e: any) {
        if (!mounted) return;
        setHomeFeedError(e?.message || '사용자 정보를 불러오지 못했어요.');
        await loadHomeFeed();
      } finally {
        if (mounted) setHomeFeedLoading(false);
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
          resolvedUserId = null;
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

      const first = await analyzeRecipe(requestBody);
      const finalRes =
        first.status === 'PROCESSING'
          ? await waitRecipeCompleted(first.video_id, {
            intervalMs: 1500,
            timeoutMs: 180000,
          })
          : first;

      if (finalRes.status === 'FAILED') {
        setAnalyzeError('분석에 실패했어. 다른 링크로 다시 시도해줘.');
        return;
      }
      if (finalRes.status !== 'COMPLETED' || !finalRes.data) {
        setAnalyzeError('분석 결과가 아직 준비되지 않았어.');
        return;
      }

      try {
        let currentId = resolvedUserId || userId;
        if (!currentId) {
          currentId = await getCurrentUserId();
          setUserId(currentId);
        }
        if (currentId) {
          const dataWithVideoId = { ...finalRes.data, video_id: finalRes.video_id ?? videoId };
          await createUserHistorySafe(currentId, dataWithVideoId);
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
      setAnalyzeError(e?.message || '분석 요청 중 오류가 났어.');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const createUserHistorySafe = async (resolvedUserId: string, recipe: RecipeData) => {
    if (!resolvedUserId) return;
    try {
      const payload = buildUserHistoryPayloadFromRecipe(recipe);
      await createUserHistory(resolvedUserId, payload);
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
      <View style={styles.topSectionFull}>
        <View style={{ height: insets.top }} />
        <View style={styles.navRow}>
          <View style={{ width: s(40) }} />
          <Text style={styles.logoInline}>Recipick!</Text>
          <TouchableOpacity
            onPress={() => router.push('/mypage')}
            hitSlop={10}
            style={styles.profileBtnInline}
          >
            <Ionicons name="person" size={s(20)} color="#000" />
          </TouchableOpacity>
        </View>

        <Text style={styles.questionInline}>어떤 요리 찾고 있어요?</Text>

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
              <Image
                source={item.icon}
                style={[styles.categoryImgInline, item.key === '분식' && { marginLeft: s(-8) }]}
                resizeMode="contain"
              />
              <Text style={styles.categoryTextInline}>{item.key}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* --- 메뉴 영역 (여기서 높이를 강제 고정하여 절대 튀지 않게 만듭니다) --- */}
      <View style={styles.menuSectionWrap}>

        <View style={styles.menuGridContainer}>

          {/* 1. 바탕에 깔려있는 기존 메뉴 카드 3개 (높이 230px 고정) */}
          <View style={styles.menuGridNew}>
            <View style={styles.menuLeftNew}>
              <TouchableOpacity style={styles.menuCardNew} onPress={() => router.push('/fridge-recipe')}>
                <Text style={styles.menuTitleNew}><Text style={{ color: BRAND }}>냉장고</Text> 파먹기</Text>
                <Text style={styles.menuSubTextNew}>냉장고 속 재료를 활용해{"\n"}요리를 만들어 보세요</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuCardNew} onPress={() => router.push('/recommend-flow')}>
                <Text style={styles.menuTitleNew}><Text style={{ color: BRAND }}>메뉴</Text> 추천 받기</Text>
                <Text style={styles.menuSubTextNew}>메뉴가 고민될 때 기분에{"\n"}따라 추천을 받아보세요</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.menuCardLargeNew} onPress={() => setShowCreatePanel(!showCreatePanel)}>
              <Text style={styles.menuTitleNew}><Text style={{ color: BRAND }}>레시피</Text> 만들기</Text>
              <Text style={[styles.menuSubTextNew]}>유튜브 링크로 레시피를{"\n"}만들어 보세요</Text>
            </TouchableOpacity>
          </View>

          {/* 2. ✨ 레시피 만들기 패널 (메뉴와 완벽히 똑같은 230px 크기로 덮어씌움) */}
          {showCreatePanel && (
            <View style={styles.createPanelOverlay}>
              <View style={styles.createPanelInline}>

                {/* 상단: 텍스트 입력창 + X버튼 */}
                <View style={styles.inputRow}>
                  <TextInput
                    value={link}
                    onChangeText={handleLinkChange}
                    placeholder="링크를 붙여넣으면 AI가 레시피로 정리해줘요!"
                    placeholderTextColor="#9AA8A7"
                    style={styles.createInputNewInline}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={handleClosePanel} style={styles.createCloseNewInline} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                    <Ionicons name="close-circle" size={s(22)} color="#D1D1D1" />
                  </TouchableOpacity>
                </View>

                {/* 중단: ✨ 조건부 렌더링 (가운데 빈 공간을 썸네일 or 안내문구가 차지) */}
                <View style={styles.middleSection}>
                  {oembedLoading ? (
                    <View style={[styles.previewBox, { justifyContent: 'center' }]}>
                      <ActivityIndicator color={BRAND} size="small" />
                    </View>
                  ) : videoMeta ? (
                    // 유튜브 썸네일이 로딩되면 이 박스가 렌더링됨
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.previewBox}
                      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoMeta.videoId}`)}
                    >
                      <View style={styles.previewThumbContainer}>
                        <Image source={{ uri: videoMeta.thumbnailUrl }} style={styles.previewThumbLarge} />
                        <View style={styles.playIconOverlay}>
                          <Ionicons name="play-circle" size={s(24)} color="white" />
                        </View>
                      </View>
                      <View style={styles.previewInfo}>
                        <Text style={styles.previewTitleLarge} numberOfLines={2}>{videoMeta.title}</Text>
                        <Text style={styles.previewChannelLarge}>{videoMeta.channelName}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    // 초기 상태일 때는 이 안내 문구가 렌더링됨
                    <View style={styles.createNoticeNewInline}>
                      <Text style={styles.createBulletNewInline}>• 지원 가능: 유튜브</Text>
                      <Text style={styles.createBulletNewInline}>• 30분 이상 영상은 분석이 불가능해요</Text>
                      <Text style={styles.createBulletNewInline}>• 분석에는 약 3분의 시간이 걸립니다</Text>
                    </View>
                  )}
                </View>

                {/* 하단: 완료 버튼 */}
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
        </View>
      </View>

      <View style={styles.combinedRecipeBlock}>
        <View style={styles.innerSection}>
          <View style={styles.recipeHeaderRow}>
            <Text style={styles.recipeSectionTitle}><Text style={{ color: BRAND }}>나의</Text> 레시피</Text>
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

        <View style={{ height: s(25) }} />

        <View style={styles.innerSection}>
          <View style={styles.recipeHeaderRow}>
            <Text style={styles.recipeSectionTitle}><Text style={{ color: BRAND }}>인기</Text> 레시피</Text>
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

      <View style={styles.recentSectionBlock}>
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionTitle}><Text style={{ color: BRAND }}>최근</Text> 레시피</Text>
          <TouchableOpacity onPress={() => router.push('/my-recipes')}>
            <Text style={styles.recipeMoreText}>더보기 &gt;</Text>
          </TouchableOpacity>
        </View>
        {recentRecipes.length > 0 && (
          <RecentRecipeCard item={recentRecipes[0]} onPress={() => goToRecipeDetail(recentRecipes[0])} style={styles.recentSingleCard} />
        )}
      </View>

      <View style={styles.recentBox}>
        {recentRecipes.slice(1).map((r) => (
          <RecentRecipeCard key={r.id} item={r} onPress={() => goToRecipeDetail(r)} style={styles.recentCard} />
        ))}
      </View>
      <View style={{ height: s(40) }} />
    </ScrollView>
  );
}

/* ================= components ================= */
function RecentRecipeCard({ item, onPress, style }: { item: HomeRecipeItem; onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={style} onPress={onPress}>
      <View style={styles.recentInner}>
        <View style={styles.recentLeft}>
          <Image source={{ uri: item.thumbUrl }} style={styles.recentThumb} borderRadius={s(12)} />
          {!!item.savedAt && (
            <View style={styles.thumbTimeBadge}>
              <Text style={styles.thumbTimeText}>{getTimeAgo(item.savedAt)}</Text>
            </View>
          )}
        </View>
        <View style={styles.recentRight}>
          <Text style={styles.recentTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.recentBottom}>
            <View style={styles.hChannelRow}>
              {item.channelProfileUrl
                ? <Image source={{ uri: item.channelProfileUrl }} style={styles.hChannelProfile} />
                : <View style={[styles.hChannelProfile, { backgroundColor: '#DDE6E6' }]} />
              }
              <Text style={styles.channelName} numberOfLines={1}>{item.channelName}</Text>
            </View>
            <View style={styles.nicknamePriceRow}>
              {!!item.sharerNickname ? (
                <Text style={styles.sharerText} numberOfLines={1}>{item.sharerNickname}</Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {!!item.totalEstimatedPrice && (
                <Text style={styles.recentPrice}>{item.totalEstimatedPrice}</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function HorizontalVideoCard({ data, onPress }: { data: HomeRecipeItem; onPress: () => void }) {
  const hasStats = Number(data.likeCount) > 0 || Number(data.commentCount) > 0;
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.hVideoCard} onPress={onPress}>
      <Image source={{ uri: data.thumbUrl }} style={styles.hThumb} borderRadius={s(14)} />
      <Text style={styles.hTitle} numberOfLines={2}>{data.title}</Text>

      <View style={styles.hChannelRow}>
        {data.channelProfileUrl
          ? <Image source={{ uri: data.channelProfileUrl }} style={styles.hChannelProfile} />
          : <View style={[styles.hChannelProfile, { backgroundColor: '#DDE6E6' }]} />
        }
        <Text style={styles.hChannelName} numberOfLines={1}>{data.channelName}</Text>
      </View>

      {hasStats && (
        <View style={styles.hStatsRow}>
          <Text style={styles.hStatText}>❤️ {Number(data.likeCount).toLocaleString()}</Text>
          <Text style={styles.hStatText}>💬 {Number(data.commentCount).toLocaleString()}</Text>
        </View>
      )}

      {!!data.totalEstimatedPrice && (
        <Text style={styles.hPrice}>{data.totalEstimatedPrice}</Text>
      )}
    </TouchableOpacity>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: s(24) },

  topSectionFull: {
    backgroundColor: '#FFFFFF',
    paddingBottom: s(16),
    borderBottomLeftRadius: s(10),
    borderBottomRightRadius: s(10),
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(20),
    marginTop: s(15),
    marginBottom: s(10),
  },
  logoInline: {
    fontSize: s(20),
    fontWeight: '900',
    color: BRAND,
    textAlign: 'center',
  },
  profileBtnInline: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6F6',
  },
  questionInline: {
    fontSize: s(18),
    fontWeight: '900',
    color: Q_TITLE,
    paddingHorizontal: s(20),
    marginBottom: s(5),
  },
  categoryListInline: {
    paddingHorizontal: s(20),
    paddingBottom: 0,
  },
  categoryItemInline: {
    alignItems: 'center',
    justifyContent: 'center',
    width: s(85),
  },
  categoryImgInline: {
    width: s(75),
    height: s(75),
  },
  categoryTextInline: {
    fontSize: s(14),
    fontWeight: '800',
    color: SECTION,
    marginTop: s(1),
  },

  menuSectionWrap: {
    backgroundColor: BG,
    paddingVertical: s(10),
  },

  // ✨ 수정: 230px로 높이를 꽉 묶어버린 기준점
  menuGridContainer: {
    position: 'relative',
    height: s(230),           // 높이 230px 고정 (하단 컨텐츠 밀림 완벽 차단)
    marginHorizontal: s(10),  // 좌우 여백을 부모 쪽으로 뺌
  },
  menuGridNew: {
    flexDirection: 'row',
    height: '100%',           // 부모 높이(230)만큼 꽉 채움
    gap: s(10),
  },
  menuLeftNew: {
    flex: 1.2,
    gap: s(10),
    height: '100%',
  },
  menuCardNew: {
    flex: 1,                  // 작은 카드 2개가 위아래 공간을 정확히 반반씩 차지함
    backgroundColor: CARD,
    borderRadius: s(13.5),
    padding: s(16),
  },
  menuCardLargeNew: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: s(13.5),
    padding: s(16),
    height: '100%',           // 큰 카드는 230px 전체 차지
    justifyContent: 'flex-start',
  },
  menuTitleNew: {
    fontSize: s(18),
    fontWeight: '900',
    color: Q_TITLE,
  },
  menuSubTextNew: {
    fontSize: s(13),
    fontWeight: '600',
    color: SECTION,
    opacity: 0.5,
    lineHeight: s(19),
    marginTop: s(4),
  },

  // --- 레시피 만들기 패널 (메뉴 위로 겹쳐 뜨는 Overlay) ---
  createPanelOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0, // 부모 박스(230px)를 모서리 끝까지 완벽하게 덮음
    zIndex: 10,
  },
  createPanelInline: {
    flex: 1,                  // Overlay 박스 안을 꽉 채움
    backgroundColor: '#FFFFFF',
    borderRadius: s(13.5),
    padding: s(16),           // 230px 안에 이쁘게 우겨넣기 위해 여백 미세 조절
    justifyContent: 'space-between', // 내부 요소들(입력창-중간박스-버튼)이 상중하로 예쁘게 퍼짐
    // 기존의 잡다한 테두리선(border)은 삭제됨
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F5F9',
    paddingBottom: s(8),
  },
  createInputNewInline: {
    flex: 1,
    fontSize: s(14),
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
  },
  createCloseNewInline: {
    marginLeft: s(10),
    padding: s(4), // 클릭하기 편하도록 터치 영역 확보
  },

  // ✨ 추가: 가운데 썸네일과 글씨가 교대하는 영역 (남는 세로 공간을 모두 흡수)
  middleSection: {
    flex: 1,
    justifyContent: 'center', // 썸네일이 오든 글씨가 오든 세로 중앙에 딱 위치함
    paddingVertical: s(10),
  },

  previewBox: {
    flex: 1,                // 중간 영역을 꽉 채우도록 늘림
    flexDirection: 'row',
    backgroundColor: '#F8FAFB',
    borderRadius: s(12),
    padding: s(10),
    alignItems: 'center',
  },
  previewThumbContainer: { position: 'relative' },
  previewThumbLarge: {
    width: s(110),
    height: s(62),          // 박스 튀어나가지 않게 썸네일 크기 살짝 조절 (비율 유지)
    borderRadius: s(8),
    backgroundColor: '#DDE6E6',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: s(8),
  },
  previewInfo: {
    flex: 1,
    marginLeft: s(12),
    justifyContent: 'center',
  },
  previewTitleLarge: {
    fontSize: s(13),
    fontWeight: '900',
    color: '#3B4F4E',
    lineHeight: s(18),
    marginBottom: s(4),
  },
  previewChannelLarge: {
    fontSize: s(11),
    fontWeight: '700',
    color: '#8A9B9A',
  },

  createNoticeNewInline: {
    flex: 1,
    justifyContent: 'center', // 3줄 글씨도 중간에 예쁘게 정렬
    paddingLeft: s(4),
  },
  createBulletNewInline: {
    fontSize: s(12),
    fontWeight: '600',
    color: SECTION,
    opacity: 0.6,
    lineHeight: s(20),
  },

  createDoneBtnNewInline: {
    width: '100%',
    height: s(46),            // 230px 안에 안정적으로 들어가도록 버튼 높이 조절
    backgroundColor: '#1E2F2D',
    borderRadius: s(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  createDoneTextNewInline: {
    color: '#FFF',
    fontSize: s(15),
    fontWeight: '800',
  },

  combinedRecipeBlock: {
    backgroundColor: '#FFFFFF',
    paddingVertical: s(10),
    borderRadius: s(10),
  },
  recipeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(20),
    marginBottom: s(8),
  },
  recipeSectionTitle: {
    fontSize: s(17),
    fontWeight: '900',
    color: Q_TITLE,
  },
  recipeMoreText: {
    fontSize: s(12),
    color: '#8A9B9A',
    fontWeight: '700',
  },
  recipeListContent: {
    paddingHorizontal: s(10),
  },

  hVideoCard: {
    width: s(200),
    marginLeft: s(10),
  },
  hThumb: {
    width: s(200),
    height: s(112),
  },
  hTitle: {
    fontSize: s(14),
    fontWeight: '800',
    color: SECTION,
    marginTop: s(8),
    lineHeight: s(18),
    height: s(36),
  },
  hChannelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(6),
    gap: s(6),
  },
  hChannelProfile: {
    width: s(18),
    height: s(18),
    borderRadius: s(9),
  },
  hChannelName: {
    fontSize: s(11),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.7,
    flex: 1,
  },
  hStatsRow: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: s(4),
  },
  hStatText: {
    fontSize: s(11),
    color: SECTION,
    opacity: 0.6,
  },
  hPrice: {
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.7,
    marginTop: s(4),
  },

  recentSectionBlock: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: s(7),
    borderTopLeftRadius: s(13.5),
    borderTopRightRadius: s(13.5),
    borderBottomLeftRadius: s(5),
    borderBottomRightRadius: s(5),
    paddingTop: s(10),
    paddingBottom: s(10),
    paddingHorizontal: s(16),
    marginTop: s(10),
    marginBottom: s(5),
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(13),
    paddingHorizontal: s(4),
  },
  sectionTitle: {
    fontSize: s(16),
    fontWeight: '900',
    color: Q_TITLE,
  },
  moreText: {
    fontSize: s(12),
    color: SECTION,
    fontWeight: '700',
  },
  recentSingleCard: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  recentBox: {
    paddingHorizontal: s(7),
    gap: s(5),
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: s(5),
    padding: s(13),
  },

  recentInner: {
    flexDirection: 'row',
    gap: s(12),
    alignItems: 'stretch',
  },
  recentLeft: {
    width: s(150),
  },
  recentThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: s(12),
  },
  thumbTimeBadge: {
    position: 'absolute',
    bottom: s(6),
    left: s(6),
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: s(6),
    paddingHorizontal: s(5),
    paddingVertical: s(2),
  },
  thumbTimeText: {
    color: '#CECECE',
    fontSize: s(10),
    fontWeight: '700',
  },
  recentRight: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: s(2),
  },
  recentTitle: {
    fontSize: s(14),
    fontWeight: '900',
    color: SECTION,
    lineHeight: s(18),
    height: s(36),
  },
  recentBottom: {
    marginTop: 'auto',
  },
  channelName: {
    fontSize: s(11),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.6,
  },

  nicknamePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(4),
  },
  sharerText: {
    fontSize: s(11),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.7,
    flex: 1,
    marginRight: s(8),
  },
  recentPrice: {
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.7,
  },
});