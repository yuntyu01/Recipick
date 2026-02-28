import React from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export default function Terms() {
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
          약관
        </Text>
      </View>

      <WebView source={{ uri: "https://YOUR_TERMS_URL" }} />
    </View>
  );
}