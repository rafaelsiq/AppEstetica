import React, { useState } from 'react';
import {  Keyboard, SafeAreaView } from 'react-native';
import { View } from '../atoms/View/View';
import LoginForm from '../molecules/LoginForm/LoginForm';
import SingUpForm from '../molecules/SignUpForm/SignUpForm';
import { styles } from './styles';
import { useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
  const hideKeyboard = () => {
    Keyboard.dismiss();
  };
  const [loginOrSignUp, setLoginOrSignUp] = useState(false);

  const setLoginOrSignUpAlternate = () => {
    setLoginOrSignUp(!loginOrSignUp);
  };
  
  const navigation = useNavigation();

  const handleLogin = () => {
    console.log('handleLogin');
    navigation.navigate('Home');
  }

  return (
    <SafeAreaView onTouchStart={hideKeyboard} style={styles.modalBackground}>
        <View style={styles.modalContent}>
          {loginOrSignUp ? (
            <LoginForm
              setLoginOrSignUp={setLoginOrSignUpAlternate}
              handleLogin={handleLogin}
            />
          ) : (
            <SingUpForm setLoginOrSignUp={setLoginOrSignUpAlternate} />
          )}
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
