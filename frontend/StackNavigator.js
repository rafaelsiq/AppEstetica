import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginScreen from './src/components/templates/LoginScreen'
import HomeScreen from './src/components/templates/HomeScreen'
import ScheduleScreen from './src/components/templates/ScheduleScreen'

const Stack = createNativeStackNavigator()

const StackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Group>
        <Stack.Screen name='Login' component={LoginScreen} />
        <Stack.Screen name='Home' component={HomeScreen} />
        <Stack.Screen name='Schedule' component={ScheduleScreen} />
      </Stack.Group>
    </Stack.Navigator>
  )
}
//<Stack.Screen name='Schedule' component={ScheduleScreen} />
//<Stack.Screen name='Login' component={LoginScreen} />
//<Stack.Screen name='Home' component={HomeScreen} />
export default StackNavigator