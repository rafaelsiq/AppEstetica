import React from 'react';
import { View, Text } from 'react-native';
import Button from '../../atoms/Button/Button';
import Input from '../../atoms/Input/Input';
import { styles } from './styles';
import useLoginForm from '../../../behavior/molecules/Login/useLoginForm';


const LoginForm = ({ setLoginOrSignUp, handleLogin }) => {
  
  const { username, setUsername, password, setPassword, isPasswordHidden } = useLoginForm();

  return (
    <View>
      <Input placeholder="E-mail" value={username} onChangeText={setUsername} />
      <Input
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={isPasswordHidden}
      />
      <View style={styles.buttonContainer}>
        <Button onPress={setLoginOrSignUp} style={styles.button}>
          <Text style={styles.buttonText}>Cadastrar</Text>
        </Button>
        <Button         
        onPress={handleLogin}
        style={styles.button}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Button>
      </View>
    </View>
  );
};

export default LoginForm;
