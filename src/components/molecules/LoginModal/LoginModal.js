import React, { useState } from 'react';
import { Modal } from 'react-native';
import { styles } from './styles';
import { View } from '../../atoms/View/View';
import LoginForm from '../LoginForm/LoginForm';
import SingUpForm from '../SignUpForm/SignUpForm';

const LoginModal = () => {
  const [loginOrSignUp, setLoginOrSignUp] = useState(false)
  const setLoginOrSignUpAlternate = () => {
    setLoginOrSignUp(!loginOrSignUp)
  }
  return (
    <Modal>
      <View style={styles.modalBackground}>
        <View style={styles.modalContent}>
          {loginOrSignUp ? (
            <LoginForm
            setLoginOrSignUp={setLoginOrSignUpAlternate}
            />
          ) : (
            <SingUpForm
            setLoginOrSignUp={setLoginOrSignUpAlternate}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default LoginModal;
