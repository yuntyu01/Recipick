import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRecommendQuestions, postRecommendRecipes } from '../lib/api';

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
  const [results, setResults] = useState<{recipes: any[], suggestions: any[]}>({ recipes: [], suggestions: [] });
  const [displayData, setDisplayData] = useState<{recipes: any[], suggestions: any[]}>({ recipes: [], suggestions: [] });
  const [submitting, setSubmitting] = useState(false);

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
      shuffle(res.recipes, res.suggestions);
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
            <Text style={styles.mintTitle}>분석 완료!</Text>
            <Text style={styles.blackTitle}>딱 맞는 레시피를 찾았어요</Text>
            <View style={styles.resultGrid}>
              {displayData.recipes.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultCard}
                  onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id, videoId: item.video_id } })}
                >
                  <View style={styles.thumbWrapper}>
                    <Image source={{ uri: item.thumbnail_url }} style={styles.resultThumb} />
                    <View style={styles.playIconBadge}><Ionicons name="play" size={14} color="white" /></View>
                  </View>
                  <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.resultSub}>{item.channel_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setCurrentStep(0); setIsResult(false); setAnswers({}); }}>
              <Text style={styles.retryBtnText}>다시 추천받기</Text>
            </TouchableOpacity>
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
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: s(25) },
  resultCard: { width: '48%', marginBottom: s(15) },
  thumbWrapper: { position: 'relative' },
  resultThumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: s(12), backgroundColor: '#F3F6F6' },
  playIconBadge: { position: 'absolute', bottom: s(8), right: s(8), backgroundColor: 'rgba(0,0,0,0.6)', width: s(24), height: s(24), borderRadius: s(12), justifyContent: 'center', alignItems: 'center' },
  resultTitle: { fontSize: s(14), fontWeight: '700', marginTop: s(8), color: '#333' },
  resultSub: { fontSize: s(12), color: '#8A9B9A', marginTop: s(4), fontWeight: '600' },
  retryBtn: { marginTop: s(20), height: s(50), borderRadius: s(12), borderWidth: 1.5, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: s(40) },
  retryBtnText: { fontSize: s(15), fontWeight: '700', color: '#64748B' },
});