import React, { useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deleteMe } from "./lib/api";

export default function Withdraw() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const clearAuthStorage = async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("refresh_token");
    await SecureStore.deleteItemAsync("user");
  };

  const handleWithdraw = async () => {
    if (loading) return;

    try {
      setLoading(true);

      await deleteMe();
      await clearAuthStorage();

      Alert.alert(
        "회원탈퇴 완료",
        "계정이 삭제되었습니다.",
        [
          {
            text: "확인",
            onPress: () => router.replace("/login"),
          },
        ],
        { cancelable: false }
      );
    } catch (e: any) {
      console.log("[WITHDRAW ERROR]", e);

      Alert.alert(
        "회원탈퇴 실패",
        e?.message || "잠시 후 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  const doWithdraw = () => {
    if (loading) return;

    Alert.alert(
      "회원탈퇴",
      "정말 탈퇴할까요?\n계정 정보와 저장된 데이터가 삭제될 수 있어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "탈퇴",
          style: "destructive",
          onPress: handleWithdraw,
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          height: 56,
          justifyContent: "center",
          paddingHorizontal: 18,
          borderBottomWidth: 1,
          borderBottomColor: "#EFEFEF",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 44, height: 44, justifyContent: "center" }}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={22} color="#3B4F4E" />
        </TouchableOpacity>

        <Text
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 18,
            fontWeight: "900",
            color: "#3B4F4E",
          }}
        >
          회원탈퇴
        </Text>
      </View>

      <View style={{ padding: 18, gap: 12 }}>
        <Text style={{ color: "#6B7280", lineHeight: 22 }}>
          탈퇴하면 저장된 레시피, 기록, 계정 정보가 삭제될 수 있어요.
          {"\n"}
          삭제된 계정은 복구할 수 없어요.
        </Text>

        <TouchableOpacity
          onPress={doWithdraw}
          disabled={loading}
          style={{
            height: 48,
            borderRadius: 12,
            backgroundColor: "#FFECEC",
            alignItems: "center",
            justifyContent: "center",
            opacity: loading ? 0.6 : 1,
            flexDirection: "row",
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#E53935" />
              <Text style={{ fontWeight: "900", color: "#E53935" }}>
                처리 중...
              </Text>
            </>
          ) : (
            <Text style={{ fontWeight: "900", color: "#E53935" }}>
              회원탈퇴 진행
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}