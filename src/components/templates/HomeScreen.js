import React from 'react';
import { View } from '../atoms/View/View';
import { Text, SafeAreaView, TouchableOpacity, Keyboard } from 'react-native';
import { styles } from './styles';
import BannerCarousel from '../atoms/BannerCarrossel/BannerCarousel';
import { Icon } from 'react-native-elements';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const hideKeyboard = () => {
    Keyboard.dismiss();
  };
  const navigation = useNavigation();

  return (
    <SafeAreaView onTouchStart={hideKeyboard} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Layanne Estetica</Text>
      </View>

      <BannerCarousel />

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
        style={styles.button}
        onPress={()=>{navigation.navigate('Schedule')}}
        >

          <Icon
            style={styles.icon}
            name='schedule'
            size={60}
          />
          <Text style={styles.buttonText}>Agenda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
        <Icon
            style={styles.icon}
            name='person'
            size={60}
          />
          <Text style={styles.buttonText}>Clientes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
        <Icon
            style={styles.icon}
            name='payment'
            size={60}
          />
          <Text style={styles.buttonText}>Receber</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
        <Icon
            style={styles.icon}
            name='work'
            size={60}
          />
          <Text style={styles.buttonText}>Serviços</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
        <Icon
            style={styles.icon}
            name='people'
            size={60}
          />
          <Text style={styles.buttonText}>Colaboradores</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instagramFooter}>
        <Text>@layanneestetica</Text>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;