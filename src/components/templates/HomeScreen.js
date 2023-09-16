import React from 'react';
import { View } from '../atoms/View/View';
import { Keyboard, SafeAreaView, Text } from 'react-native';
import { styles } from './styles';

const HomeScreen = () => {
  const hideKeyboard = () => {
    Keyboard.dismiss();
  };
  return (
    <SafeAreaView onTouchStart={hideKeyboard} style={styles.modalBackground}>
      <Text>{'sad'}</Text>
    </SafeAreaView>
  );
};


export default HomeScreen;