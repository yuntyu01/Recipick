import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type RecentData = {
    id: string;
    title: string;
    channelName: string;
    timeAgo: string;
    likes: string;
    comments: string;
    shares: string;
    price: string;
};

const dummy: RecentData[] = [
    {
        id: '5',
        title: '6000원 된장찌개 팔아서 건물 세운 그 집',
        channelName: '요리 똑딱이형',
        likes: '1.3만',
        comments: '1.7천',
        shares: '508',
        price: '7800원',
    },
    {
        id: '6',
        title: '부대찌개 레시피 (라면사리 필수)',
        channelName: '요리 똑딱이형',
        likes: '8.2천',
        comments: '540',
        shares: '120',
        price: '9000원',
    },
    {
        id: '7',
        title: '김치볶음밥 (계란후라이 이렇게!)',
        channelName: '요리 똑딱이형',
        likes: '2.1만',
        comments: '2.4천',
        shares: '880',
        price: '6500원',
    },
    {
        id: '8',
        title: '초간단 계란국 (5분 컷)',
        channelName: '요리 똑딱이형',
        likes: '6.4천',
        comments: '210',
        shares: '55',
        price: '3000원',
    },
    {
        id: '9',
        title: '집에서 만드는 떡볶이 황금레시피',
        channelName: '요리 똑딱이형',
        likes: '1.1만',
        comments: '980',
        shares: '300',
        price: '5500원',
    },
];

export default function CategoryPage() {
    const { name } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={{ paddingTop: insets.top }}
            showsVerticalScrollIndicator={false}
        >
            {/* ===== Header (가운데 정렬) ===== */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color={TITLE} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{String(name ?? '')}</Text>
            </View>

            {/* ===== List (홈 recent 카드와 동일) ===== */}
            <View style={styles.recentBox}>
                {dummy.map((r, idx) => (
                    <TouchableOpacity
                        key={r.id}
                        activeOpacity={0.92}
                        style={[styles.recentCard, idx > 0 && { marginTop: s(10) }]}
                    >
                        <View style={styles.recentInner}>
                            {/* 왼쪽: 썸네일*/}
                            <View style={styles.recentLeft}>
                                <Thumb style={styles.recentThumb} borderRadius={s(13.5)} />
                            </View>

                            {/* 오른쪽 정보 */}
                            <View style={styles.recentRight}>
                                <Text style={styles.recentTitle} numberOfLines={2}>
                                    {r.title}
                                </Text>

                                <View style={styles.channelRow}>
                                    <Thumb style={styles.channelAvatar} borderRadius={999} />
                                    <Text style={styles.channelName} numberOfLines={1}>
                                        {r.channelName}
                                    </Text>
                                </View>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaLeft}>
                                        <Meta icon="heart-outline" text={r.likes} />
                                        <Meta icon="chatbubble-outline" text={r.comments} />
                                        <Meta icon="share-social-outline" text={r.shares} />
                                    </View>

                                    <Text style={styles.priceText} numberOfLines={1}>
                                        {r.price}
                                    </Text>
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
}: {
    style: any;
    borderRadius: number;
}) {
    return <View style={[style, { borderRadius, backgroundColor: THUMB_BG }]} />;
}

/* ================= styles ================= */

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },

    /* header */
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
        alignItems: 'flex-start',  // 왼쪽 정렬 유지
    },


    /* list wrapper */
    recentBox: {
        paddingLeft: s(18),
        paddingRight: s(18),
    },

    /* card */
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

    /* left */
    recentLeft: {
        width: '38%',
    },
    recentThumb: {
        width: '100%',
        aspectRatio: 1.4,
    },
    timeAgoLeft: {
        marginTop: s(6),
        paddingLeft: s(8),
        fontSize: s(11),
        fontWeight: '700',
        color: SECTION,
        opacity: 0.75,
    },

    /* right */
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
        minHeight: s(36), // ✅ 제목 1줄이어도 2줄 높이 확보
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

    userTag: {
        fontSize: s(11),
        fontWeight: '600',
        color: SECTION,
        opacity: 0.6,
        alignSelf: 'flex-end',
    },
});
