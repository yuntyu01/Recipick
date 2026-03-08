import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const boot = async () => {
      // 런치 연출
      await new Promise((r) => setTimeout(r, 800));

      const hasOnboarded = await SecureStore.getItemAsync('hasOnboarded');
      if (!hasOnboarded) {
        router.replace('/onboarding'); // ✅ 처음만 온보딩
        return;
      }

      const token = await SecureStore.getItemAsync('accessToken');
      router.replace(token ? '/home' : '/login');
    };

    boot();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Recipick!</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#54CDA4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
});