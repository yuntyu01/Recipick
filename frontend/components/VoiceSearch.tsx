import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as Speech from 'expo-speech'; 
import { Ionicons } from '@expo/vector-icons';
import { askAi, AiAskRequest } from '../lib/api'; // 백엔드 주소 연결 확인 필수!

// 🔴 실제 네이티브 모듈은 빌드 전까지 주석 처리 (Expo Go 튕김 방지)
/*
import { 
  requestPermissionsAsync, 
  startListeningAsync, 
  stopListeningAsync 
} from 'expo-speech-recognition'; 
*/

interface VoiceSearchProps {
  videoId: string;
  currentStep: number;
}

export default function VoiceSearch({ videoId, currentStep }: VoiceSearchProps) {
  const [isListening, setIsListening] = useState(false);
  const [resultText, setResultText] = useState("");
  const [isAiMode, setIsAiMode] = useState(false);

  // 1️⃣ 마이크를 눌렀을 때 (시뮬레이션 시작)
  const startListening = async () => {
    setIsListening(true);
    setResultText("듣고 있어요... (테스트 모드)");
    console.log("--------------------------------");
    console.log("🎤 마이크 눌림: 음성 인식 시작 시뮬레이션");
  };

  // 2️⃣ 마이크를 뗐을 때 (가짜 데이터로 결과 확인)
  const stopListening = async () => {
    setIsListening(false);
    
    // 💡 테스트용 가짜 문장 (이 문구로 AI에게 질문이 갑니다)
    const fakeVoiceResult = "양파 손질하는 법 좀 알려줘"; 
    
    setResultText(fakeVoiceResult);
    console.log("🎤 인식 결과(가짜):", fakeVoiceResult);
    
    // AI 대화 로직 실행
    handleVoiceCommand(fakeVoiceResult);
  };

  // 3️⃣ AI 통신 로직 (CMD 콘솔에서 진행 상황 확인 가능)
  const handleVoiceCommand = async (text: string) => {
    try {
      console.log("📡 백엔드로 요청 보내는 중...");
      console.log(`📍 요청 정보 - 비디오ID: ${videoId}, 현재단계: ${currentStep}, 질문: ${text}`);

      const body: AiAskRequest = {
        video_id: videoId,
        question: text,
        current_step: currentStep
      };

      // 실제 백엔드 API 호출
      const response = await askAi(body);
      
      if (response && response.answer) {
        console.log("✅ AI 응답 도착:", response.answer);
        setResultText(response.answer); // 화면에 대답 표시
        
        // 폰에서 실제로 읽어주는지 확인
        Speech.speak(response.answer, { language: 'ko-KR' });
      } else {
        console.log("⚠️ AI 응답이 비어있습니다.");
      }
    } catch (err) {
      console.error("❌ API 통신 실패:", err);
      setResultText("서버 연결에 실패했어요.");
      Speech.speak("서버에 연결할 수 없어요. 다시 시도해 주세요.");
    }
    console.log("--------------------------------");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {isListening ? resultText : (isAiMode ? "🤖 AI 모드 활성" : "마이크를 꾹 눌러주세요")}
      </Text>
      
      <TouchableOpacity 
        onPressIn={startListening} 
        onPressOut={stopListening}
        style={[styles.btn, isListening && styles.btnActive]}
      >
        <Ionicons name={isListening ? "mic" : "mic-outline"} size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 20 },
  text: { marginBottom: 15, fontSize: 16, color: '#48C7A0', textAlign: 'center', fontWeight: '600' },
  btn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#48C7A0', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  btnActive: { backgroundColor: '#FF5A5F' }
});