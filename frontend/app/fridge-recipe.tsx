import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 친구분 코드의 반응형 함수 s() 도입
const { width } = Dimensions.get('window');
const s = (v: number) => Math.round(v * (width / 430));

export default function FridgeRecipeScreen() {
    const router = useRouter();
    const [ingredient, setIngredient] = useState('');
    const [ingredientsList, setIngredientsList] = useState<string[]>([]);

    const addIngredient = () => {
        if (ingredient.trim()) {
        setIngredientsList([...ingredientsList, ingredient.trim()]);
        setIngredient('');
        }
    };

    const removeIngredient = (index: number) => {
        setIngredientsList(ingredientsList.filter((_, i) => i !== index));
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

        {/* 2. 진행바: 1단계 (1/4) 표시 */}
        <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '33.33%' }]} /> 
            </View>
            <Text style={styles.stepText}>
            <Text style={{ color: '#54CDA4' }}>1</Text> / 3
            </Text>
        </View>

        <ScrollView style={styles.scroll}>
            <View style={styles.padding}>
            {/* 3. 타이틀 스타일: 굵기 800 적용 */}
            <Text style={styles.mintTitle}>냉장고 파먹기</Text>
            <Text style={styles.blackTitle}>냉장고에 있는 재료를 추가해보세요.</Text>
            <Text style={styles.greySubText}>재료를 넣으면 조합하여 메뉴를 추천해줘요.</Text>

            {/* 재료 입력창 */}
            <View style={styles.inputWrapper}>
                <TextInput
                style={styles.input}
                placeholder="재료를 하나씩 써서 넣어주세요!"
                value={ingredient}
                onChangeText={setIngredient}
                onSubmitEditing={addIngredient}
                />
                <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
                <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <Text style={styles.listLabel}>입력한 재료</Text>
            <View style={styles.tagContainer}>
                {ingredientsList.map((item, index) => (
                <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{item}</Text>
                    <TouchableOpacity onPress={() => removeIngredient(index)}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                </View>
                ))}
            </View>
            </View>
        </ScrollView>

        {/* 4. 하단 다음 버튼 */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.footer}>
            <TouchableOpacity 
                style={[styles.nextBtn, ingredientsList.length === 0 && styles.disabledBtn]} 
                disabled={ingredientsList.length === 0}
                onPress={() => router.push({
                pathname: '/analyzing',
                params: { ingredients: ingredientsList.join(',') }
                })}
            >
                <Text style={styles.nextBtnText}>다음</Text>
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
    greySubText: { fontSize: s(14), color: '#999', marginTop: s(10), fontWeight: '600' },

    inputWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginTop: s(30), 
        borderWidth: 1.5, 
        borderColor: '#54CDA4', 
        borderRadius: s(15), 
        paddingLeft: s(15),
        height: s(55)
    },
    input: { flex: 1, fontSize: s(16), fontWeight: '600' },
    addBtn: { backgroundColor: '#54CDA4', padding: s(10), borderRadius: s(12), marginRight: s(5) },

    listLabel: { fontSize: s(16), fontWeight: '800', marginTop: s(30), marginBottom: s(15) },
    tagContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    tag: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F0FBF8', 
        paddingHorizontal: s(12), 
        paddingVertical: s(6), 
        borderRadius: s(20), 
        marginRight: s(8), 
        marginBottom: s(8),
        borderWidth: 1,
        borderColor: '#54CDA4'
    },
    tagText: { marginRight: s(5), fontWeight: '700', color: '#333' },

    footer: { padding: s(25), paddingBottom: s(40) },
    nextBtn: { height: s(60), backgroundColor: '#54CDA4', borderRadius: s(30), justifyContent: 'center', alignItems: 'center' },
    disabledBtn: { backgroundColor: '#E2E8F0' },
    nextBtnText: { color: '#FFF', fontSize: s(18), fontWeight: '800' },
});