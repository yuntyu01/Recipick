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
const CARD = "#FFFFFF";
const INPUT_BG = "#F2F2F2";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BLUE = "#2F6BFF";

export default function SignUpPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  const onCreate = async () => {
    // TODO: 회원가입 API
    router.replace("/login");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topArea}>
        <Text style={styles.title}>Create Account</Text>
      </View>

      <View style={styles.card}>
        <Field label="Full Name" value={name} onChangeText={setName} placeholder="example@example.com" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="example@example.com" keyboardType="email-address" />
        <Field label="Mobile Number" value={mobile} onChangeText={setMobile} placeholder="+ 123 456 789" keyboardType="phone-pad" />
        <Field label="Date Of Birth" value={dob} onChangeText={setDob} placeholder="DD / MM / YYYY" />

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="••••••••"
            placeholderTextColor="#B0B8C1"
            style={[styles.input, { paddingRight: s(44) }]}
            secureTextEntry={secure1}
          />
          <TouchableOpacity onPress={() => setSecure1((v) => !v)} style={styles.eyeBtn}>
            <Ionicons name={secure1 ? "eye-off-outline" : "eye-outline"} size={s(18)} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        <View style={{ height: s(14) }} />

        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={pw2}
            onChangeText={setPw2}
            placeholder="••••••••"
            placeholderTextColor="#B0B8C1"
            style={[styles.input, { paddingRight: s(44) }]}
            secureTextEntry={secure2}
          />
          <TouchableOpacity onPress={() => setSecure2((v) => !v)} style={styles.eyeBtn}>
            <Ionicons name={secure2 ? "eye-off-outline" : "eye-outline"} size={s(18)} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        <View style={{ height: s(14) }} />

        <Text style={styles.terms}>
          By continuing, you agree to{"\n"}
          <Text style={{ fontWeight: "900" }}>Terms of Use</Text> and <Text style={{ fontWeight: "900" }}>Privacy Policy</Text>.
        </Text>

        <View style={{ height: s(14) }} />

        <TouchableOpacity activeOpacity={0.9} onPress={onCreate} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>로그인</Text>
        </TouchableOpacity>

        <View style={{ height: s(14) }} />

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={styles.bottomLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: Math.max(s(18), insets.bottom) }} />
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: any;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B0B8C1"
          style={styles.input}
          autoCapitalize="none"
          keyboardType={keyboardType}
        />
      </View>
      <View style={{ height: s(14) }} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GREEN },

  topArea: {
    height: SCREEN_H * 0.18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: s(26), fontWeight: "900", color: "#0F172A" },

  card: {
    flex: 1,
    backgroundColor: CARD,
    borderTopLeftRadius: s(42),
    borderTopRightRadius: s(42),
    paddingTop: s(22),
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
  input: { fontSize: s(13), color: TEXT_DARK, paddingVertical: 0 },

  eyeBtn: {
    position: "absolute",
    right: s(14),
    height: s(44),
    justifyContent: "center",
  },

  terms: {
    textAlign: "center",
    fontSize: s(10),
    fontWeight: "700",
    color: TEXT_MUTED,
    lineHeight: s(14),
  },

  btnPrimary: {
    height: s(44),
    borderRadius: s(22),
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: s(14), fontWeight: "900" },

  bottomRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  bottomText: { fontSize: s(11), color: TEXT_MUTED, fontWeight: "700" },
  bottomLink: { fontSize: s(11), color: BLUE, fontWeight: "900" },
});