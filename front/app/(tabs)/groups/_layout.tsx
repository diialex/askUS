import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[groupId]" />
      <Stack.Screen name="answer" />
      <Stack.Screen name="results" />
      <Stack.Screen name="invite" />
    </Stack>
  );
}
