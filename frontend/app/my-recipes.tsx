import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
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
    getMeWithToken,
    getRecipe,
    getUserHistory,
    getUserIdFromMe,
    normalizeUserHistory,
    type RecipeData,
    type UserHistoryItem,
    type UserHistoryRecipeData,
} from './lib/api';

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

function mapHistoryItemToMyRecipe(item: UserHistoryItem, index: number): MyRecipeItem {
    const videoId = item.video_id ?? '';
    const url =
        item.original_url ||
        item.url ||
        (videoId ? buildYoutubeUrl(videoId) : '');

    return {
        id: `history-${videoId}-${item.saved_at || item.created_at || index}`,
        videoId,
        title: item.recipe_title || item.title || '제목 없음',
        channelName: item.channel_name || '채널명 없음',
        thumbUrl:
            item.thumbnail_url ||
            (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''),
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
        } catch (e: any) {
            console.log('[MY RECIPES LOAD ERROR]', e);
            setItems([]);
            setError(e?.message || '내 레시피를 불러오지 못했어요.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadMyRecipes();
        }, [loadMyRecipes])
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

                <Text style={styles.headerTitle}>내 레시피</Text>
            </View>

            {loading && !refreshing && (
                <Text style={styles.infoText}>내 레시피 불러오는 중...</Text>
            )}

            {!!detailLoadingId && (
                <Text style={styles.infoText}>레시피 상세 정보 불러오는 중...</Text>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.listWrap}>
                {items.map((r, idx) => (
                    <TouchableOpacity
                        key={r.id}
                        activeOpacity={0.92}
                        style={[styles.card, idx > 0 && { marginTop: s(10) }]}
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
                                    <Thumb style={styles.channelAvatar} borderRadius={999} />
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

                {!loading && items.length === 0 && !error && (
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
    thumb: {
        width: '100%',
        aspectRatio: 1.4,
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