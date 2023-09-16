import React from 'react'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import LoginScreen from './src/components/templates/LoginScreen'
import HomeScreen from './src/components/templates/HomeScreen'

const Stack = createNativeStackNavigator()

const StackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown:false}}>
    <Stack.Group>    
        <Stack.Screen name='Page1' component={LoginScreen} />
        <Stack.Screen name='Home' component={HomeScreen} />
    </Stack.Group>
  </Stack.Navigator>
  )
}

export default StackNavigator