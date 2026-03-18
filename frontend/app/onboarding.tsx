import React, { useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Stack, useRouter } from "expo-router";
import {
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");

const GREEN = "#54CDA4";
const CARD = "#F4F4F4";
const TEXT_DARK = "#243B3A";
const TEXT_MUTED = "#6B7B7A";
const DOT_OFF = "rgba(36,59,58,0.22)";
const GOOGLE_BTN_BG = "#FFFFFF";
const GOOGLE_BTN_BORDER = "#E6EBEA";

const slides = [
    {
        title: "Recipick!과 함께\n요리할 준비 되셨나요?",
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
    const [loading, setLoading] = useState(false);

    const isLast = page === slides.length - 1;

    const goNext = async () => {
        if (loading) return;

        if (!isLast) {
            const next = page + 1;
            ref.current?.scrollTo({ x: next * W, animated: true });
            setPage(next);
            return;
        }

        try {
            setLoading(true);
            await SecureStore.setItemAsync("hasOnboarded", "true");
            router.replace("/login");
        } catch (e) {
            console.log("[ONBOARDING SAVE ERROR]", e);
            router.replace("/login");
        } finally {
            setLoading(false);
        }
    };

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const nextPage = Math.round(x / W);
        setPage(nextPage);
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                ref={ref}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onMomentumScrollEnd={onScrollEnd}
            >
                {slides.map((s: any, idx) => (
                    <View key={idx} style={[styles.slide, { width: W }]}>
                        <Text style={styles.title}>{s.title}</Text>

                        <View style={styles.card}>
                            {idx === 0 && (
                                <View style={styles.illustrationWrap}>
                                    <View style={styles.circleBg} />
                                    <Image source={s.image} style={styles.panImage} resizeMode="contain" />
                                </View>
                            )}

                            {idx === 1 && (
                                <View style={styles.illustrationWrap}>
                                    <View style={styles.circleBg} />

                                    <View style={styles.handStage}>
                                        <Image
                                            source={s.image1}
                                            style={styles.handTop}
                                            resizeMode="contain"
                                        />
                                        <Image
                                            source={s.image2}
                                            style={styles.handBottom}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </View>
                            )}

                            {!isLast ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={goNext}
                                    style={styles.nextBtn}
                                >
                                    <Text style={styles.nextBtnLabel}>Next</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.lastActionWrap}>
                                    <TouchableOpacity
                                        activeOpacity={0.9}
                                        onPress={goNext}
                                        style={[styles.googleBtn, loading && { opacity: 0.7 }]}
                                        disabled={loading}
                                    >
                                        <Ionicons
                                            name="logo-google"
                                            size={22}
                                            color={TEXT_DARK}
                                            style={styles.googleIcon}
                                        />
                                        <Text style={styles.googleBtnText}>
                                            {loading ? "이동 중..." : "구글로 시작하기"}
                                        </Text>
                                    </TouchableOpacity>

                                    <Text style={styles.googleHelperText}>
                                        로그인 후 내 레시피와 기록을 이어서 관리할 수 있어요
                                    </Text>
                                </View>
                            )}

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

            <View style={{ height: Math.max(12, insets.bottom) }} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: GREEN,
    },

    slide: {
        alignItems: "center",
    },

    title: {
        marginTop: H * 0.065,
        textAlign: "center",
        fontSize: 17,
        fontWeight: "900",
        color: TEXT_DARK,
        lineHeight: 25,
    },

    card: {
        marginTop: H * 0.055,
        width: W * 0.86,
        height: H * 0.57,
        borderRadius: 38,
        backgroundColor: CARD,
        alignItems: "center",
        paddingTop: H * 0.09,
    },

    illustrationWrap: {
        width: W * 0.5,
        height: W * 0.5,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },

    circleBg: {
        position: "absolute",
        width: W * 0.4,
        height: W * 0.4,
        borderRadius: (W * 0.4) / 2,
        backgroundColor: "#DCEFDF",
    },

    panImage: {
        width: W * 0.36,
        height: W * 0.36,
    },

    handStage: {
        width: W * 0.4,
        height: W * 0.4,
        position: "relative",
    },

    handTop: {
        position: "absolute",
        width: W * 0.22,
        height: W * 0.22,
        left: W * 0.02,
        top: W * 0.005,
        transform: [{ rotate: "-14deg" }],
    },

    handBottom: {
        position: "absolute",
        width: W * 0.24,
        height: W * 0.24,
        right: W * 0.005,
        bottom: 0,
        transform: [{ rotate: "11deg" }],
    },

    nextBtn: {
        marginTop: H * 0.05,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },

    nextBtnLabel: {
        fontSize: 18,
        fontWeight: "900",
        color: TEXT_DARK,
    },

    lastActionWrap: {
        width: "100%",
        alignItems: "center",
        marginTop: H * 0.04,
        paddingHorizontal: 24,
    },

    googleBtn: {
        width: "100%",
        height: 56,
        borderRadius: 28,
        backgroundColor: GOOGLE_BTN_BG,
        borderWidth: 1,
        borderColor: GOOGLE_BTN_BORDER,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        position: "relative",
    },

    googleIcon: {
        position: "absolute",
        left: 18,
    },

    googleBtnText: {
        fontSize: 18,
        fontWeight: "900",
        color: TEXT_DARK,
    },

    googleHelperText: {
        marginTop: 10,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "700",
        color: TEXT_MUTED,
        textAlign: "center",
    },

    dots: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 12,
    },

    dot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
    },

    dotOn: {
        backgroundColor: GREEN,
    },

    dotOff: {
        backgroundColor: DOT_OFF,
    },
});