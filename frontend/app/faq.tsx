import React from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FAQ() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: 56, justifyContent: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#EFEFEF" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={22} color="#3B4F4E" />
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 18, fontWeight: "900", color: "#3B4F4E" }}>
          FAQ
        </Text>
      </View>

      <View style={{ padding: 18, gap: 14 }}>
        <Text style={{ fontWeight: "900" }}>Q. 레시피는 어떻게 저장하나요?</Text>
        <Text>A. 링크를 붙여넣고 생성하면 내 레시피에 저장돼요.</Text>

        <Text style={{ fontWeight: "900" }}>Q. 결제는 언제 되나요?</Text>
        <Text>A. 현재는 MVP라 결제 기능은 준비 중이에요.</Text>
      </View>
    </View>
  );
}