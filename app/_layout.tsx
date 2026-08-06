import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "white" },
          animation: "slide_from_right",
          header: () => null,
          navigationBarHidden: true,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="medications/add"
          options={{
            headerShown: false,
            headerBackTitle: "",
            title: "",
          }}
        />
        <Stack.Screen
          name="refills"
          options={{
            headerShown: false,
            headerBackTitle: "",
            title: "",
          }}
        />
        <Stack.Screen
          name="calendar"
          options={{
            headerShown: false,
            headerBackTitle: "",
            title: "",
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            headerShown: false,
            headerBackTitle: "",
            title: "",
          }}
        />
      </Stack>
    </>
  );
}
