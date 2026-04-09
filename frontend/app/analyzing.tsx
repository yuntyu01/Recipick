import React, { useEffect } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFridgeRecipes } from '../lib/api'; // 방금 만든 함수 불러오기
import { postFridgeRecommend } from '../lib/api';

// 친구분 코드에서 사용된 반응형 크기 함수 s()
const { width } = Dimensions.get('window');
const s = (v: number) => Math.round(v * (width / 430));

export default function AnalyzingScreen() {
    const router = useRouter();
    const { ingredients } = useLocalSearchParams();

    useEffect(() => {
      async function fetchRecipes() {
        try {
          const ingredientArray = typeof ingredients === 'string' ? ingredients.split(',') : [];
          
          // 1. 백엔드에 재료를 보내서 레시피 리스트를 받아옴
          const res = await postFridgeRecommend(ingredientArray);
          
          // 2. 받은 결과(recipes)를 결과 화면으로 전달
          router.replace({
            pathname: '/fridge-result',
            params: { 
              recipeData: JSON.stringify(res.recipes || res || []), // 결과 배열을 문자열로 변환
              ingredients: ingredients 
            }
          });
        } catch (error) {
          console.error("추천 실패:", error);
          alert("레시피를 가져오는 데 실패했어요.");
          router.back();
        }
      }

      fetchRecipes();
    }, []);

    return (
      <SafeAreaView style={styles.container}>
        {/* 1. 상단 헤더 (친구분 코드와 일치) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>냉장고 파먹기</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 2. 로딩바 (진행바) 영역 */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.stepText}>
            <Text style={{ color: '#54CDA4' }}>2</Text> / 3
          </Text>
        </View>

        {/* 3. 중앙 로딩 텍스트 및 애니메이션 */}
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#54CDA4" />
          <Text style={styles.mintTitle}>레시피를 찾고 있어요...</Text>
          <Text style={styles.blackTitle}>잠시만 기다려 주세요!</Text>
          <Text style={styles.greySubText}>
            입력하신 재료를 바탕으로 레시피를 찾고 있어요. 
          </Text>
        </View>

        {/* 4. 하단 취소하기 버튼 */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>취소하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    // 헤더 스타일
    header: { height: s(60), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20) },
    headerTitle: { fontSize: s(18), fontWeight: '800' },
    
    // 로딩바 스타일
    progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(25), marginTop: s(10) },
    progressTrack: { flex: 1, height: s(6), backgroundColor: '#F0F0F0', borderRadius: 3, marginRight: s(12) },
    progressFill: { width: '66.66%', height: '100%', backgroundColor: '#54CDA4', borderRadius: 3 },
    stepText: { fontSize: s(14), fontWeight: '800', color: '#999' },

    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: s(40) },
    // 글씨 굵게 하는 법: fontWeight를 '800'이나 '900'으로 설정
    mintTitle: { fontSize: s(21), fontWeight: '800', color: '#54CDA4', marginTop: s(20) },
    blackTitle: { fontSize: s(21), fontWeight: '800', color: '#000', marginTop: s(5) },
    greySubText: { fontSize: s(14), color: '#999', marginTop: s(15), textAlign: 'center', lineHeight: s(22), fontWeight: '600' },

    footer: { padding: s(25), paddingBottom: s(40) },
    cancelBtn: { 
      height: s(60), 
      borderRadius: s(30), 
      borderWidth: 1.5, 
      borderColor: '#E2E8F0', 
      justifyContent: 'center', 
      alignItems: 'center' 
    },
    cancelBtnText: { color: '#64748B', fontSize: s(16), fontWeight: '800' },
});