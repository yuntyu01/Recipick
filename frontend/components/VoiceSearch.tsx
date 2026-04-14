import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as Speech from 'expo-speech'; 
import { Ionicons } from '@expo/vector-icons';
import { 
  ExpoSpeechRecognitionModule, 
  useSpeechRecognitionEvent 
} from "expo-speech-recognition";
import { askAi, AiAskRequest } from '../lib/api';

interface VoiceSearchProps {
  videoId: string;
  currentStep: number;
}

export default function VoiceSearch({ videoId, currentStep }: VoiceSearchProps) {
  const [isListening, setIsListening] = useState(false);
  const [resultText, setResultText] = useState("");

  // 🎙️ 음성 인식 실시간 결과 처리
  useSpeechRecognitionEvent("result", (event) => {
    // 가장 마지막에 인식된 문장을 가져옵니다.
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setResultText(transcript); 
      console.log("🗣️ 인식 중:", transcript);
    }
  });

  // 에러 발생 시 처리
  useSpeechRecognitionEvent("error", (event) => {
    console.error("❌ 음성 인식 에러:", event.error, event.message);
    setIsListening(false);
  });

  // 1️⃣ 마이크 버튼을 눌렀을 때 (실제 음성 인식 시작)
  const startListening = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert("권한 필요", "음성 인식을 위해 마이크 권한이 필요합니다.");
      return;
    }

    setResultText(""); // 이전 대화 초기화
    setIsListening(true);
    
    // 한국어 설정으로 음성 인식 엔진 가동
    ExpoSpeechRecognitionModule.start({
      lang: "ko-KR",
      interimResults: true, // 내가 말하는 도중에도 텍스트가 보이게 설정
    });
  };

  // 2️⃣ 마이크 버튼을 뗐을 때 (인식 종료 및 AI 서버 전송)
  const stopListening = async () => {
    setIsListening(false);
    ExpoSpeechRecognitionModule.stop();
    
    // 인식된 문장이 있을 때만 백엔드로 전송
    if (resultText.trim().length > 0) {
      handleVoiceCommand(resultText);
    } else {
      setResultText("말씀하신 내용을 듣지 못했어요.");
    }
  };

  // 3️⃣ 백엔드 AI 통신 로직 (성윤님 API와 연결)
  const handleVoiceCommand = async (text: string) => {
    try {
      console.log(`📡 서버 요청: "${text}"`);

      const body: AiAskRequest = {
        video_id: videoId,
        question: text,
        current_step: currentStep
      };

      const response = await askAi(body);
      
      if (response && response.answer) {
        setResultText(response.answer); // AI의 답변을 화면에 표시
        
        // AI의 답변을 한국어 음성으로 읽어줌 (TTS)
        Speech.speak(response.answer, { 
          language: 'ko-KR',
          pitch: 1.0,
          rate: 1.0 
        });
      }
    } catch (err) {
      console.error("❌ 서버 통신 에러:", err);
      setResultText("서버와 대화하는 중에 문제가 생겼어요.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {isListening ? (resultText || "듣고 있어요...") : (resultText || "마이크를 꾹 눌러 질문하세요")}
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
  container: { alignItems: 'center', padding: 20, width: '100%' },
  text: { 
    marginBottom: 20, 
    fontSize: 16, 
    color: '#3B4F4E', 
    textAlign: 'center', 
    fontWeight: '600',
    minHeight: 44, // 두 줄 정도의 높이 확보
  },
  btn: { 
    width: 74, 
    height: 74, 
    borderRadius: 37, 
    backgroundColor: '#54CDA4', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 }
  },
  btnActive: { 
    backgroundColor: '#FF6B6B',
    transform: [{ scale: 1.1 }] // 누를 때 살짝 커지는 효과
  }
});