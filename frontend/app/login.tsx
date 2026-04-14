import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
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
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously // 🔥 익명 로그인 함수 추가
} from "firebase/auth";

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";

import { auth } from "../lib/firebase";

WebBrowser.maybeCompleteAuthSession();

/* ================== FIGMA SCALE ================== */
const FIGMA_W = 430;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

const GREEN = "#48C7A0";
const GREEN_SOFT = "#CFEFE3";
const CARD = "#FFFFFF";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#64748B";

export default function LoginPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const redirectUri = makeRedirectUri({
    scheme: "recipick",
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "1035075506580-3kof887vb36b6res4m0ejg9dn0dnep4j.apps.googleusercontent.com",
    iosClientId: "1035075506580-kmbkqr39j5f4e7bilcjr5ivpfrqvj0t9.apps.googleusercontent.com",
    webClientId: "1035075506580-8sha9t1t2mi2o66q2onjh3q4i7eq9c28.apps.googleusercontent.com",
    redirectUri,
  });

  /* 🔥 앱 로그인 성공 처리 (구글 응답 감시) */
  useEffect(() => {
    const saveAppData = async () => {
      if (response?.type === "success") {
        const { authentication } = response;
        if (authentication?.idToken) {
          if (Platform.OS !== 'web') {
            await SecureStore.setItemAsync("accessToken", authentication.idToken);
          } else {
            localStorage.setItem("accessToken", authentication.idToken);
          }
        }
        router.replace("/home");
      }
    };
    saveAppData();
  }, [response]);

  /* 🔥 1. 구글 로그인 실행 */
  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        localStorage.setItem("accessToken", idToken);
        router.replace("/home");
      } else {
        await promptAsync();
      }
    } catch (error) {
      console.error(error);
      Alert.alert("로그인 실패", "문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* 🔥 2. 파이어베이스 익명 로그인 실행 */
  const handleAnonymousLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await signInAnonymously(auth);
      const idToken = await result.user.getIdToken();

      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync("accessToken", idToken);
      } else {
        localStorage.setItem("accessToken", idToken);
      }

      console.log("익명 로그인 성공!");
      router.replace("/home");
    } catch (error) {
      console.error(error);
      Alert.alert("익명 로그인 실패", "임시 로그인을 진행할 수 없습니다.");
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
          <Ionicons name="restaurant" size={s(34)} color={GREEN} />
        </View>

        <Text style={styles.title}>환영합니다!</Text>
        <Text style={styles.desc}>
          로그인하고 나만의 레시피를{"\n"}안전하게 보관해보세요.
        </Text>

        <View style={{ height: s(32) }} />

        {/* 구글 로그인 버튼 */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleGoogleLogin}
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          disabled={loading}
        >
          <Ionicons name="logo-google" size={s(20)} color="white" />
          <Text style={styles.primaryBtnText}>구글 계정으로 시작하기</Text>
        </TouchableOpacity>

        <View style={{ height: s(12) }} /> {/* 버튼 사이 간격 */}

                {/* 익명 로그인 버튼 (구글 버튼과 똑같은 도형 스타일로 변경) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAnonymousLogin}
                  style={[styles.secondaryBtn, loading && { opacity: 0.7 }]}
                  disabled={loading}
                >
                  <Ionicons name="person-outline" size={s(20)} color="white" />
                  <Text style={styles.primaryBtnText}>로그인 없이 시작하기</Text>
                </TouchableOpacity>

        <View style={{ height: s(20) }} />
        <Text style={styles.footerText}>
          익명 로그인 시 기기 변경 시 데이터가 유실될 수 있습니다.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GREEN },
  topArea: { height: SCREEN_H * 0.2, alignItems: "center", justifyContent: "center", paddingHorizontal: s(24) },
  logo: { fontSize: s(30), fontWeight: "900", color: TEXT_DARK },
  subtitle: { marginTop: s(8), fontSize: s(13), fontWeight: "700", color: TEXT_DARK, opacity: 0.75, textAlign: "center" },
  card: { flex: 1, backgroundColor: CARD, borderTopLeftRadius: s(42), borderTopRightRadius: s(42), paddingTop: s(32), paddingHorizontal: s(28) },
  heroIconWrap: { width: s(68), height: s(68), borderRadius: s(34), backgroundColor: GREEN_SOFT, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { marginTop: s(18), fontSize: s(22), fontWeight: "900", color: TEXT_DARK, textAlign: "center" },
  desc: { marginTop: s(10), fontSize: s(13), lineHeight: s(20), fontWeight: "700", color: TEXT_MUTED, textAlign: "center" },

  // 🟢 구글 로그인 버튼 스타일
  primaryBtn: {
    height: s(52),
    borderRadius: s(26),
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(10),
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: s(4) },
  },

  // 🔵 익명 로그인 버튼 스타일 (여기가 빠져있었어요!)
  secondaryBtn: {
    height: s(52),
    borderRadius: s(26),
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(10),
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: s(4) },
  },

  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: s(15),
    fontWeight: "900",
  },
  footerText: {
    fontSize: s(12),
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: s(10),
    fontWeight: "600",
  },
});