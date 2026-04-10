import React, { useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const s = (v: number) => Math.round(v * (width / 430));

export default function FridgeResultScreen() {
    const { recipeData } = useLocalSearchParams();
    const router = useRouter();

    // ✅ 데이터 파싱 로직 강화
    const recommendations = useMemo(() => {
        if (!recipeData) return [];
        try {
            const parsed = JSON.parse(recipeData as string);
            // 만약 서버 응답이 { recipes: [...] } 형태면 그 안의 배열을, 아니면 데이터 자체(배열)를 사용
            return Array.isArray(parsed) ? parsed : (parsed.recipes || []);
        } catch (e) {
            console.error("파싱 에러:", e);
            return [];
        }
    }, [recipeData]);

    const openYoutube = (url: string) => {
        if (!url) return;
        Linking.openURL(url).catch(() => console.log("유튜브 링크 연결 실패"));
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>냉장고 파먹기</Text>
                <View style={{ width: 24 }} />
            </View>

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
                    <Text style={styles.mintTitle}>냉장고 파먹기</Text>
                    <Text style={styles.blackTitle}>레시피를 찾아왔어요!</Text>
                    <Text style={styles.greySubText}>이런 메뉴는 어떠세요?</Text>
                    {/* ✅ 데이터가 없을 경우 처리 */}
                    {recommendations.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={48} color="#E2E8F0" />
                            <Text style={styles.emptyText}>추천할 수 있는 레시피가 없어요.{"\n"}다른 재료를 선택해 보세요!</Text>
                        </View>
                    ) : (
                        <View style={styles.resultGrid}>
                            {recommendations.map((item: any, index: number) => {
                                // 썸네일과 URL을 안전하게 추출
                                const videoId = item.video_id || (item.url ? item.url.split('v=')[1] : '');
                                const thumbUrl = item.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');
                                const youtubeUrl = item.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

                                return (
                                    <TouchableOpacity
                                        key={item.id || index}
                                        style={styles.resultCard}
                                        onPress={() => openYoutube(youtubeUrl)}
                                    >
                                        <View style={styles.thumbWrapper}>
                                            <Image 
                                                source={{ uri: thumbUrl }} 
                                                style={styles.resultThumb} 
                                            />
                                            <View style={styles.playIconBadge}>
                                                <Ionicons name="play" size={14} color="white" />
                                            </View>
                                        </View>
                                        
                                        <Text style={styles.resultTitle} numberOfLines={2}>
                                            {item.title || "제목 없는 레시피"}
                                        </Text>
                                        
                                        <Text style={styles.resultSub}>
                                            {item.channel_name || item.channel || "추천 레시피"}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

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
    progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(25), marginTop: s(10) },
    progressTrack: { flex: 1, height: s(6), backgroundColor: '#F0F0F0', borderRadius: 3, marginRight: s(12) },
    progressFill: { width: '100%', height: '100%', backgroundColor: '#54CDA4', borderRadius: 3 },
    stepText: { fontSize: s(14), fontWeight: '800', color: '#999' },
    scroll: { flex: 1 },
    padding: { paddingHorizontal: s(25), paddingTop: s(20) },
    mintTitle: { fontSize: s(20), fontWeight: '800', color: '#54CDA4' },
    blackTitle: { fontSize: s(20), fontWeight: '800', color: '#000', marginTop: s(2) },
    greySubText: { fontSize: s(14), color: '#999', marginTop: s(15), lineHeight: s(22), fontWeight: '600' },
    resultGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: s(25) },
    resultCard: { width: '48%', marginBottom: s(15) },
    thumbWrapper: { position: 'relative' },
    resultThumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: s(12), backgroundColor: '#F3F6F6' },
    playIconBadge: { position: 'absolute', bottom: s(8), right: s(8), backgroundColor: 'rgba(0,0,0,0.6)', width: s(24), height: s(24), borderRadius: s(12), justifyContent: 'center', alignItems: 'center' },
    resultTitle: { fontSize: s(14), fontWeight: '700', marginTop: s(8), color: '#333', lineHeight: s(20) },
    resultSub: { fontSize: s(12), color: '#8A9B9A', marginTop: s(4), fontWeight: '600' },
    retryBtn: { marginTop: s(20), height: s(50), borderRadius: s(12), borderWidth: 1.5, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: s(40) },
    retryBtnText: { fontSize: s(15), fontWeight: '700', color: '#64748B' },
    // ✅ 데이터 없을 때 스타일
    emptyContainer: { alignItems: 'center', marginTop: s(60), marginBottom: s(40) },
    emptyText: { textAlign: 'center', color: '#999', fontSize: s(15), marginTop: s(15), lineHeight: s(22), fontWeight: '600' },
});