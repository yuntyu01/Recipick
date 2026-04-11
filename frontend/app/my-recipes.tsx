import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    buildUserHistoryPayloadFromRecipe,
    createUserHistory,
    getMeWithToken,
    getRecipe,
    getUserHistory,
    getUserIdFromMe,
    normalizeUserHistory,
    type RecipeData,
    type UserHistoryItem,
    type UserHistoryRecipeData,
} from '../lib/api';
import {
    getPendingRecipes,
    removePending,
    subscribePending,
    updatePendingStatus,
    type PendingRecipe,
    type PendingStatus,
} from '../lib/pending-recipes';

/* ================== FIGMA SCALE (430 기준) ================== */
const FIGMA_W = 430;
const { width: SCREEN_W } = Dimensions.get('window');
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

/* ---------- theme ---------- */
const TITLE = '#3B4F4E';
const SECTION = '#4C6664';
const BG = '#F3F6F6';
const CARD = '#FFFFFF';
const THUMB_BG = '#DDE6E6';

type MyRecipeItem = {
    id: string;
    videoId: string;
    title: string;
    channelName: string;
    channelProfileUrl?: string;
    thumbUrl?: string;
    price?: string;
    createdAt?: string;
    category?: string;
    url: string;
    recipeData?: RecipeData | UserHistoryRecipeData | null;
};

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

function mapHistoryItemToMyRecipe(item: any, index: number): MyRecipeItem {
    const videoId = item.video_id ?? '';
    const url = item.url || item.original_url || (videoId ? buildYoutubeUrl(videoId) : '');

    return {
        id: `history-${videoId}-${index}`,
        videoId,
        title: item.title || '제목 없음',
        channelName: item.channel_name || '채널명 없음',
        channelProfileUrl: item.channel_profile_url || '',
        thumbUrl: item.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''),
        price: formatWon(item.total_estimated_price),
        createdAt: item.saved_at || item.created_at || '',
        category: item.category || '',
        url,
        recipeData: item.recipe_data ?? null,
    };
}

function isFullRecipeData(data: any): data is RecipeData {
    return !!data && Array.isArray(data.steps) && Array.isArray(data.ingredients);
}

export default function MyRecipesPage() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [items, setItems] = useState<MyRecipeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 분석 대기 중인 레시피
    const [pending, setPending] = useState<PendingRecipe[]>(getPendingRecipes());
    const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const isFocused = useRef(false);

    const getAccessToken = async () => {
        const token =
            (await SecureStore.getItemAsync('accessToken')) ||
            (await SecureStore.getItemAsync('access_token'));

        if (!token) {
            throw new Error('로그인 토큰이 없어요.');
        }

        return token;
    };

    const getCurrentUserId = async () => {
        const token = await getAccessToken();
        const me = await getMeWithToken(token);
        return getUserIdFromMe(me);
    };

    const loadMyRecipes = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            setError(null);

            const userId = await getCurrentUserId();

            if (!userId) {
                setItems([]);
                setError('사용자 정보를 찾을 수 없어요.');
                return;
            }

            const historyRes = await getUserHistory(userId, 50);
            const historyItems = normalizeUserHistory(historyRes);
            const mapped = historyItems.map(mapHistoryItemToMyRecipe);

            setItems(mapped);

            // 이미 DB에 저장된 레시피는 pending에서 제거
            const savedVideoIds = new Set(mapped.map((m) => m.videoId));
            const currentPending = getPendingRecipes();
            currentPending.forEach((p) => {
                if (savedVideoIds.has(p.videoId) && p.status === 'COMPLETED') {
                    removePending(p.videoId);
                }
            });
        } catch (e: any) {
            console.log('[MY RECIPES LOAD ERROR]', e);
            setItems([]);
            setError(e?.message || '내 레시피를 불러오지 못했어요.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // pending store 구독
    useEffect(() => {
        const unsub = subscribePending(() => {
            setPending(getPendingRecipes());
        });
        return unsub;
    }, []);

    // 분석 중인 아이템 폴링 (3분 타임아웃)
    const POLL_TIMEOUT_MS = 3 * 60 * 1000;

    const pollAnalysis = useCallback(async (p: PendingRecipe) => {
        if (p.status !== 'ANALYZING') return;

        if (Date.now() - p.addedAt > POLL_TIMEOUT_MS) {
            console.log('[POLL TIMEOUT]', p.videoId);
            updatePendingStatus(p.videoId, 'FAILED');
            return;
        }

        try {
            const result = await getRecipe(p.videoId);

            if (result.status === 'COMPLETED' && result.data) {
                updatePendingStatus(p.videoId, 'COMPLETED');

                // DB에 저장
                try {
                    const userId = await getCurrentUserId();
                    if (userId) {
                        const dataWithVideoId = { ...result.data, video_id: result.video_id ?? p.videoId };
                        const payload = buildUserHistoryPayloadFromRecipe(dataWithVideoId);
                        await createUserHistory(userId, payload);
                    }
                } catch (e) {
                    console.log('[SAVE COMPLETED RECIPE ERROR]', e);
                }

                // pending에서 제거하고 목록 새로고침
                removePending(p.videoId);
                await loadMyRecipes();
                return;
            }

            if (result.status === 'FAILED') {
                updatePendingStatus(p.videoId, 'FAILED');
                return;
            }

            // 아직 PROCESSING → 계속 폴링
            if (isFocused.current) {
                pollTimers.current[p.videoId] = setTimeout(() => pollAnalysis(p), 2000);
            }
        } catch (e) {
            console.log('[POLL ERROR]', p.videoId, e);
            // 네트워크 에러 등 → 재시도
            if (isFocused.current) {
                pollTimers.current[p.videoId] = setTimeout(() => pollAnalysis(p), 3000);
            }
        }
    }, [loadMyRecipes]);

    // 화면 포커스 시 폴링 시작
    useFocusEffect(
        useCallback(() => {
            isFocused.current = true;
            loadMyRecipes();

            // 분석 중인 것들 폴링 시작
            const currentPending = getPendingRecipes();
            setPending(currentPending);
            currentPending.forEach((p) => {
                if (p.status === 'ANALYZING') {
                    pollAnalysis(p);
                }
            });

            return () => {
                isFocused.current = false;
                // 폴링 타이머 정리
                Object.values(pollTimers.current).forEach(clearTimeout);
                pollTimers.current = {};
            };
        }, [loadMyRecipes, pollAnalysis])
    );

    const goToRecipe = async (item: MyRecipeItem) => {
        try {
            if (!item.videoId) {
                setError('레시피 정보를 찾을 수 없어요.');
                return;
            }

            setDetailLoadingId(item.id);
            setError(null);

            if (item.recipeData && isFullRecipeData(item.recipeData)) {
                router.push({
                    pathname: '/create-link',
                    params: {
                        video_id: item.videoId,
                        title: item.title,
                        channel_name: item.channelName,
                        thumbnail_url: item.thumbUrl || '',
                        url: item.url,
                        link: item.url,
                        recipe_data: JSON.stringify(item.recipeData ?? null),
                    },
                });
                return;
            }

            const detail = await getRecipe(item.videoId);

            if (detail.status !== 'COMPLETED' || !detail.data) {
                setError('레시피 상세 정보를 불러오지 못했어요.');
                return;
            }

            router.push({
                pathname: '/create-link',
                params: {
                    video_id: detail.video_id,
                    title: detail.title || item.title,
                    channel_name: detail.channel_name || item.channelName,
                    thumbnail_url: detail.thumbnail_url || item.thumbUrl || '',
                    url: item.url || buildYoutubeUrl(detail.video_id),
                    link: item.url || buildYoutubeUrl(detail.video_id),
                    recipe_data: JSON.stringify(detail.data ?? null),
                },
            });
        } catch (e: any) {
            console.log('[MY RECIPE DETAIL LOAD ERROR]', e);
            setError(e?.message || '레시피 상세 정보를 불러오는 중 오류가 났어요.');
        } finally {
            setDetailLoadingId(null);
        }
    };

    // pending 중 이미 DB에 있는 videoId는 제외
    const savedVideoIds = new Set(items.map((i) => i.videoId));
    const visiblePending = pending.filter((p) => !savedVideoIds.has(p.videoId));

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={{ paddingTop: insets.top }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => loadMyRecipes(true)}
                />
            }
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color={TITLE} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>나의 레시피</Text>
            </View>

            {loading && !refreshing && (
                <Text style={styles.infoText}>내 레시피 불러오는 중...</Text>
            )}

            {!!detailLoadingId && (
                <Text style={styles.infoText}>레시피 상세 정보 불러오는 중...</Text>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.listWrap}>
                {/* 분석 대기 중 / 실패 카드 */}
                {visiblePending.map((p, idx) => (
                    <View
                        key={`pending-${p.videoId}`}
                        style={[styles.card, idx > 0 && { marginTop: s(10) }]}
                    >
                        <View style={styles.cardInner}>
                            <View style={styles.left}>
                                <View style={styles.thumbWrap}>
                                    <Thumb style={styles.thumb} borderRadius={s(13.5)} uri={p.thumbnailUrl} />
                                    <View style={styles.overlay}>
                                        {p.status === 'ANALYZING' && <ActivityIndicator size="small" color="#fff" />}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.right}>
                                <Text style={styles.title} numberOfLines={2}>
                                    {p.title}
                                </Text>

                                <View style={styles.channelRow}>
                                    <View style={[styles.channelAvatar, { borderRadius: 999, backgroundColor: THUMB_BG }]} />
                                    <Text style={styles.channelName} numberOfLines={1}>
                                        {p.channelName}
                                    </Text>
                                </View>

                                <View style={styles.bottomRow}>
                                    {p.status === 'ANALYZING' && (
                                        <Text style={styles.analyzingText}>분석중...</Text>
                                    )}
                                    {p.status === 'FAILED' && (
                                        <Text style={styles.failedText}>분석 실패</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                {/* 저장된 레시피 */}
                {items.map((r, idx) => (
                    <TouchableOpacity
                        key={r.id}
                        activeOpacity={0.92}
                        style={[styles.card, (idx > 0 || visiblePending.length > 0) && { marginTop: s(10) }]}
                        onPress={() => goToRecipe(r)}
                    >
                        <View style={styles.cardInner}>
                            <View style={styles.left}>
                                <Thumb style={styles.thumb} borderRadius={s(13.5)} uri={r.thumbUrl} />
                            </View>

                            <View style={styles.right}>
                                <Text style={styles.title} numberOfLines={2}>
                                    {r.title}
                                </Text>

                                <View style={styles.channelRow}>
                                    <Thumb style={styles.channelAvatar} borderRadius={999} uri={r.channelProfileUrl || undefined} />
                                    <Text style={styles.channelName} numberOfLines={1}>
                                        {r.channelName}
                                    </Text>
                                </View>

                                <View style={styles.bottomRow}>
                                    <Text style={styles.createdText} numberOfLines={1}>
                                        {r.category || ''}
                                    </Text>

                                    {!!r.price && (
                                        <Text style={styles.priceText} numberOfLines={1}>
                                            {r.price}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {!loading && items.length === 0 && visiblePending.length === 0 && !error && (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>아직 저장한 레시피가 없어요.</Text>
                    </View>
                )}
            </View>

            <View style={{ height: s(40) }} />
        </ScrollView>
    );
}

function Thumb({
    style,
    borderRadius,
    uri,
}: {
    style: any;
    borderRadius: number;
    uri?: string;
}) {
    if (uri) {
        return <Image source={{ uri }} style={[style, { borderRadius }]} resizeMode="cover" />;
    }
    return <View style={[style, { borderRadius, backgroundColor: THUMB_BG }]} />;
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },

    header: {
        height: s(56),
        justifyContent: 'center',
        paddingHorizontal: s(18),
        marginBottom: s(12),
    },
    headerTitle: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: s(18),
        fontWeight: '900',
        color: TITLE,
        pointerEvents: 'none',
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },

    infoText: {
        marginBottom: s(10),
        marginLeft: s(18),
        fontSize: s(12),
        fontWeight: '800',
        color: SECTION,
        opacity: 0.8,
    },
    errorText: {
        marginBottom: s(10),
        marginLeft: s(18),
        fontSize: s(12),
        fontWeight: '900',
        color: '#D14B4B',
    },

    listWrap: {
        paddingLeft: s(18),
        paddingRight: s(18),
    },

    card: {
        backgroundColor: CARD,
        borderRadius: s(18),
    },
    cardInner: {
        flexDirection: 'row',
        gap: s(12),
        paddingLeft: s(11),
        paddingTop: s(10),
        paddingRight: s(11),
        paddingBottom: s(14),
    },

    left: {
        width: '38%',
    },
    thumbWrap: {
        position: 'relative',
    },
    thumb: {
        width: '100%',
        aspectRatio: 1.4,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: s(13.5),
        justifyContent: 'center',
        alignItems: 'center',
    },

    right: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: s(2),
    },
    title: {
        fontSize: s(14),
        fontWeight: '900',
        color: TITLE,
        lineHeight: s(18),
        minHeight: s(36),
    },

    channelRow: {
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

    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s(8),
    },
    createdText: {
        fontSize: s(11),
        fontWeight: '700',
        color: SECTION,
        opacity: 0.75,
        flex: 1,
    },
    priceText: {
        fontSize: s(11),
        fontWeight: '900',
        color: SECTION,
    },
    analyzingText: {
        fontSize: s(11),
        fontWeight: '900',
        color: '#54CDA4',
    },
    failedText: {
        fontSize: s(11),
        fontWeight: '900',
        color: '#D14B4B',
    },

    emptyBox: {
        backgroundColor: CARD,
        borderRadius: s(18),
        paddingHorizontal: s(16),
        paddingVertical: s(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: s(14),
        fontWeight: '700',
        color: '#8A9B9A',
        textAlign: 'center',
    },
});
