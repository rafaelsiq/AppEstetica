import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

const PaymentScreen = () => {
  const navigation = useNavigation();


  const handleLogin = () => {
    navigation.navigate('Home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Métodos de Pagamento</Text>
      <View style={styles.qrCodeContainer}>
        <Image source={require('../../assets/payment/paymentqrcode.jpg')} style={styles.qrCode} />
      </View>
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Finalizar Pagamento</Text>
      </TouchableOpacity>
      <Text style={styles.footerText}>@layaneestetica</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    position:'absolute',
    top:80,
    fontFamily: 'Family',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  qrCodeContainer: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: 'black',
    padding: 10,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  button: {
    position:'absolute',
    bottom:60,
    backgroundColor: '#F6D4C7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  footerText: {
    position: 'absolute',
    bottom: 30,
    color: 'black',
    fontSize: 16,
  },
});

export default PaymentScreen;
