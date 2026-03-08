import React, { useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");

const GREEN = "#54CDA4";
const CARD = "#FFFFFF";
const TEXT_DARK = "#0F172A";

/* ✅ 이미지 연결 */
const slides = [
    {
        title: "Recipick과 함께\n요리할 준비 되셨나요?",
        image: require("../assets/images/categories/onboarding1.png"),
    },
    {
        title: "오늘부터 당신의 주방 비서는\n바로 Recipick!",
        image1: require("../assets/images/categories/onboarding2.png"),
        image2: require("../assets/images/categories/onboarding3.png"),
    },
];

export default function Onboarding() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const ref = useRef<ScrollView>(null);

    const [page, setPage] = useState(0);
    const isLast = page === slides.length - 1;

    const completeOnboarding = async () => {
        // ✅ 다음부터 온보딩 안 뜨게
        await SecureStore.setItemAsync("hasOnboarded", "1");

        // ✅ 로그인/홈 분기
        const token = await SecureStore.getItemAsync("accessToken");
        router.replace(token ? "/home" : "/login");
    };

    const goNext = async () => {
        if (!isLast) {
            const next = page + 1;
            ref.current?.scrollTo({ x: next * W, animated: true }); // ✅ 버튼으로도 스와이프처럼 이동
            setPage(next); // ✅ 상태도 즉시 반영
            return;
        }
        await completeOnboarding();
    };

    const onScrollEnd = (x: number) => {
        const p = Math.round(x / W);
        setPage(p);
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                ref={ref}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => onScrollEnd(e.nativeEvent.contentOffset.x)}
            >
                {slides.map((s: any, idx) => (
                    <View key={idx} style={[styles.slide, { width: W }]}>
                        {/* 제목 */}
                        <Text style={styles.title}>{s.title}</Text>

                        {/* 카드 */}
                        <View style={styles.card}>
                            {/* 1페이지 */}
                            {idx === 0 && (
                                <Image source={s.image} style={styles.image} resizeMode="contain" />
                            )}

                            {/* 2페이지 손 2개 */}
                            {idx === 1 && (
                                <View style={styles.handWrap}>
                                    <Image source={s.image1} style={styles.hand} resizeMode="contain" />
                                    <Image source={s.image2} style={styles.hand} resizeMode="contain" />
                                </View>
                            )}

                            {/* ✅ 버튼 텍스트 변경 */}
                            <TouchableOpacity activeOpacity={0.9} onPress={goNext} style={styles.ctaBtn}>
                                <Text style={styles.ctaText}>{isLast ? "Start Cooking" : "Next"}</Text>
                            </TouchableOpacity>

                            {/* dots */}
                            <View style={styles.dots}>
                                {slides.map((_, i) => (
                                    <View
                                        key={i}
                                        style={[styles.dot, i === page ? styles.dotOn : styles.dotOff]}
                                    />
                                ))}
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={{ height: Math.max(16, insets.bottom) }} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: GREEN },

    slide: { alignItems: "center" },

    title: {
        marginTop: H * 0.1,
        textAlign: "center",
        fontSize: 18,
        fontWeight: "900",
        color: TEXT_DARK,
        lineHeight: 26,
    },

    card: {
        marginTop: H * 0.06,
        width: W * 0.88,
        flex: 1,
        backgroundColor: CARD,
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
    },

    image: {
        width: W * 0.55,
        height: W * 0.55,
        marginBottom: 18,
    },

    handWrap: {
        flexDirection: "row",
        gap: 20,
        marginBottom: 18,
    },
    hand: {
        width: W * 0.28,
        height: W * 0.28,
    },

    /* ✅ CTA 버튼: 마지막에 Start Cooking 느낌 살짝 */
    ctaBtn: {
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 22,
    },
    ctaText: {
        fontSize: 18,
        fontWeight: "900",
        color: TEXT_DARK,
    },

    dots: {
        flexDirection: "row",
        gap: 8,
        marginTop: 10,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotOn: { backgroundColor: GREEN },
    dotOff: { backgroundColor: "#000", opacity: 0.25 },
});