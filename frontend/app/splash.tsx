import React from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";

const { width: W } = Dimensions.get("window");

const GREEN = "#54CDA4";

export default function SplashScreenPage() {
    return (
        <View style={styles.container}>
            <Image
                source={require("../assets/images/recipick-logo.png")}
                style={styles.logo}
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: GREEN,
        alignItems: "center",
        justifyContent: "center",
    },

    logo: {
        width: W * 3.0,
        height: W * 1.0,
    },
});