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
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

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

  // 1. [수정] useProxy를 제거하고, app.json에 설정한 scheme을 사용합니다.
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "549481647484-1nnosudvcos4btr683rh92lf23r8cam2.apps.googleusercontent.com",
    iosClientId: "549481647484-bmquvsfr9sg4cfrnt0cpvi09ioktgb8u.apps.googleusercontent.com",
    webClientId: "549481647484-7p2003hd98uqmfmgvsclffao7c8bu685.apps.googleusercontent.com",
  });

  /* 🔥 앱 로그인 성공 처리 */
  useEffect(() => {
    const saveAppData = async () => {
      // response가 돌아왔을 때 처리
      if (response?.type === "success") {
        const { authentication } = response;
        const idToken = authentication?.idToken;

        if (idToken) {
          if (Platform.OS !== 'web') {
            await SecureStore.setItemAsync("accessToken", idToken);
          } else {
            localStorage.setItem("accessToken", idToken);
          }
          console.log("앱 로그인 성공 및 토큰 저장 완료!");
          router.replace("/home");
        }
      } else if (response?.type === "dismiss") {
        setLoading(false); // 사용자가 취소했을 때 로딩 해제
      }
    };

    saveAppData();
  }, [response]);

  /* 🔥 로그인 버튼 로직 */
  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (Platform.OS === "web") {
        // 웹은 기존 signInWithPopup 방식 유지
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        localStorage.setItem("accessToken", idToken);
        router.replace("/home");
      } else {
        // 📱 앱 로그인 실행
        const result = await promptAsync();
        if (result.type !== 'success') setLoading(false);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("로그인 에러", "구글 인증에 실패했습니다.");
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
        <Text style={styles.subtitle}>
          링크 하나로 레시피를 바로 만들어요
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="logo-google" size={s(34)} color={GREEN} />
        </View>

        <Text style={styles.title}>구글로 시작하기</Text>
        <Text style={styles.desc}>
          백엔드 서버와 연동하여{"\n"}
          나만의 레시피를 안전하게 보관하세요.
        </Text>

        <View style={{ height: s(32) }} />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleGoogleLogin}
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "연결 중..." : "구글 계정으로 로그인"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: s(20) }} />
        <Text style={styles.footerText}>
          앱/웹 모두 구글 로그인을 지원합니다.
        </Text>
      </View>
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
    borderColor: "#E7ECEF", // BORDER 변수 대신 직접 넣거나 위에 정의된 값을 쓰세요
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
  // 🟢 여기에 footerText가 들어가야 합니다!
  footerText: {
    fontSize: s(12),
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: s(10),
    fontWeight: "600",
  },
});