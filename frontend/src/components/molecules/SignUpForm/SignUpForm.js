import React from 'react';
import { View } from '../../atoms/View/View';
import Input from '../../atoms/Input/Input';
import Button from '../../atoms/Button/Button';
import { Switch, Text } from 'react-native';
import { styles } from './styles';
import useLogionForm from '../../../behavior/molecules/Login/useLoginForm'; // Importe o hook de comportamento

const SingUpForm = ({setLoginOrSignUp}) => {
  const {
    isClinic,
    toggleIsClinicSwitch,
    handleRegister,
  } = useLogionForm();

  return (
    <View>
        <Input placeholder="Nome" style={styles.input} />
      <Input placeholder="e-mail" style={styles.input} />
      <Input placeholder="Telefone" style={styles.input} />
      <Input placeholder="Senha" style={styles.input} />
      <Input placeholder="Confirmação da senha" style={styles.input} />

      <View style={styles.switchContainer}>
        <Text style={styles.switchText}>Você é uma clínica?</Text>
        <Switch
          trackColor={{ false: '#000', true: '#000' }}
          thumbColor={isClinic ? 'green' : 'pink'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={toggleIsClinicSwitch}
          value={isClinic}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button onPress={setLoginOrSignUp} style={styles.button}>
          <Text style={styles.buttonText}>Voltar para Login</Text>
        </Button>
        <Button onPress={handleRegister} style={styles.button}>
          <Text style={styles.buttonText}>Cadastrar</Text>
        </Button>
      </View>
    </View>
  );
};

export default SingUpForm;
