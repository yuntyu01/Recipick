import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Launch() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/home'); // 👉 홈으로 이동
    }, 1200); // 1.2초

    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Recipick!</Text>
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
