import React from 'react';
import { TextInput } from 'react-native';
import { styles } from './styles';

const Input = ({ placeholder, value, onChangeText, secureTextEntry }) => {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor='gray'
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      style={styles.input}
    />
  );
};

export default Input;
