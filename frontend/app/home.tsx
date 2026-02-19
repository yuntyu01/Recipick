// app/home.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

/* ---------- types ---------- */
type VideoCardData = { id: string; title: string; thumbUrl?: string };
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

/* ---------- dummy data ---------- */
const myRecipes: VideoCardData[] = [
  { id: '1', title: '일식 대파 듬뿍! 삼겹살로 만든 “대파 제육볶음”' },
  { id: '2', title: 'Vlog, 파스타러버의 파스타만들기…🍝' },
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
    title: '초간단 계란국 (5분 컷)',
    channelName: '요리 똑딱이형',
    timeAgo: '2시간 전',
    likes: '6.4천',
    comments: '210',
    shares: '55',
    price: '3000원',
  },
  {
    id: '9',
    title: '집에서 만드는 떡볶이 황금레시피',
    channelName: '요리 똑딱이형',
    timeAgo: '3시간 전',
    likes: '1.1만',
    comments: '980',
    shares: '300',
    price: '5500원',
  },
];

/* ---------- (유지) two-col calc ---------- */
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

/* ===== Horizontal cards (피그마 값 고정) =====
   1번 카드 left = 18
   2번 카드 left = 257
   카드폭 = 229
   => gap = 257 - 18 - 229 = 10
   썸네일 = 229 x 127
*/
const H_LIST_LEFT = s(18);
const H_LIST_GAP = s(10);
const H_CARD_W = s(229);
const H_THUMB_H = s(127);

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ✅ 추가: 패널 토글 상태 + 링크 상태
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [link, setLink] = useState('');
  const isExpanded = link.trim().length > 0;


  const TOP_TUNE = s(50);
  const logoTop = insets.top + s(FIGMA_LOGO_T) - TOP_TUNE;
  const profileTop = insets.top + s(FIGMA_PROFILE_T) - TOP_TUNE;
  const ctaTop = insets.top + s(FIGMA_CTA_T) - TOP_TUNE;

  const topAreaHeight = ctaTop + s(FIGMA_CTA_H) + s(16);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---------- top ---------- */}
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
          // ✅ 변경: 페이지 이동 말고 패널 열기
          onPress={() => setShowCreatePanel(true)}
        >
          <Text style={styles.ctaText}>레시피 만들기</Text>
        </TouchableOpacity>
      </View>

      {showCreatePanel && (
        <View style={styles.createPanelWrap}>
          <View style={styles.createPanel}>
            {/* 입력 */}
            <View style={styles.createInputRow}>
              <TextInput
                value={link}
                onChangeText={setLink}
                placeholder="링크를 붙여넣으면 AI가 레시피로 정리해줘요!"
                placeholderTextColor="#9AA8A7"
                style={styles.createInput}
              />
              <TouchableOpacity
                onPress={() => {
                  setLink('');
                  setShowCreatePanel(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.createClose}
              >
                <Ionicons name="close" size={18} color="#6B7C7A" />
              </TouchableOpacity>
            </View>

            {/* 주의사항 (항상 표시) */}
            <View style={styles.createNotice}>
              <Text style={styles.createBullet}>• 지원 가능: 유튜브, 인스타</Text>
              <Text style={styles.createBullet}>• 30분 이상 영상 길이는 분석이 불가능해요</Text>
              <Text style={styles.createBullet}>• 분석에는 약 3분의 시간이 걸립니다</Text>
            </View>

            {/* 버튼 영역 (간격 한번에 조절) */}
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
                    style={styles.createDoneBtn}
                    onPress={() => setShowCreatePanel(false)}
                  >
                    <Text style={styles.createDoneText}>완료</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.createDoneBtnFull}
                  onPress={() => setShowCreatePanel(false)}
                >
                  <Text style={styles.createDoneText}>완료</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}



      {/* ---------- question ---------- */}
      <Text style={[styles.question, { marginTop: s(FIGMA_QUESTION_GAP) }]}>
        어떤 요리 찾고 있어요?
      </Text>

      {/* ---------- categories ---------- */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => String(item.key)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        ItemSeparatorComponent={() => <View style={{ width: s(6) }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.categoryItem}
            onPress={() => router.push(`/category/${encodeURIComponent(String(item.key))}`)}
          >
            <Image source={item.icon} style={styles.categoryImg} resizeMode="contain" />
            <Text style={styles.categoryText}>{item.key}</Text>
          </TouchableOpacity>
        )}
      />

      {/* ---------- my recipes (가로) ---------- */}
      <SectionHeader title="내 레시피" onPressRight={() => router.push('/mypage')} />
      <FlatList
        horizontal
        data={myRecipes}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: H_LIST_LEFT, paddingRight: s(18) }}
        ItemSeparatorComponent={() => <View style={{ width: H_LIST_GAP }} />}
        snapToInterval={H_CARD_W + H_LIST_GAP}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <HorizontalVideoCard data={item} onPress={() => router.push(`/recipe/${item.id}`)} />
        )}
      />

      {/* ---------- recommend (가로) ---------- */}
      <SectionHeader title="Recipick! 추천 레시피" onPressRight={() => router.push('/category/추천')} />
      <FlatList
        horizontal
        data={recommend}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: H_LIST_LEFT, paddingRight: s(18) }}
        ItemSeparatorComponent={() => <View style={{ width: H_LIST_GAP }} />}
        snapToInterval={H_CARD_W + H_LIST_GAP}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <HorizontalVideoCard data={item} onPress={() => router.push(`/recipe/${item.id}`)} />
        )}
      />

      {/* ---------- recent ---------- */}
      <Text style={styles.recentHeader}>최근 많이 사용한 레시피</Text>

      <View style={styles.recentBox}>
        {recent.map((r, idx) => (
          <TouchableOpacity
            key={r.id}
            activeOpacity={0.92}
            style={[styles.recentCard, idx > 0 && { marginTop: s(12) }]}
            onPress={() => router.push(`/recipe/${r.id}`)}
          >
            <View style={styles.recentInner}>
              <View style={styles.recentLeft}>
                <Thumb style={styles.recentThumb} uri={r.thumbUrl} borderRadius={s(13.5)} />
                <Text style={styles.timeAgoLeft}>{r.timeAgo}</Text>
              </View>

              <View style={styles.recentRight}>
                {/* 위 */}
                <Text style={styles.recentTitle} numberOfLines={2}>
                  {r.title}
                </Text>

                {/* 중간 */}
                <View style={styles.channelRow}>
                  <Thumb style={styles.channelAvatar} uri={r.channelAvatarUrl} borderRadius={999} />
                  <Text style={styles.channelName} numberOfLines={1}>
                    {r.channelName}
                  </Text>
                </View>

                {/* 아래 */}
                <View style={styles.metaRow}>
                  <Meta icon="heart-outline" text={r.likes} />
                  <Meta icon="chatbubble-outline" text={r.comments} />
                  <Meta icon="share-social-outline" text={r.shares} />
                  <Text style={styles.priceText}>{r.price}</Text>
                </View>

                <Text style={styles.userTag}>Recipick 유저</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: s(40) }} />
    </ScrollView >
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

function HorizontalVideoCard({ data, onPress }: { data: VideoCardData; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.hVideoCard} onPress={onPress}>
      <Thumb style={styles.hThumb} uri={data.thumbUrl} borderRadius={s(14)} />
      <Text style={styles.hTitle} numberOfLines={2}>
        {data.title}
      </Text>
    </TouchableOpacity>
  );
}

// (유지용)
function VideoCard({ data, onPress }: { data: VideoCardData; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.videoCard} onPress={onPress}>
      <Thumb style={styles.ytThumb} uri={data.thumbUrl} borderRadius={s(14)} />
      <Text style={styles.videoTitle} numberOfLines={2}>
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

  // ✅ 추가: create panel styles
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

  createBullet: {
    fontSize: s(13),
    fontWeight: '700',
    color: '#3B4F4E',
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

  /* categories */
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

  /* section header */
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

  /* ✅ Horizontal cards */
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

  /* (유지용) two-col */
  twoCol: {
    flexDirection: 'row',
    gap: s(10),
    paddingLeft: s(18),
    paddingRight: s(18),
  },
  videoCard: {
    width: TWO_COL_CARD_W,
    backgroundColor: 'transparent',
    paddingHorizontal: s(2),
  },
  ytThumb: {
    width: '100%',
    height: YT_THUMB_H,
  },
  videoTitle: {
    marginTop: s(10),
    marginLeft: s(3),
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    lineHeight: s(16),
  },

  /* recent */
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
    marginTop: s(16),  // ✅ 여기 숫자만 조절하면 1/2버튼 모두 같이 내려감
  },

  createActionRow: {
    flexDirection: 'row',
    gap: s(10),
  },


  // 1버튼일 때는 가로 꽉 차게 (flex 영향 제거)
  createDoneBtnFull: {
    height: s(44),
    borderRadius: s(14),
    backgroundColor: '#2F3F3E',
    alignItems: 'center',
    justifyContent: 'center',
  },


});
