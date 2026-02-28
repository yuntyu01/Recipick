import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  // ✅ JSX 밖(컴포넌트 안)에 함수 선언해야 함
  const handleLogout = async () => {
    // TODO: SecureStore/AsyncStorage에서 토큰 삭제
    // await SecureStore.deleteItemAsync("accessToken");
    // await SecureStore.deleteItemAsync("refreshToken");

    router.replace("/login"); // 너 프로젝트 로그인 경로로 맞춰
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ✅ 상단 안전영역 */}
      <View style={{ height: insets.top }} />

      {/* ===== Header ===== */}
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

      {/* Profile */}
      <View style={styles.profileWrap}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={s(44)} color="#9AA0A6" />
        </View>
        <Text style={styles.userName}>레시픽 유저</Text>
      </View>

      {/* ✅ Menu Card (문의/FAQ) */}
      <View style={styles.card}>
        <Row label="문의하기" onPress={() => router.push("/contact")} />
        <View style={styles.divider} />
        <Row label="FAQ" onPress={() => router.push("/faq")} />
      </View>

      {/* ✅ Links (약관/로그아웃/탈퇴) */}
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
    marginHorizontal: s(18),
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: s(12),
    overflow: "hidden",
    backgroundColor: CARD,
  },
  row: {
    height: s(52),
    paddingHorizontal: s(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
  },
  rowLabel: { fontSize: s(14), fontWeight: "700", color: "#2D2F33" },
  divider: { height: 1, backgroundColor: DIVIDER },

  links: { marginTop: s(16), paddingHorizontal: s(18), gap: s(10) },
  linkText: { fontSize: s(12), fontWeight: "600", color: MUTED },
  withdrawText: { fontSize: s(12), fontWeight: "700", color: DANGER },
});