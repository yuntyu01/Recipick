import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRecipe,
  searchRecipesByKeyword,
} from '../lib/api';

/* ================== FIGMA SCALE (430 기준) ================== */
const FIGMA_W = 430;
const { width: SCREEN_W } = Dimensions.get('window');
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

/* ---------- theme ---------- */
const BRAND = '#54CDA4';
const TITLE = '#3B4F4E';
const SECTION = '#4C6664';
const BG = '#F3F6F6';
const CARD = '#FFFFFF';
const THUMB_BG = '#DDE6E6';

/* ---------- sort ---------- */
type SortKey = 'default' | 'name' | 'likes' | 'price';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: '기본' },
  { key: 'name', label: '이름순' },
  { key: 'likes', label: '좋아요순' },
  { key: 'price', label: '가격순' },
];

/* ---------- types ---------- */
type SearchResultItem = {
  id: string;
  videoId: string;
  url: string;
  title: string;
  channelName: string;
  channelProfileUrl?: string;
  thumbUrl?: string;
  totalEstimatedPrice: string;
  totalEstimatedPriceRaw: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  detailLoaded: boolean;
};

function formatWon(value: any) {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).replace(/[^\d.-]/g, '');
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return String(value).includes('원') ? String(value) : `${value}원`;
  }
  return `${num.toLocaleString('ko-KR')}원`;
}

function toNum(value: any): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function sortResults(items: SearchResultItem[], key: SortKey): SearchResultItem[] {
  if (key === 'default') return items;
  const sorted = [...items];
  switch (key) {
    case 'name':
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
      break;
    case 'likes':
      sorted.sort((a, b) => b.likeCount - a.likeCount);
      break;
    case 'price':
      sorted.sort((a, b) => a.totalEstimatedPriceRaw - b.totalEstimatedPriceRaw);
      break;
  }
  return sorted;
}

export default function SearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('default');

  const sortedResults = useMemo(() => sortResults(results, sortKey), [results, sortKey]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      setSortKey('default');

      const list = await searchRecipesByKeyword(trimmed);

      const basicItems: SearchResultItem[] = list.map((item: any) => ({
        id: `search-${item.video_id}`,
        videoId: item.video_id,
        url: item.url || `https://www.youtube.com/watch?v=${item.video_id}`,
        title: item.title || '제목 없음',
        channelName: item.channel_name || '채널명 없음',
        channelProfileUrl: item.channel_profile_url || '',
        thumbUrl: item.thumbnail_url || '',
        totalEstimatedPrice: formatWon(item.total_estimated_price),
        totalEstimatedPriceRaw: toNum(item.total_estimated_price),
        likeCount: toNum(item.like_count),
        commentCount: toNum(item.comment_count),
        shareCount: toNum(item.share_count),
        detailLoaded: true,
      }));

      setResults(basicItems);
      setLoading(false);
    } catch (e: any) {
      console.log('[SEARCH ERROR]', e);
      setError(e?.message || '검색 중 오류가 발생했어요.');
      setResults([]);
      setLoading(false);
    }
  };

  const goToRecipeDetail = async (item: SearchResultItem) => {
    try {
      setDetailLoadingId(item.id);
      setError(null);

      const detail = await getRecipe(item.videoId);

      if (detail.status !== 'COMPLETED' || !detail.data) {
        setError('이 영상은 아직 분석된 레시피가 없어요.');
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
      console.log('[SEARCH DETAIL ERROR]', e);
      setError(e?.message || '레시피 상세 정보를 불러오는 중 오류가 났어요.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 헤더: 뒤로가기 + 검색 입력 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={s(22)} color={TITLE} />
        </TouchableOpacity>

        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={s(16)} color="#9AA8A7" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="레시피, 요리명 검색"
            placeholderTextColor="#9AA8A7"
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={s(18)} color="#D1D1D1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 정렬 바 */}
      {searched && results.length > 0 && (
        <View style={styles.sortBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                style={[styles.sortChip, sortKey === opt.key && styles.sortChipActive]}
                onPress={() => setSortKey(opt.key)}
              >
                <Text style={[styles.sortChipText, sortKey === opt.key && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.resultCount}>{results.length}개</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={BRAND} size="large" />
            <Text style={styles.loadingText}>검색 중...</Text>
          </View>
        )}

        {!!detailLoadingId && (
          <Text style={styles.infoText}>레시피 상세 정보 불러오는 중...</Text>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && searched && results.length === 0 && !error && (
          <View style={styles.centerBox}>
            <Ionicons name="search-outline" size={s(48)} color="#CDD8D7" />
            <Text style={styles.emptyText}>검색 결과가 없어요</Text>
            <Text style={styles.emptySubText}>다른 키워드로 다시 검색해 보세요</Text>
          </View>
        )}

        {!loading && !searched && (
          <View style={styles.centerBox}>
            <Ionicons name="restaurant-outline" size={s(48)} color="#CDD8D7" />
            <Text style={styles.emptyText}>어떤 요리를 찾고 있나요?</Text>
            <Text style={styles.emptySubText}>레시피명을 검색해 보세요</Text>
          </View>
        )}

        {sortedResults.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[styles.resultCard, idx > 0 && { marginTop: s(5) }]}
            onPress={() => goToRecipeDetail(item)}
          >
            <View style={styles.resultInner}>
              <View style={styles.resultLeft}>
                {item.thumbUrl ? (
                  <Image source={{ uri: item.thumbUrl }} style={styles.resultThumb} />
                ) : (
                  <View style={[styles.resultThumb, { backgroundColor: THUMB_BG }]} />
                )}
              </View>
              <View style={styles.resultRight}>
                <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.resultBottom}>
                  <View style={styles.channelRow}>
                    {item.channelProfileUrl ? (
                      <Image source={{ uri: item.channelProfileUrl }} style={styles.channelAvatar} />
                    ) : (
                      <View style={[styles.channelAvatar, { backgroundColor: THUMB_BG }]} />
                    )}
                    <Text style={styles.channelName} numberOfLines={1}>{item.channelName}</Text>
                  </View>
                  <View style={styles.nicknamePriceRow}>
                    {item.detailLoaded ? (
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Ionicons name="heart-outline" size={s(13)} color={SECTION} />
                          <Text style={styles.statText}>{item.likeCount.toLocaleString()}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="chatbubble-outline" size={s(13)} color={SECTION} />
                          <Text style={styles.statText}>{item.commentCount.toLocaleString()}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Ionicons name="share-social-outline" size={s(13)} color={SECTION} />
                          <Text style={styles.statText}>{item.shareCount.toLocaleString()}</Text>
                        </View>
                      </View>
                    ) : (
                      <ActivityIndicator size="small" color="#CDD8D7" />
                    )}
                    {!!item.totalEstimatedPrice && (
                      <Text style={styles.priceText}>{item.totalEstimatedPrice}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: s(40) }} />
      </ScrollView>
    </View>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    backgroundColor: CARD,
    gap: s(8),
  },
  backBtn: {
    width: s(36),
    height: s(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: s(10),
    paddingHorizontal: s(12),
    paddingVertical: s(9),
    gap: s(8),
  },
  searchInput: {
    flex: 1,
    fontSize: s(14),
    fontWeight: '600',
    color: TITLE,
    padding: 0,
  },

  /* 정렬 바 */
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    paddingVertical: s(8),
    paddingRight: s(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F3',
  },
  sortScroll: {
    paddingHorizontal: s(14),
    gap: s(6),
  },
  sortChip: {
    paddingHorizontal: s(12),
    paddingVertical: s(6),
    borderRadius: s(16),
    backgroundColor: BG,
  },
  sortChipActive: {
    backgroundColor: TITLE,
  },
  sortChipText: {
    fontSize: s(12),
    fontWeight: '700',
    color: SECTION,
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  resultCount: {
    fontSize: s(12),
    fontWeight: '700',
    color: '#9AA8A7',
    marginLeft: s(8),
    flexShrink: 0,
  },

  scrollBody: { flex: 1 },
  scrollContent: { paddingHorizontal: s(14), paddingTop: s(12) },

  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: s(80),
    gap: s(10),
  },
  loadingText: {
    fontSize: s(14),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: s(16),
    fontWeight: '800',
    color: TITLE,
  },
  emptySubText: {
    fontSize: s(13),
    fontWeight: '600',
    color: SECTION,
    opacity: 0.6,
  },

  infoText: {
    marginBottom: s(10),
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.8,
  },
  errorText: {
    marginBottom: s(10),
    fontSize: s(12),
    fontWeight: '900',
    color: '#D14B4B',
  },

  resultCard: {
    backgroundColor: CARD,
    borderRadius: s(5),
    padding: s(13),
  },
  resultInner: {
    flexDirection: 'row',
    gap: s(12),
    alignItems: 'stretch',
  },
  resultLeft: {
    width: s(150),
  },
  resultThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: s(12),
    backgroundColor: THUMB_BG,
  },
  resultRight: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: s(2),
  },
  resultTitle: {
    fontSize: s(14),
    fontWeight: '900',
    color: SECTION,
    lineHeight: s(18),
    height: s(36),
  },
  resultBottom: {
    marginTop: 'auto',
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
  },
  nicknamePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(4),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    flex: 1,
    marginRight: s(8),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
  },
  statText: {
    fontSize: s(11),
    fontWeight: '700',
    color: SECTION,
    opacity: 0.7,
  },
  priceText: {
    fontSize: s(12),
    fontWeight: '800',
    color: SECTION,
    opacity: 0.7,
    flexShrink: 0,
  },
});
