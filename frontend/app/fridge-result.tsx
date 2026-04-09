import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, Linking
    } from 'react-native';
    import { SafeAreaView } from 'react-native-safe-area-context';
    import { useRouter, useLocalSearchParams } from 'expo-router';
    import { Ionicons } from '@expo/vector-icons';

    const { width } = Dimensions.get('window');
    const s = (v: number) => Math.round(v * (width / 430)); // 메뉴추천 탭과 동일한 반응형 함수

    export default function FridgeResultScreen() {
        const { recipeData } = useLocalSearchParams();
        const recommendations = recipeData ? JSON.parse(recipeData as string) : [];
        const router = useRouter();
        const { ingredients } = useLocalSearchParams();

        const openYoutube = (url: string) => {
            Linking.openURL(url).catch(() => console.log("유튜브 링크 연결 실패"));
        };

        return (
            <SafeAreaView style={styles.container}>
            {/* 헤더: 메뉴추천 탭 스타일 */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>냉장고 파먹기</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* 진행바: 이미지 image_8eace1.png 스타일 반영 */}
            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
                </View>
                <Text style={styles.stepText}>
                <Text style={{ color: '#54CDA4' }}>3</Text> / 3
                </Text>
            </View>

            <ScrollView style={styles.scroll}>
                <View style={styles.padding}>
                {/* 타이틀: 굵기 800 반영 */}
                <Text style={styles.mintTitle}>ㅊ</Text>
                <Text style={styles.blackTitle}>딱 맞는 레시피를 찾았어요</Text>

                {/* 결과 그리드: 2열 배열 */}
                <View style={styles.resultGrid}>
                    {recommendations.map((item: any, index: number) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.resultCard}
                            // item.url이 없으면 video_id로 직접 링크 생성
                            onPress={() => openYoutube(item.url || `https://www.youtube.com/watch?v=${item.video_id}`)}
                        >
                            <View style={styles.thumbWrapper}>
                            <Image 
                                // 서버에서 준 thumbnail_url이 있으면 쓰고, 없으면 생성
                                source={{ uri: item.thumbnail_url || `https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg` }} 
                                style={styles.resultThumb} 
                            />
                            <View style={styles.playIconBadge}>
                                <Ionicons name="play" size={14} color="white" />
                            </View>
                            </View>
                            
                            {/* 제목 굵게: styles.resultTitle에 fontWeight: '800'이 있어야 함 */}
                            <Text style={styles.resultTitle} numberOfLines={2}>
                            {item.title}
                            </Text>
                            
                            {/* 채널명: api.ts에 정의된 channel_name 사용 */}
                            <Text style={styles.resultSub}>
                            {item.channel_name || item.channel}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 다시 추천받기 버튼: 메뉴추천 탭 스타일 */}
                <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/fridge-recipe')}>
                    <Text style={styles.retryBtnText}>다시 추천받기</Text>
                </TouchableOpacity>
                </View>
            </ScrollView>
            </SafeAreaView>
        );
    }

    const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: { height: s(60), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20) },
    headerTitle: { fontSize: s(18), fontWeight: '800' },
    
    // 진행바 스타일 정밀화
    progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(25), marginTop: s(10) },
    progressTrack: { flex: 1, height: s(6), backgroundColor: '#F0F0F0', borderRadius: 3, marginRight: s(12) },
    progressFill: { width: '100%', height: '100%', backgroundColor: '#54CDA4', borderRadius: 3 },
    stepText: { fontSize: s(14), fontWeight: '800', color: '#999' },
    
    scroll: { flex: 1 },
    padding: { paddingHorizontal: s(25), paddingTop: s(20) },

    mintTitle: { fontSize: s(20), fontWeight: '800', color: '#54CDA4' },
    blackTitle: { fontSize: s(20), fontWeight: '800', color: '#000', marginTop: s(2) },

    // 결과 그리드 스타일 (메뉴추천 탭 결과창과 동일)
    resultGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: s(25) },
    resultCard: { width: '48%', marginBottom: s(15) },
    thumbWrapper: { position: 'relative' },
    resultThumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: s(12), backgroundColor: '#F3F6F6' },
    playIconBadge: { position: 'absolute', bottom: s(8), right: s(8), backgroundColor: 'rgba(0,0,0,0.6)', width: s(24), height: s(24), borderRadius: s(12), justifyContent: 'center', alignItems: 'center' },
    
    // 글씨 굵게 (700~800 사용)
    resultTitle: { fontSize: s(14), fontWeight: '700', marginTop: s(8), color: '#333', lineHeight: s(20) },
    resultSub: { fontSize: s(12), color: '#8A9B9A', marginTop: s(4), fontWeight: '600' },

    retryBtn: { marginTop: s(20), height: s(50), borderRadius: s(12), borderWidth: 1.5, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: s(40) },
    retryBtnText: { fontSize: s(15), fontWeight: '700', color: '#64748B' },
});