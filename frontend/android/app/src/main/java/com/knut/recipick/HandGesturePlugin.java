package com.knut.recipick;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.mrousavy.camera.frameprocessors.Frame;
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin;
import com.mrousavy.camera.frameprocessors.VisionCameraProxy;
import java.util.Map;
import java.util.HashMap;

// Vision Camera v4 방식의 플러그인 구조입니다.
public class HandGesturePlugin extends FrameProcessorPlugin {
    
    public HandGesturePlugin(@NonNull VisionCameraProxy proxy, @Nullable Map<String, Object> options) {
        super();
    }

    @Nullable
    @Override
    public Object callback(@NonNull Frame frame, @Nullable Map<String, Object> params) {
        // 💡 여기서 ML Kit을 써서 손을 분석합니다.
        // 일단 에러를 없애기 위해 빈 결과를 리턴하도록 구성합니다.
        Map<String, Object> result = new HashMap<>();
        result.put("gesture", "NONE"); 
        return result;
    }
}