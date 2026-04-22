import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../lib/firebase";

/* ================== FIGMA SCALE ================== */
const FIGMA_W = 430;
const { width: SCREEN_W } = Dimensions.get("window");
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

const GREEN = "#48C7A0";
const TEXT_DARK = "#0F172A";

export default function LoginPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // 🚀 앱 진입 시 자동으로 익명 로그인을 실행합니다.
    const autoLogin = async () => {
      try {
        const result = await signInAnonymously(auth);
        const user = result.user;
        const idToken = await user.getIdToken();

        // 플랫폼(Web/App)에 따른 토큰 저장 처리
        if (Platform.OS === "web") {
          localStorage.setItem("accessToken", idToken);
          localStorage.setItem("userId", user.uid);
          localStorage.setItem("nickname", "게스트");
        } else {
          // 모바일 환경에서는 보안 저장소(SecureStore) 사용
          await SecureStore.setItemAsync("accessToken", idToken);
        }

        console.log("자동 익명 로그인 성공! UID:", user.uid);

        // 로그인이 완료되면 즉시 홈 화면으로 이동합니다.
        router.replace("/home");
      } catch (error) {
        console.error("자동 로그인 중 오류 발생:", error);
        // 필요 시 여기서 에러 알림(Alert)을 띄울 수 있습니다.
      }
    };

    autoLogin();
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 상단 헤더 숨김 처리 */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <Text style={styles.logo}>Recipick!</Text>
        <Text style={styles.subtitle}>사용자 정보를 확인하고 있습니다...</Text>

        <View style={{ height: s(40) }} />

        {/* 로그인 처리 중임을 보여주는 로딩 인디케이터 */}
        <ActivityIndicator size="large" color={TEXT_DARK} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GREEN,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontSize: s(40),
    fontWeight: "900",
    color: TEXT_DARK,
  },
  subtitle: {
    marginTop: s(10),
    fontSize: s(16),
    fontWeight: "700",
    color: TEXT_DARK,
    opacity: 0.8,
  },
});