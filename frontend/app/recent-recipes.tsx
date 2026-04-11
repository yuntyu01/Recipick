import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
    getLatestRecipes,
    getRecipe,
    type LatestRecipe,
} from '../lib/api';

const FIGMA_W = 430;
const { width: SCREEN_W } = Dimensions.get('window');
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

const TITLE = '#3B4F4E';
const SECTION = '#4C6664';
const BRAND = '#54CDA4';
const BG = '#F3F6F6';
const CARD = '#FFFFFF';

function getTimeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const now = Date.now();
    const past = new Date(dateStr).getTime();
    if (Number.isNaN(past)) return '';
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

export default function RecentRecipesPage() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [items, setItems] = useState<LatestRecipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

    const loadRecipes = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);

            const data = await getLatestRecipes(50);
            setItems(data);
        } catch (e: any) {
            console.log('[RECENT RECIPES LOAD ERROR]', e);
            setItems([]);
            setError(e?.message || '최근 레시피를 불러오지 못했어요.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadRecipes();
    }, [loadRecipes]);

    const goToRecipe = async (item: LatestRecipe) => {
        if (!item.video_id) return;
        setDetailLoadingId(item.video_id);
        setError(null);

        try {
            const detail = await getRecipe(item.video_id);
            if (detail.status === 'COMPLETED' && detail.data) {
                router.push({
                    pathname: '/create-link',
                    params: {
                        video_id: detail.video_id,
                        title: detail.title || item.title,
                        channel_name: detail.channel_name || item.channel_name,
                        thumbnail_url: detail.thumbnail_url || item.thumbnail_url || '',
                        url: item.url || `https://www.youtube.com/watch?v=${detail.video_id}`,
                        link: item.url || `https://www.youtube.com/watch?v=${detail.video_id}`,
                        recipe_data: JSON.stringify(detail.data),
                    },
                });
            } else {
                setError('레시피 상세 정보를 불러오지 못했어요.');
            }
        } catch (e: any) {
            console.log('[RECENT RECIPE DETAIL ERROR]', e);
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
                <RefreshControl refreshing={refreshing} onRefresh={() => loadRecipes(true)} />
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
                <Text style={styles.headerTitle}>최근 레시피</Text>
            </View>

            {loading && !refreshing && (
                <Text style={styles.infoText}>최근 레시피 불러오는 중...</Text>
            )}

            {!!detailLoadingId && (
                <Text style={styles.infoText}>레시피 상세 정보 불러오는 중...</Text>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.listWrap}>
                {items.map((item, idx) => (
                    <TouchableOpacity
                        key={`${item.video_id}-${idx}`}
                        activeOpacity={0.92}
                        style={[styles.card, idx > 0 && { marginTop: s(8) }]}
                        onPress={() => goToRecipe(item)}
                    >
                        <View style={styles.cardInner}>
                            <View style={styles.left}>
                                <Image
                                    source={{ uri: item.thumbnail_url || `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg` }}
                                    style={styles.thumb}
                                    borderRadius={s(12)}
                                />
                                {!!item.created_at && (
                                    <View style={styles.timeBadge}>
                                        <Text style={styles.timeText}>{getTimeAgo(item.created_at)}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.right}>
                                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

                                <View style={styles.channelRow}>
                                    {item.channel_profile_url
                                        ? <Image source={{ uri: item.channel_profile_url }} style={styles.channelAvatar} />
                                        : <View style={[styles.channelAvatar, { backgroundColor: '#DDE6E6' }]} />
                                    }
                                    <Text style={styles.channelName} numberOfLines={1}>{item.channel_name}</Text>
                                </View>

                                <View style={styles.bottomRow}>
                                    {!!item.sharer_nickname && (
                                        <Text style={styles.sharerText} numberOfLines={1}>{item.sharer_nickname}</Text>
                                    )}
                                    {!!item.total_estimated_price && (
                                        <Text style={styles.priceText}>{formatWon(item.total_estimated_price)}</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {!loading && items.length === 0 && !error && (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>최근 레시피가 없어요.</Text>
                    </View>
                )}
            </View>

            <View style={{ height: s(40) }} />
        </ScrollView>
    );
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
        paddingHorizontal: s(18),
    },

    card: {
        backgroundColor: CARD,
        borderRadius: s(14),
    },
    cardInner: {
        flexDirection: 'row',
        gap: s(12),
        padding: s(11),
    },

    left: {
        width: s(150),
    },
    thumb: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    timeBadge: {
        position: 'absolute',
        bottom: s(6),
        left: s(6),
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: s(6),
        paddingHorizontal: s(5),
        paddingVertical: s(2),
    },
    timeText: {
        color: '#CECECE',
        fontSize: s(10),
        fontWeight: '700',
    },

    right: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: s(2),
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
        gap: s(6),
    },
    channelAvatar: {
        width: s(18),
        height: s(18),
        borderRadius: s(9),
    },
    channelName: {
        fontSize: s(11),
        fontWeight: '800',
        color: SECTION,
        opacity: 0.6,
        flexShrink: 1,
    },

    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: s(4),
    },
    sharerText: {
        fontSize: s(11),
        fontWeight: '700',
        color: SECTION,
        opacity: 0.7,
        flex: 1,
    },
    priceText: {
        fontSize: s(12),
        fontWeight: '800',
        color: SECTION,
        opacity: 0.7,
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
