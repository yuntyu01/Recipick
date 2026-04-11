import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRecommendQuestions, getRecipe, postRecommendRecipes } from '../lib/api';

const { width } = Dimensions.get('window');
const s = (v: number) => Math.round(v * (width / 430));

const splitEmoji = (label: string) => {
  const match = label.match(/(.*)\s([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}])/u);
  if (match) return { text: match[1], emoji: match[2] };
  return { text: label, emoji: '🍴' };
};

export default function RecommendFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isResult, setIsResult] = useState(false);
  const [results, setResults] = useState<{recipes: any[], suggestions: string[]}>({ recipes: [], suggestions: [] });
  const [displayData, setDisplayData] = useState<{recipes: any[], suggestions: string[]}>({ recipes: [], suggestions: [] });
  const [submitting, setSubmitting] = useState(false);
  const [askCount, setAskCount] = useState<number | null>(null);
  const [askLimit, setAskLimit] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getRecommendQuestions();
        setQuestions(data.questions || []);
      } catch (e) {
        Alert.alert("오류", "데이터를 불러오지 못했습니다.");
      } finally { setLoading(false); }
    })();
  }, []);

  const handleSelect = (qId: string, choiceKey: string, multi: boolean) => {
    let current = answers[qId] || (multi ? [] : "");
    if (!multi) {
      setAnswers({ ...answers, [qId]: choiceKey });
    } else {
      let next = [...current];
      if (choiceKey === 'any') next = next.includes('any') ? [] : ['any'];
      else {
        next = next.filter(k => k !== 'any');
        next = next.includes(choiceKey) ? next.filter(k => k !== choiceKey) : [...next, choiceKey];
      }
      setAnswers({ ...answers, [qId]: next });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await postRecommendRecipes(answers);
      setResults({ recipes: res.recipes || [], suggestions: res.suggestions || [] });
      if (res.ai_ask_count != null) setAskCount(res.ai_ask_count);
      if (res.ai_ask_limit != null) setAskLimit(res.ai_ask_limit);
      shuffle(res.recipes || [], res.suggestions || []);
      setIsResult(true);
    } catch (e: any) {
      Alert.alert("알림", e.status === 429 ? "오늘 한도를 초과했습니다." : "요청 실패");
    } finally { setSubmitting(false); }
  };

  const shuffle = (r: any[], s: any[]) => {
    setDisplayData({
      recipes: [...r].sort(() => Math.random() - 0.5).slice(0, 4),
      suggestions: [...s].sort(() => Math.random() - 0.5).slice(0, 4)
    });
  };

  const [recipeLoadingId, setRecipeLoadingId] = useState<string | null>(null);

  const goToAnalyzedRecipe = async (item: any) => {
    if (recipeLoadingId) return;
    setRecipeLoadingId(item.video_id);
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
        Alert.alert('알림', '아직 분석이 완료되지 않은 레시피예요.');
      }
    } catch (e) {
      Alert.alert('오류', '레시피를 불러오지 못했어��.');
    } finally {
      setRecipeLoadingId(null);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#54CDA4" /></View>;
  const currentQ = questions[currentStep];
  const isSelected = !!answers[currentQ?.id] && (currentQ.multi_select ? answers[currentQ.id].length > 0 : true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => isResult ? setIsResult(false) : (currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back())}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>추천 레시피</Text>
        <View style={{ width: 24 }} />
      </View>

      {!isResult ? (
        <View style={{ flex: 1 }}>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((currentStep + 1) / questions.length) * 100}%` }]} />
            </View>
            <Text style={styles.stepText}>
              <Text style={{ color: '#54CDA4' }}>{currentStep + 1}</Text> / {questions.length}
            </Text>
          </View>

          <ScrollView style={styles.scroll}>
            <View style={styles.padding}>
              <Text style={styles.mintTitle}>오늘 어떤 요리가 당기시나요?</Text>
              <Text style={styles.blackTitle}>AI가 딱 맞는 레시피를 찾아드릴게요</Text>
              <Text style={styles.greySubText}>질문 몇 가지만 답해주세요!</Text>
              <Text style={styles.questionMain}>{currentQ.question}</Text>

              <View style={styles.choiceWrapper}>
                {currentQ.choices.filter((c: any) => c.key !== 'any').map((choice: any) => {
                  const active = currentQ.multi_select ? (answers[currentQ.id] || []).includes(choice.key) : answers[currentQ.id] === choice.key;
                  const { text, emoji } = splitEmoji(choice.label);

                  if (currentQ.id === 'category') {
                    return (
                      <TouchableOpacity key={choice.key} style={[styles.gridCard, active && styles.activeCard]} onPress={() => handleSelect(currentQ.id, choice.key, currentQ.multi_select)}>
                        <Text style={styles.emojiDisplay}>{emoji}</Text>
                        <Text style={styles.gridLabel}>{text}</Text>
                        <View style={[styles.checkBoxBelow, active && styles.checkBoxActive]}>
                          {active && <Ionicons name="checkmark" size={12} color="white" />}
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity key={choice.key} style={[styles.listBtn, active && styles.activeListBtn]} onPress={() => handleSelect(currentQ.id, choice.key, currentQ.multi_select)}>
                      <View style={[styles.checkCircle, active && styles.checkCircleActive]}>
                        {active && <Ionicons name="checkmark" size={12} color="white" />}
                      </View>
                      <Text style={styles.listLabel}>{choice.label}</Text>
                    </TouchableOpacity>
                  );
                })}

                {currentQ.choices.find((c: any) => c.key === 'any') && (
                  <TouchableOpacity
                    style={[styles.anyBtn, (answers[currentQ.id] || []).includes('any') && styles.activeListBtn]}
                    onPress={() => handleSelect(currentQ.id, 'any', currentQ.multi_select)}
                  >
                    <View style={[styles.checkCircle, (answers[currentQ.id] || []).includes('any') && styles.checkCircleActive]}>
                      {(answers[currentQ.id] || []).includes('any') && <Ionicons name="checkmark" size={12} color="white" />}
                    </View>
                    <Text style={styles.listLabel}>상관없음</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.nextBtn, !isSelected && styles.disabledBtn]} disabled={!isSelected || submitting} onPress={() => currentStep === questions.length - 1 ? handleSubmit() : setCurrentStep(currentStep + 1)}>
              <Text style={styles.nextBtnText}>{submitting ? "분석 중..." : (currentStep === questions.length - 1 ? "레시피 추천받기" : "다음")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.padding}>
            <Text style={styles.mintTitle}>이건 어때요?</Text>
            <Text style={styles.blackTitle}>딱 맞는 레시피를 찾았어요</Text>
            <Text style={styles.greySubText}>마음에 드는 레시피를 눌러보세요!</Text>

            <View style={styles.resultGrid}>
              {displayData.recipes.map((item, index) => {
                const isLoading = recipeLoadingId === item.video_id;
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.resultCard}
                    activeOpacity={0.85}
                    disabled={!!recipeLoadingId}
                    onPress={() => goToAnalyzedRecipe(item)}
                  >
                    <View style={styles.thumbWrapper}>
                      <Image source={{ uri: item.thumbnail_url }} style={styles.resultThumb} />
                      {isLoading && (
                        <View style={styles.loadingOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.resultSub} numberOfLines={1}>{item.channel_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {displayData.suggestions.length > 0 && (
              <>
                <Text style={[styles.mintTitle, { marginTop: s(30) }]}>이런 것도 있어요</Text>
                <View style={styles.suggestionList}>
                  {displayData.suggestions.map((text, index) => (
                    <View key={index} style={styles.suggestionItem}>
                      <Text style={styles.suggestionBullet}>•</Text>
                      <Text style={styles.suggestionText} numberOfLines={1}>{text}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.shuffleBtn} onPress={() => shuffle(results.recipes, results.suggestions)}>
              <Text style={styles.shuffleBtnText}>다른 레시피 보기</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryBtn} onPress={() => { setCurrentStep(0); setIsResult(false); setAnswers({}); }}>
              <Text style={styles.retryBtnText}>처음부터 다시 추천받기</Text>
            </TouchableOpacity>

            {askCount != null && askLimit != null && (
              <Text style={styles.askLimitText}>
                오늘 {askLimit - askCount}회 남음 ({askCount}/{askLimit})
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { height: s(60), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20) },
  headerTitle: { fontSize: s(18), fontWeight: '800' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(25), marginTop: s(10) },
  progressTrack: { flex: 1, height: s(6), backgroundColor: '#F0F0F0', borderRadius: 3, marginRight: s(12) },
  progressFill: { height: '100%', backgroundColor: '#54CDA4', borderRadius: 3 },
  stepText: { fontSize: s(14), fontWeight: '800', color: '#999' },
  padding: { paddingHorizontal: s(25), paddingTop: s(20) },
  scroll: { flex: 1 },

  mintTitle: { fontSize: s(20), fontWeight: '800', color: '#54CDA4' },
  blackTitle: { fontSize: s(20), fontWeight: '800', color: '#000', marginTop: s(2) },
  greySubText: { fontSize: s(14), color: '#999', marginTop: s(10), fontWeight: '600' },
  questionMain: { fontSize: s(24), fontWeight: '900', textAlign: 'center', marginVertical: s(40) },
  choiceWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  gridCard: { width: '31%', aspectRatio: 0.85, backgroundColor: '#FFF', borderRadius: s(16), justifyContent: 'center', alignItems: 'center', marginBottom: s(10), borderWidth: 1.5, borderColor: '#E2E8F0' },
  activeCard: { borderColor: '#54CDA4', backgroundColor: '#F0FBF8' },
  emojiDisplay: { fontSize: s(35), marginBottom: s(5) },
  gridLabel: { fontSize: s(14), fontWeight: '700', marginBottom: s(10), color: '#333' },
  checkBoxBelow: { width: s(18), height: s(18), borderRadius: s(5), borderWidth: 1.5, borderColor: '#CBD5E0', backgroundColor: '#EDF2F7', justifyContent: 'center', alignItems: 'center' },
  checkBoxActive: { backgroundColor: '#54CDA4', borderColor: '#54CDA4' },

  listBtn: { width: '100%', height: s(55), backgroundColor: '#FFF', borderRadius: s(12), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(15), marginBottom: s(12), borderWidth: 1.5, borderColor: '#E2E8F0' },
  anyBtn: { width: '100%', height: s(55), backgroundColor: '#FFF', borderRadius: s(12), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(15), marginTop: s(2), borderWidth: 1.5, borderColor: '#E2E8F0' },
  activeListBtn: { borderColor: '#54CDA4', backgroundColor: '#F0FBF8' },
  checkCircle: { width: s(20), height: s(20), borderRadius: s(4), borderWidth: 1.5, borderColor: '#CBD5E0', marginRight: s(10), justifyContent: 'center', alignItems: 'center' },
  checkCircleActive: { backgroundColor: '#54CDA4', borderColor: '#54CDA4' },
  listLabel: { fontSize: s(16), fontWeight: '700', color: '#4A5568' },

  footer: { padding: s(25), paddingBottom: s(40) },
  nextBtn: { height: s(60), backgroundColor: '#54CDA4', borderRadius: s(30), justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { backgroundColor: '#E2E8F0' },
  nextBtnText: { color: '#FFF', fontSize: s(18), fontWeight: '800' },

  // 결과 화면용 스타일
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: s(20) },
  resultCard: { width: '48%', marginBottom: s(16) },
  thumbWrapper: { position: 'relative' },
  resultThumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: s(12), backgroundColor: '#F3F6F6' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: s(12), justifyContent: 'center', alignItems: 'center' },
  resultTitle: { fontSize: s(13), fontWeight: '800', marginTop: s(8), color: '#3B4F4E', lineHeight: s(18) },
  resultSub: { fontSize: s(11), color: '#8A9B9A', fontWeight: '600', marginTop: s(3) },
  suggestionList: { marginTop: s(12) },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: s(10), borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: s(8) },
  suggestionBullet: { fontSize: s(16), color: '#54CDA4', fontWeight: '900' },
  suggestionText: { fontSize: s(14), fontWeight: '700', color: '#3B4F4E', flex: 1 },
  shuffleBtn: { marginTop: s(25), height: s(50), borderRadius: s(25), backgroundColor: '#54CDA4', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: s(6) },
  shuffleBtnText: { fontSize: s(15), fontWeight: '800', color: '#fff' },
  retryBtn: { marginTop: s(12), height: s(50), borderRadius: s(12), borderWidth: 1.5, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: s(6) },
  retryBtnText: { fontSize: s(15), fontWeight: '700', color: '#64748B' },
  askLimitText: { fontSize: s(12), fontWeight: '700', color: '#8A9B9A', textAlign: 'right', marginTop: s(16), marginBottom: s(40) },
});