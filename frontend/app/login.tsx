import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Stack, useRouter } from "expo-router";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInAnonymously } from "firebase/auth";

import { auth } from "../lib/firebase";

/* ================== FIGMA SCALE (430 기준) ================== */
const FIGMA_W = 430;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

/* ---------- theme ---------- */
const GREEN = "#48C7A0";
const GREEN_SOFT = "#CFEFE3";
const CARD = "#FFFFFF";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BORDER = "#E7ECEF";

export default function LoginPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);

  const goPreviewHomeWithAnonymousFirebase = async () => {
    if (loading) return;

    try {
      setLoading(true);

      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("access_token");
      await SecureStore.deleteItemAsync("refreshToken");
      await SecureStore.deleteItemAsync("refresh_token");
      await SecureStore.deleteItemAsync("userId");
      await SecureStore.deleteItemAsync("nickname");
      await SecureStore.deleteItemAsync("profileImage");

      const userCredential = await signInAnonymously(auth);
      const firebaseUser = userCredential.user;
      const firebaseIdToken = await firebaseUser.getIdToken(true);

      await SecureStore.setItemAsync("hasOnboarded", "true");
      await SecureStore.setItemAsync("devPreviewMode", "true");
      await SecureStore.setItemAsync("accessToken", firebaseIdToken);
      await SecureStore.setItemAsync("userId", firebaseUser.uid);
      await SecureStore.setItemAsync("nickname", "미리보기 사용자");
      await SecureStore.setItemAsync("profileImage", "");

      router.replace("/home");
    } catch (e: any) {
      console.error("[ANONYMOUS PREVIEW LOGIN ERROR FULL]", e);
      Alert.alert(
        "익명 로그인 실패",
        JSON.stringify(
          {
            code: e?.code,
            message: e?.message,
            name: e?.name,
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topArea}>
        <Text style={styles.logo}>Recipick!</Text>
        <Text style={styles.subtitle}>링크 하나로 레시피를 바로 만들어요</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="flask-outline" size={s(34)} color={GREEN} />
        </View>

        <Text style={styles.title}>분석 가능한 미리보기 시작</Text>
        <Text style={styles.desc}>
          Expo Go에서는 구글 로그인이 막혀 있어서{"\n"}
          임시로 Firebase 익명 로그인으로 홈과 레시피 분석을 사용할게요.
        </Text>

        <View style={{ height: s(24) }} />

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={goPreviewHomeWithAnonymousFirebase}
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          disabled={loading}
        >
          <Ionicons
            name="arrow-forward-circle-outline"
            size={s(18)}
            color="#FFFFFF"
          />
          <Text style={styles.primaryBtnText}>
            {loading ? "준비 중..." : "분석 가능한 홈으로 가기"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: s(14) }} />

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            • 이건 임시 개발용 로그인 방식이에요.
          </Text>
          <Text style={styles.noticeText}>
            • 구글 로그인 대신 Firebase 익명 로그인을 사용해 분석 기능만 살립니다.
          </Text>
          <Text style={styles.noticeText}>
            • 나중에 안드로이드 스튜디오 / Dev Build로 가면 구글 로그인으로 교체하면 돼요.
          </Text>
        </View>
      </View>

      <View style={{ height: Math.max(s(18), insets.bottom) }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GREEN,
  },

  topArea: {
    height: SCREEN_H * 0.2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(24),
  },

  logo: {
    fontSize: s(30),
    fontWeight: "900",
    color: TEXT_DARK,
  },

  subtitle: {
    marginTop: s(8),
    fontSize: s(13),
    fontWeight: "700",
    color: TEXT_DARK,
    opacity: 0.75,
    textAlign: "center",
  },

  card: {
    flex: 1,
    backgroundColor: CARD,
    borderTopLeftRadius: s(42),
    borderTopRightRadius: s(42),
    paddingTop: s(32),
    paddingHorizontal: s(28),
  },

  heroIconWrap: {
    width: s(68),
    height: s(68),
    borderRadius: s(34),
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  title: {
    marginTop: s(18),
    fontSize: s(22),
    fontWeight: "900",
    color: TEXT_DARK,
    textAlign: "center",
  },

  desc: {
    marginTop: s(10),
    fontSize: s(13),
    lineHeight: s(20),
    fontWeight: "700",
    color: TEXT_MUTED,
    textAlign: "center",
  },

  primaryBtn: {
    height: s(52),
    borderRadius: s(26),
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(10),
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: s(4) },
    elevation: 3,
  },

  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: s(15),
    fontWeight: "900",
  },

  noticeBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: s(16),
    paddingVertical: s(14),
    paddingHorizontal: s(14),
    backgroundColor: "#F8FAFB",
    gap: s(8),
  },

  noticeText: {
    fontSize: s(12),
    lineHeight: s(18),
    fontWeight: "700",
    color: TEXT_MUTED,
  },
});