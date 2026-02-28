import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ================== FIGMA SCALE (430 기준) ================== */
const FIGMA_W = 430;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SCALE = SCREEN_W / FIGMA_W;
const s = (v: number) => Math.round(v * SCALE);

/* ---------- theme ---------- */
const GREEN = "#48C7A0";
const GREEN_SOFT = "#CFEFE3";
const CARD = "#FFFFFF";
const INPUT_BG = "#F2F2F2";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BLUE = "#2F6BFF";

export default function LoginPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [secure, setSecure] = useState(true);

  const onLogin = async () => {
    // TODO: API 붙이기
    // 성공하면 홈으로
    router.replace("/home");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top green area */}
      <View style={styles.topArea}>
        <Text style={styles.welcome}>Welcome</Text>
      </View>

      {/* White card */}
      <View style={styles.card}>
        <Text style={styles.label}>Username Or Email</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={id}
            onChangeText={setId}
            placeholder="example@example.com"
            placeholderTextColor="#B0B8C1"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={{ height: s(14) }} />

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="••••••••"
            placeholderTextColor="#B0B8C1"
            style={[styles.input, { paddingRight: s(44) }]}
            secureTextEntry={secure}
          />
          <TouchableOpacity
            onPress={() => setSecure((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={secure ? "eye-off-outline" : "eye-outline"} size={s(18)} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        <View style={{ height: s(22) }} />

        <TouchableOpacity activeOpacity={0.9} onPress={onLogin} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>로그인</Text>
        </TouchableOpacity>

        <View style={{ height: s(10) }} />

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/signup")}
          style={styles.btnSecondary}
        >
          <Text style={styles.btnSecondaryText}>회원가입</Text>
        </TouchableOpacity>

        <View style={{ height: s(14) }} />

        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.forgot}>비밀번호를 잊어버리셨나요?</Text>
        </TouchableOpacity>

        <View style={{ height: s(18) }} />

        <Text style={styles.fingerprint}>Use Fingerprint To Access</Text>

        <View style={{ height: s(16) }} />

        <Text style={styles.orText}>or sign up with</Text>

        <View style={{ height: s(14) }} />

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
            <Ionicons name="logo-facebook" size={s(18)} color={TEXT_DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={s(18)} color={TEXT_DARK} />
          </TouchableOpacity>
        </View>

        <View style={{ height: s(16) }} />

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Don’t have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.bottomLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* bottom spacing */}
      <View style={{ height: Math.max(s(18), insets.bottom) }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GREEN },

  topArea: {
    height: SCREEN_H * 0.18,
    alignItems: "center",
    justifyContent: "center",
  },
  welcome: {
    fontSize: s(28),
    fontWeight: "900",
    color: TEXT_DARK,
  },

  card: {
    flex: 1,
    backgroundColor: CARD,
    borderTopLeftRadius: s(42),
    borderTopRightRadius: s(42),
    paddingTop: s(26),
    paddingHorizontal: s(28),
  },

  label: { fontSize: s(13), fontWeight: "800", color: TEXT_MUTED, marginBottom: s(8) },

  inputWrap: {
    height: s(44),
    borderRadius: s(22),
    backgroundColor: INPUT_BG,
    justifyContent: "center",
    paddingHorizontal: s(16),
  },
  input: {
    fontSize: s(13),
    color: TEXT_DARK,
    paddingVertical: 0,
  },
  eyeBtn: {
    position: "absolute",
    right: s(14),
    height: s(44),
    justifyContent: "center",
  },

  btnPrimary: {
    height: s(44),
    borderRadius: s(22),
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: s(14), fontWeight: "900" },

  btnSecondary: {
    height: s(44),
    borderRadius: s(22),
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: { color: TEXT_DARK, fontSize: s(14), fontWeight: "900" },

  forgot: { textAlign: "center", fontSize: s(11), fontWeight: "700", color: TEXT_MUTED },

  fingerprint: { textAlign: "center", fontSize: s(11), fontWeight: "800", color: BLUE },

  orText: { textAlign: "center", fontSize: s(11), fontWeight: "700", color: TEXT_MUTED },

  socialRow: { flexDirection: "row", justifyContent: "center", gap: s(18) },
  socialBtn: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6E6E6",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  bottomText: { fontSize: s(11), color: TEXT_MUTED, fontWeight: "700" },
  bottomLink: { fontSize: s(11), color: BLUE, fontWeight: "900" },
});