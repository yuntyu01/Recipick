package com.knut.recipick;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry;
import java.util.Collections;
import java.util.List;

public class HandGesturePackage implements ReactPackage {
    static {
        // ✋ 여기서 'detectHands'라는 이름을 등록합니다!
        FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectHands", HandGesturePlugin::new);
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}