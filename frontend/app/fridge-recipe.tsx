import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postFridgeRecommend, request } from '../lib/api'; // API 함수 임포트

const { width } = Dimensions.get('window');
const s = (v: number) => Math.round(v * (width / 430));

export default function FridgeRecipeScreen() {
    const router = useRouter();
    const [ingredient, setIngredient] = useState('');
    const [ingredientsList, setIngredientsList] = useState<string[]>([]); // 선택된 재료들
    const [suggestedIngredients, setSuggestedIngredients] = useState<any[]>([]); // API로 받아올 인기 재료들
    const [isSearching, setIsSearching] = useState(false); // 버튼 로딩 상태
    const fetchInitialIngredients = async () => {
        try {
            // 인기 재료 API 호출
            const res = await request<any[]>('/api/ingredients', { method: 'GET' });
            // 많은 순서대로 정렬
            const formatted = res.map(item => 
                typeof item === 'string' ? { name: item, count: 0 } : item
            );
            const sorted = formatted.sort((a, b) => (b.count || 0) - (a.count || 0));
            setSuggestedIngredients(sorted);
        } catch (e) {
            console.error("재료 목록 로드 실패", e);
        }
    };
    useEffect(() => {
        const fetchInitialIngredients = async () => {
            try {
                // 실제 엔드포인트에 맞게 조정하세요
                const res = await request<any[]>('/api/ingredients', { method: 'GET' });
                // 많은 순서대로 정렬 (count 기준이 있다고 가정)
                const sorted = res.sort((a, b) => (b.count || 0) - (a.count || 0));
                setSuggestedIngredients(sorted);
            } catch (e) {
                console.error("재료 목록 로드 실패", e);
            }
        };
        fetchInitialIngredients();
    }, []);

    // 재료 추가 로직 (추가 후 API로 연관 재료도 갱신)
    const addIngredient = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || ingredientsList.includes(trimmed)) return;
        const nextList = [...ingredientsList, trimmed];
        setIngredientsList(nextList);
        setIngredient('');

        try {
            const ingredientString = nextList.join(',');
            const res = await request<any>(`/api/recipes/search?ingredients=${encodeURIComponent(ingredientString)}`, {
                method: 'GET'
            });
            if (res && res.available_ingredients) {
                setSuggestedIngredients(res.available_ingredients);
            }
        } catch (e) {
            console.log("재료 추가 후 연관 재료 갱신 실패:", e);
        }
    };

// fridge-recipe.tsx 내부

    const handleIngredientTouch = async (name: string) => {
        let nextList: string[];
        if (ingredientsList.includes(name)) {
            nextList = ingredientsList.filter(item => item !== name);
        } else {
            nextList = [...ingredientsList, name];
        }
        setIngredientsList(nextList);

        if (nextList.length > 0) {
            try {
                const ingredientString = nextList.join(',');
                
                const res = await request<any>(`/api/recipes/search?ingredients=${encodeURIComponent(ingredientString)}`, {
                    method: 'GET'
                });

                if (res && res.available_ingredients) {
                    setSuggestedIngredients(res.available_ingredients);
                }
            } catch (e) {
                console.log("실시간 조합 필터링 실패:", e);
            }
        } else {
            fetchInitialIngredients(); 
        }
    };

    const removeIngredient = async (name: string) => {
        const nextList = ingredientsList.filter(item => item !== name);
        setIngredientsList(nextList);

        if (nextList.length > 0) {
            try {
                const ingredientString = nextList.join(',');
                const res = await request<any>(`/api/recipes/search?ingredients=${encodeURIComponent(ingredientString)}`, {
                    method: 'GET'
                });
                if (res && res.available_ingredients) {
                    setSuggestedIngredients(res.available_ingredients);
                }
            } catch (e) {
                console.log("재료 제거 후 연관 재료 갱신 실패:", e);
            }
        } else {
            fetchInitialIngredients();
        }
    };

    // [피드백 1, 2번] 검색 버튼 클릭 핸들러 (로딩 페이지 제거)
    const handleFinalSearch = async () => {
        setIsSearching(true);
        try {
            const res = await postFridgeRecommend(ingredientsList);
            router.replace({
                pathname: '/fridge-result',
                params: { 
                    recipeData: JSON.stringify(res.recipes || res || []),
                    ingredients: ingredientsList.join(',') 
                }
            });
        } catch (error) {
            alert("검색 실패");
        } finally {
            setIsSearching(false);
        }
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
                    <View style={[styles.progressFill, { width: '33.33%' }]} /> 
                </View>
                <Text style={styles.stepText}><Text style={{ color: '#54CDA4' }}>1</Text> / 3</Text>
            </View>

            <ScrollView style={styles.scroll}>
                <View style={styles.padding}>
                    <Text style={styles.mintTitle}>냉장고 파먹기</Text>
                    <Text style={styles.blackTitle}>재료를 추가해보세요.</Text>

                    {/* [피드백 4번] 입력창 디자인 개선 */}
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="찾는 재료가 없으면 직접 입력!"
                            value={ingredient}
                            onChangeText={setIngredient}
                            onSubmitEditing={() => addIngredient(ingredient)}
                        />
                        <TouchableOpacity style={styles.addBtn} onPress={() => addIngredient(ingredient)}>
                            <Ionicons name="search" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* 선택된 재료 (입력창 바로 아래) */}
                    {ingredientsList.length > 0 && (
                        <>
                            <Text style={styles.listLabel}>입력한 재료 ({ingredientsList.length})</Text>
                            <View style={styles.tagContainer}>
                                {ingredientsList.map((item, index) => (
                                    <View key={index} style={styles.tag}>
                                        <Text style={styles.tagText}>{item}</Text>
                                        <TouchableOpacity onPress={() => removeIngredient(item)}>
                                            <Ionicons name="close-circle" size={18} color="#54CDA4" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* 추천 재료 (이미 선택된 재료는 제외) */}
                    <Text style={styles.listLabel}>
                        {ingredientsList.length > 0 ? '이런 재료는 어때요?' : '많이 찾는 재료'}
                    </Text>
                    <View style={styles.suggestionContainer}>
                        {suggestedIngredients
                            .filter(item => !ingredientsList.includes(item.name))
                            .map((item, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.suggestTag}
                                onPress={() => handleIngredientTouch(item.name)}
                            >
                                <Text style={styles.suggestTagText}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={[styles.nextBtn, ingredientsList.length === 0 && styles.disabledBtn]} 
                        disabled={ingredientsList.length === 0 || isSearching}
                        onPress={handleFinalSearch}
                    >
                        {isSearching ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.nextBtnText}>레시피 찾기</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: { height: s(60), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20) },
    headerTitle: { fontSize: s(18), fontWeight: '800' },
    progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(25), marginTop: s(10) },
    progressTrack: { flex: 1, height: s(6), backgroundColor: '#F0F0F0', borderRadius: 3, marginRight: s(12) },
    progressFill: { height: '100%', backgroundColor: '#54CDA4', borderRadius: 3 },
    stepText: { fontSize: s(14), fontWeight: '800', color: '#999' },
    scroll: { flex: 1 },
    padding: { paddingHorizontal: s(25), paddingTop: s(20) },
    mintTitle: { fontSize: s(20), fontWeight: '800', color: '#54CDA4' },
    blackTitle: { fontSize: s(20), fontWeight: '800', color: '#000', marginTop: s(2) },
    inputWrapper: { 
        flexDirection: 'row', alignItems: 'center', marginTop: s(20), 
        backgroundColor: '#F7FAFC', borderRadius: s(15), paddingLeft: s(15), height: s(55)
    },
    input: { flex: 1, fontSize: s(15), fontWeight: '600' },
    addBtn: { backgroundColor: '#54CDA4', padding: s(10), borderRadius: s(12), marginRight: s(5) },
    listLabel: { fontSize: s(16), fontWeight: '800', marginTop: s(25), marginBottom: s(12) },
    suggestionContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8) },
    suggestTag: { 
        paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(20), 
        backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' 
    },
    activeSuggestTag: { backgroundColor: '#54CDA4', borderColor: '#54CDA4' },
    suggestTagText: { fontSize: s(14), color: '#64748B', fontWeight: '600' },
    activeSuggestText: { color: '#FFF' },
    tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8) },
    tag: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FBF8', 
        paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(20), 
        borderWidth: 1, borderColor: '#54CDA4'
    },
    tagText: { marginRight: s(5), fontWeight: '700', color: '#333' },
    footer: { padding: s(25), paddingBottom: s(40) },
    nextBtn: { height: s(60), backgroundColor: '#54CDA4', borderRadius: s(30), justifyContent: 'center', alignItems: 'center' },
    disabledBtn: { backgroundColor: '#E2E8F0' },
    nextBtnText: { color: '#FFF', fontSize: s(18), fontWeight: '800' },
});