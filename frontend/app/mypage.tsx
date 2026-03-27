import React, { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMeWithToken } from "../lib/api";

/* ================== FIGMA SCALE (430 기준) ================== */
const FIGMA_W = 430;
const { width: SCREEN_W } = Dimensions.get("window");
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

/* ---------- theme ---------- */
const TITLE = "#3B4F4E";
const BG = "#FFFFFF";
const CARD = "#FFFFFF";
const BORDER = "#E6E6E6";
const DIVIDER = "#EFEFEF";
const MUTED = "#6B7280";
const DANGER = "#E53935";
const AVATAR_BG = "#E9ECEF";

export default function MyPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState("레시픽 유저");

  // 1. getAccessToken 수정 (에러를 던지지 않고 null 반환)
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const token =
        (await SecureStore.getItemAsync("accessToken")) ||
        (await SecureStore.getItemAsync("access_token"));
      return token || null; 
    } catch (e) {
      return null;
    }
  };

  // 2. loadMe 수정 (토큰 없으면 로그인 페이지로 리다이렉트)
  const loadMe = useCallback(async () => {
    try {
      const token = await getAccessToken();

      // 💡 토큰이 없으면 로그인 화면으로 보냅니다.
      if (!token) {
        console.log("[MYPAGE] 토큰이 없어 로그인 페이지로 이동합니다.");
        router.replace("/login");
        return;
      }

      const me = await getMeWithToken(token);

      // 백엔드(auth_router.py) 구조에 맞춰 nickname을 우선적으로 가져옵니다.
      const resolvedName =
        me?.nickname ||
        me?.name ||
        "레시픽 유저";

      setUserName(resolvedName);
    } catch (e) {
      console.log("[MYPAGE LOAD ME ERROR]", e);
      // 에러가 나도(토큰 만료 등) 안전하게 로그인 페이지로 보냅니다.
      router.replace("/login");
    }
  }, [router]);

  // 화면이 포커스될 때마다 실행
  useFocusEffect(
    useCallback(() => {
      loadMe();
    }, [loadMe])
  );

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("refresh_token");

    router.replace("/login");
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: insets.top }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={TITLE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>마이페이지</Text>
      </View>

      <View style={styles.profileWrap}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={s(44)} color="#9AA0A6" />
        </View>
        <Text style={styles.userName}>{userName}</Text>
      </View>

      <View style={styles.card}>
        <Row label="문의하기" onPress={() => router.push("/contact")} />
        <View style={styles.divider} />
        <Row label="FAQ" onPress={() => router.push("/faq")} />
      </View>

      <View style={styles.links}>
        <TouchableOpacity onPress={() => router.push("/terms")}>
          <Text style={styles.linkText}>약관 및 동의 항목</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.linkText}>로그아웃</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/withdraw")}>
          <Text style={styles.withdrawText}>회원탈퇴</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={s(18)} color="#B0B6BD" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    height: s(56),
    justifyContent: "center",
    paddingHorizontal: s(18),
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: s(18),
    fontWeight: "900",
    color: TITLE,
    pointerEvents: "none",
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  profileWrap: {
    alignItems: "center",
    paddingTop: s(22),
    paddingBottom: s(18),
  },
  avatar: {
    width: s(92),
    height: s(92),
    borderRadius: s(46),
    backgroundColor: AVATAR_BG,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s(10),
  },
  userName: { fontSize: s(16), fontWeight: "900", color: "#111" },

  card: {
    marginLeft: s(30),
    marginRight: s(30),
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: s(12),
    overflow: "hidden",
    backgroundColor: CARD,
  },
  row: {
    height: s(52),
    paddingLeft: s(30),
    paddingRight: s(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
  },
  rowLabel: { fontSize: s(14), fontWeight: "700", color: "#2D2F33" },
  divider: { height: 1, backgroundColor: DIVIDER },

  links: {
    marginTop: s(16),
    paddingLeft: s(41),
    paddingRight: s(18),
    gap: s(10),
  },
  linkText: {
    fontSize: s(15),
    fontWeight: "600",
    color: MUTED,
  },

  withdrawText: {
    fontSize: s(15),
    fontWeight: "700",
    color: DANGER,
  },
});