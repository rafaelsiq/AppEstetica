// screens/LoginPage.js

import React from 'react';
import { SafeAreaView } from 'react-native';
import LoginScreen from '../templates/LoginScreen';
import { View } from '../atoms/View/View';
import { styles } from './styles';

const LoginPage = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
        <View>
          <LoginScreen />
        </View>
    </SafeAreaView>
  );
};

export default LoginPage;
