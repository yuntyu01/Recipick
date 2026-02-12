import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 홈 */}
        <Stack.Screen name="index" />

        {/* 마이페이지 */}
        <Stack.Screen name="mypage" />

        {/* 링크 생성 */}
        <Stack.Screen name="create-link" />

        {/* 레시피 상세 */}
        <Stack.Screen name="recipe/[id]" />

        {/* 모달 필요하면 */}
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal' }}
        />
      </Stack>

      <StatusBar style="auto" />
    </>
  );
}
