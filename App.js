import { StyleSheet, View } from 'react-native';
import LoginPage from './src/components/pages/LoginPage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/components/templates/LoginScreen';
import HomeScreen from './src/components/templates/HomeScreen';

export default function App() {
  const Stack = createStackNavigator();
  
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login"
          component={LoginScreen} />
        <Stack.Screen name="Home"
          component={HomeScreen} />
      </Stack.Navigator>
      </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
