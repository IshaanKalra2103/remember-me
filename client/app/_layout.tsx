import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "@/providers/AppProvider";
import MainLoader from "@/components/MainLoader";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="caregiver" options={{ headerShown: false }} />
      <Stack.Screen name="patient-pin" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="patient-home" options={{ headerShown: false }} />
      <Stack.Screen name="patient-recognize" options={{ headerShown: false }} />
      <Stack.Screen name="patient-result" options={{ headerShown: false }} />
      <Stack.Screen name="patient-not-sure" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'About Privacy' }} />
    </Stack>
  );
}

function AppBootstrap() {
  const { isLoading } = useApp();

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <MainLoader />
      </View>
    );
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.root}>
        <AppProvider>
          <AppBootstrap />
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
