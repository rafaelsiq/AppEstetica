// components/molecules/Header.js

import React from 'react';
import { View } from '../../atoms/View/View';
import { Text } from 'react-native';
import { style } from './styles';

const Header = () => {
    return (
        <View>
            <Text style={style.logoText}>Layanne Estetica</Text>
        </View>
    );
};
export default Header;
