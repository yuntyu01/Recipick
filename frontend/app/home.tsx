import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Category = { key: string; emoji: string };

type VideoCardData = {
  id: string;
  title: string;          // 카드 아래 텍스트(유튜브 제목 느낌)
  thumbUrl?: string;      // 실제 썸네일 URL 붙이면 Image로 나옴(지금은 더미)
};

type RecentData = {
  id: string;
  title: string;
  channelName: string;
  channelAvatarUrl?: string;
  timeAgo: string;
  likes: string;
  comments: string;
  shares: string;
  price: string;
  thumbUrl?: string;
};

/* ---------- theme (피그마 컬러) ---------- */
const BRAND = '#54CDA4';
const Q_TITLE = '#3B4F4E';
const SECTION = '#4C6664';

const BG = '#F4F6F6';
const CARD = '#FFFFFF';
const THUMB_BG = '#DDE6E6';

/* ---------- layout ---------- */
const { width: SCREEN_W } = Dimensions.get('window');
const H_PADDING = 36;          // ✅ “패딩 좁다” 해결: 넉넉하게
const GAP = 12;

const TWO_COL_CARD_W = (SCREEN_W - H_PADDING * 2 - GAP) / 2;
// ✅ 유튜브 썸네일 비율 229x127
const YT_THUMB_H = TWO_COL_CARD_W * (127 / 229);

/* ---------- dummy data ---------- */
const CATEGORIES: Category[] = [
  { key: '한식', emoji: '🍲' },
  { key: '일식', emoji: '🍣' },
  { key: '중식', emoji: '🍜' },
  { key: '양식', emoji: '🍝' },
  { key: '분식', emoji: '🍢' },
  { key: '디저트', emoji: '🍰' },
];

const myRecipes: VideoCardData[] = [
  { id: '1', title: '일식 대파 듬뿍! 삼겹살로 만든 “대파 제육볶음”' },
  { id: '2', title: 'Vlog, 파스타러버의 파스타 만들기…🍝' },
];

const recommend: VideoCardData[] = [
  { id: '3', title: '소고기 구이 With 갈비양념' },
  { id: '4', title: '유튜브에서 난리난 그 소스' },
];

const recent: RecentData[] = [
  {
    id: '5',
    title: '6000원 된장찌개 팔아서 건물 세운 그 집',
    channelName: '요리 똑딱이형',
    timeAgo: '8분 전',
    likes: '1.3만',
    comments: '1.7천',
    shares: '508',
    price: '7800원',
  },
  {
    id: '6',
    title: '부대찌개 레시피 (라면사리 필수)',
    channelName: '요리 똑딱이형',
    timeAgo: '12분 전',
    likes: '8.2천',
    comments: '540',
    shares: '120',
    price: '9000원',
  },
  {
    id: '7',
    title: '김치볶음밥 (계란후라이 이렇게!)',
    channelName: '요리 똑딱이형',
    timeAgo: '1시간 전',
    likes: '2.1만',
    comments: '2.4천',
    shares: '880',
    price: '6500원',
  },
  {
    id: '8',
    title: '오므라이스 실패 없는 꿀팁',
    channelName: '요리 똑딱이형',
    timeAgo: '어제',
    likes: '6.4천',
    comments: '310',
    shares: '90',
    price: '7200원',
  },
  {
    id: '9',
    title: '라면 맛있게 끓이기 (파/계란/치즈)',
    channelName: '요리 똑딱이형',
    timeAgo: '2일 전',
    likes: '9.9천',
    comments: '800',
    shares: '200',
    price: '5000원',
  },
];

export default function Home() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- top ---------- */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>Recipick!</Text>

        <TouchableOpacity
          onPress={() => router.push('/mypage')}
          hitSlop={10}
          style={styles.profileBtn}
        >
          <Ionicons name="person" size={18} color="#111" />
        </TouchableOpacity>
      </View>

      {/* ---------- main button ---------- */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.cta}
        onPress={() => router.push('/create-link')}
      >
        <Text style={styles.ctaText}>레시피 만들기</Text>
      </TouchableOpacity>

      {/* ---------- question ---------- */}
      <Text style={styles.question}>어떤 요리 찾고 있어요?</Text>

      {/* ---------- categories: 4개 보이고 스크롤 ---------- */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.categoryItem}
            onPress={() => router.push(`/category/${encodeURIComponent(item.key)}`)}
          >
            <View style={styles.categoryIcon}>
              <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
            </View>
            <Text style={styles.categoryText}>{item.key}</Text>
          </TouchableOpacity>
        )}
      />

      {/* ---------- my recipes ---------- */}
      <SectionHeader title="내 레시피" onPressRight={() => router.push('/mypage')} />
      <View style={styles.twoCol}>
        {myRecipes.map((v) => (
          <VideoCard
            key={v.id}
            data={v}
            onPress={() => router.push(`/recipe/${v.id}`)}
          />
        ))}
      </View>

      {/* ---------- recommend ---------- */}
      <SectionHeader title="Recipick! 추천 레시피" onPressRight={() => router.push('/category/추천')} />
      <View style={styles.twoCol}>
        {recommend.map((v) => (
          <VideoCard
            key={v.id}
            data={v}
            onPress={() => router.push(`/recipe/${v.id}`)}
          />
        ))}
      </View>

      {/* ---------- recent (5개) ---------- */}
      <Text style={styles.sectionTitleOnly}>최근 많이 사용한 레시피</Text>

      <View style={{ gap: 12 }}>
        {recent.slice(0, 5).map((r) => (
          <TouchableOpacity
            key={r.id}
            activeOpacity={0.92}
            style={styles.recentCard}
            onPress={() => router.push(`/recipe/${r.id}`)}
          >
            {/* 썸네일 */}
            <Thumb
              style={styles.recentThumb}
              uri={r.thumbUrl}
              borderRadius={14}
            />

            {/* 우측 정보 */}
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.recentTitle} numberOfLines={2}>
                {r.title}
              </Text>

              {/* 채널 */}
              <View style={styles.channelRow}>
                <Thumb
                  style={styles.channelAvatar}
                  uri={r.channelAvatarUrl}
                  borderRadius={999}
                />
                <Text style={styles.channelName} numberOfLines={1}>
                  {r.channelName}
                </Text>
              </View>

              {/* 메타 */}
              <View style={styles.metaRow}>
                <Meta icon="heart-outline" text={r.likes} />
                <Meta icon="chatbubble-outline" text={r.comments} />
                <Meta icon="share-social-outline" text={r.shares} />
                <Text style={styles.priceText}>{r.price}</Text>
              </View>

              <Text style={styles.timeAgo}>{r.timeAgo}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* 하단 잘림 방지 */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ================= components ================= */

function SectionHeader({
  title,
  onPressRight,
}: {
  title: string;
  onPressRight?: () => void;
}) {
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

function VideoCard({
  data,
  onPress,
}: {
  data: VideoCardData;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.videoCard} onPress={onPress}>
      {/* ✅ 썸네일 비율 고정 229x127 */}
      <Thumb style={styles.ytThumb} uri={data.thumbUrl} borderRadius={14} />

      {/* ✅ 썸네일과 텍스트 영역 “분리” */}
      <View style={styles.videoBody}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {data.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function Meta({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={SECTION} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function Thumb({
  uri,
  style,
  borderRadius,
}: {
  uri?: string;
  style: any;
  borderRadius: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[style, { borderRadius }]}
        resizeMode="cover"
      />
    );
  }
  return <View style={[style, { borderRadius, backgroundColor: THUMB_BG }]} />;
}

/* ================= styles ================= */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: {
    paddingTop: 78,
    paddingHorizontal: H_PADDING,
    paddingBottom: 24,
  },

  /* top */
  topBar: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logo: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND,
  },
  profileBtn: {
    position: 'absolute',
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* cta */
  cta: {
    height: 52,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  /* question */
  question: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '800',
    color: Q_TITLE,
  },

  /* categories */
  categoryList: { paddingBottom: 10, gap: 18 },
  // ✅ 4개만 보이게(아이템 폭을 크게)
  categoryItem: { width: 78, alignItems: 'center' },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  categoryText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    color: SECTION,
  },

  /* section header */
  sectionHeader: {
    marginTop: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: SECTION },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 },
  moreText: { fontSize: 12, fontWeight: '800', color: SECTION, lineHeight: 18, includeFontPadding: false },
  moreArrow:{ fontSize: 12, fontWeight: '900', color: SECTION, lineHeight: 18, includeFontPadding: false },

  /* two column */
  twoCol: { flexDirection: 'row', gap: GAP },

  /* youtube card */
  videoCard: {
    width: TWO_COL_CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: CARD,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  ytThumb: {
    width: '100%',
    height: YT_THUMB_H, // ✅ 229x127 비율
  },
  videoBody: {
    backgroundColor: CARD,
    paddingHorizontal: 10,
    paddingTop: 10,    // ✅ 썸네일과 글씨 “떨어지게”
    paddingBottom: 12,
  },
  videoTitle: {
    color: SECTION,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },

  /* recent */
  sectionTitleOnly: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '900',
    color: SECTION,
  },
  recentCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recentThumb: {
    width: 140,
    height: 92,
  },
  recentTitle: {
    color: SECTION,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },

  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelAvatar: { width: 22, height: 22 },
  channelName: { color: SECTION, fontSize: 12, fontWeight: '800', flexShrink: 1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: SECTION, fontSize: 12, fontWeight: '700' },
  priceText: { marginLeft: 'auto', color: SECTION, fontWeight: '900', fontSize: 12 },

  timeAgo: { color: SECTION, opacity: 0.75, fontSize: 12, fontWeight: '700' },
});
