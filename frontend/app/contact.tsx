import React from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Contact() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openMail = () => {
    const to = "support@recipick.app"; // 너 이메일로 바꿔
    const subject = encodeURIComponent("[레시픽] 문의");
    const body = encodeURIComponent("문의 내용을 적어주세요.\n\n- 기기/OS:\n- 앱 버전:\n- 상세 내용:\n");
    Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: 56, justifyContent: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#EFEFEF" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={22} color="#3B4F4E" />
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 18, fontWeight: "900", color: "#3B4F4E" }}>
          문의하기
        </Text>
      </View>

      <View style={{ padding: 18, gap: 12 }}>
        <Text>문의는 메일로 보내주면 제일 빨라요!</Text>
        <TouchableOpacity onPress={openMail} style={{ height: 48, borderRadius: 12, backgroundColor: "#F3F6F6", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "900", color: "#3B4F4E" }}>메일로 문의 보내기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}