import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    getRecipe,
    getRecommendationsByCategory,
    normalizeRecommendations,
    type RecommendationItem,
} from '../../lib/api';

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

type CategoryRecipeItem = {
    id: string;
    videoId: string;
    url: string;
    title: string;
    channelName: string;
    channelProfileUrl?: string;
    thumbUrl?: string;
    likeCount?: string;
    commentCount?: string;
    shareCount?: string;
    totalEstimatedPrice?: string;
};

function mapRecommendationToCategoryItem(item: RecommendationItem): CategoryRecipeItem {
    return {
        id: `category-${item.video_id}`,
        videoId: item.video_id,
        url: item.url || `https://www.youtube.com/watch?v=${item.video_id}`,
        title: item.title || '제목 없음',
        channelName: item.channel_name || '채널명 없음',
        channelProfileUrl: item.channel_profile_url || '',
        thumbUrl: item.thumbnail_url || '',
        likeCount: '0',
        commentCount: '0',
        shareCount: '0',
        totalEstimatedPrice: '',
    };
}

export default function CategoryPage() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const categoryName = String(params.name ?? params.category ?? '').trim();

    const [items, setItems] = useState<CategoryRecipeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // app/category/[name].tsx 내부의 loadCategoryFeed 함수

    const loadCategoryFeed = async () => {
        try {
            if (!categoryName) {
                setItems([]);
                setError('카테고리 정보가 없어요.');
                return;
            }

            setLoading(true);
            setError(null);

            // [수정 포인트!]
            // 1. 기존 'all' 대신 실제 선택된 카테고리(categoryName)를 보냅니다.
            // 2. 만약 categoryName이 '전체' 또는 'all'이라면 백엔드가 지원하는 '한식'으로 바꿔서 보냅니다.
            const target = (categoryName === 'all' || categoryName === '전체' || !categoryName)
                ? '한식'
                : categoryName;

            const res = await getRecommendationsByCategory(target);

            console.log("서버에서 받은 데이터:", res);
            const list = normalizeRecommendations(res);

            const mapped = list.map(mapRecommendationToCategoryItem);
            setItems(mapped);
        } catch (e: any) {
            console.log('[CATEGORY loadCategoryFeed error]', e);
            setItems([]);
            setError(e?.message || '카테고리 레시피를 불러오지 못했어요.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategoryFeed();
    }, [categoryName]);

    const goToRecipeDetail = async (item: CategoryRecipeItem) => {
        try {
            if (!item.videoId) {
                setError('레시피 정보를 찾을 수 없어요.');
                return;
            }

            setDetailLoadingId(item.id);
            setError(null);

            const detail = await getRecipe(item.videoId);

            if (detail.status !== 'COMPLETED' || !detail.data) {
                setError('이 추천 영상은 아직 분석된 레시피가 없어요.');
                return;
            }

            router.push({
                pathname: '/create-link',
                params: {
                    link: item.url,
                    url: item.url,
                    video_id: detail.video_id,
                    title: detail.title || item.title,
                    channel_name: detail.channel_name || item.channelName,
                    thumbnail_url: detail.thumbnail_url || item.thumbUrl || '',
                    recipe_data: JSON.stringify(detail.data ?? null),
                },
            });
        } catch (e: any) {
            console.log('[CATEGORY DETAIL LOAD ERROR]', e);
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
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color={TITLE} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{categoryName || '카테고리'}</Text>
            </View>

            {loading && <Text style={styles.infoText}>카테고리 레시피 불러오는 중...</Text>}
            {!!detailLoadingId && (
                <Text style={styles.infoText}>레시피 상세 정보 불러오는 중...</Text>
            )}
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.recentBox}>
                {items.map((r, idx) => (
                    <TouchableOpacity
                        key={r.id}
                        activeOpacity={0.92}
                        style={[styles.recentCard, idx > 0 && { marginTop: s(10) }]}
                        onPress={() => goToRecipeDetail(r)}
                    >
                        <View style={styles.recentInner}>
                            <View style={styles.recentLeft}>
                                <Thumb style={styles.recentThumb} borderRadius={s(13.5)} uri={r.thumbUrl} />
                            </View>

                            <View style={styles.recentRight}>
                                <Text style={styles.recentTitle} numberOfLines={2}>
                                    {r.title}
                                </Text>

                                <View style={styles.channelRow}>
                                    <Thumb style={styles.channelAvatar} borderRadius={999} uri={r.channelProfileUrl || undefined} />
                                    <Text style={styles.channelName} numberOfLines={1}>
                                        {r.channelName}
                                    </Text>
                                </View>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaLeft}>
                                        <Meta icon="heart-outline" text={r.likeCount || '0'} />
                                        <Meta icon="chatbubble-outline" text={r.commentCount || '0'} />
                                        <Meta icon="share-social-outline" text={r.shareCount || '0'} />
                                    </View>

                                    <Text style={styles.priceText} numberOfLines={1}>
                                        {r.totalEstimatedPrice || ''}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {!loading && items.length === 0 && !error && (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>표시할 레시피가 아직 없어요.</Text>
                    </View>
                )}
            </View>

            <View style={{ height: s(40) }} />
        </ScrollView>
    );
}

/* ================= components ================= */

function Meta({ icon, text }: { icon: any; text: string }) {
    return (
        <View style={styles.metaItem}>
            <Ionicons name={icon} size={s(14)} color={SECTION} />
            <Text style={styles.metaText}>{text}</Text>
        </View>
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

/* ================= styles ================= */

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

    recentBox: {
        paddingLeft: s(18),
        paddingRight: s(18),
    },

    recentCard: {
        backgroundColor: CARD,
        borderRadius: s(18),
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
        width: '38%',
    },
    recentThumb: {
        width: '100%',
        aspectRatio: 1.4,
    },

    recentRight: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: s(2),
    },
    recentTitle: {
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

    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    metaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
        flexShrink: 1,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
    metaText: { fontSize: s(11), fontWeight: '700', color: SECTION },

    priceText: {
        fontSize: s(11),
        fontWeight: '900',
        color: SECTION,
        marginLeft: s(10),
        flexShrink: 0,
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