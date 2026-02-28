import React from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Withdraw() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const doWithdraw = async () => {
    Alert.alert("회원탈퇴", "정말 탈퇴할까요? 데이터가 삭제될 수 있어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "탈퇴",
        style: "destructive",
        onPress: async () => {
          // TODO: 탈퇴 API 호출
          // TODO: 토큰 삭제
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: 56, justifyContent: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#EFEFEF" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={22} color="#3B4F4E" />
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 18, fontWeight: "900", color: "#3B4F4E" }}>
          회원탈퇴
        </Text>
      </View>

      <View style={{ padding: 18, gap: 12 }}>
        <Text style={{ color: "#6B7280" }}>
          탈퇴하면 저장된 레시피/기록이 삭제될 수 있어요.
        </Text>

        <TouchableOpacity onPress={doWithdraw} style={{ height: 48, borderRadius: 12, backgroundColor: "#FFECEC", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "900", color: "#E53935" }}>회원탈퇴 진행</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}