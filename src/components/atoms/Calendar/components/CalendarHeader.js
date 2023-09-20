import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

export const CalendarHeader = () => {
    const data = new Date();
    const weekDay = { weekday: 'long', timeZone: 'UTC' };
    const month = { month: 'short', timeZone: 'UTC' }; 

    const weekDayPT = new Intl.DateTimeFormat('pt-BR', weekDay).format(data);
    const monthPT = new Intl.DateTimeFormat('pt-BR', month).format(data).replace('.', '');

    return (
        <View style={styles.container}>
            <View style={styles.monthContainer}>
                <Text style={styles.monthText}>{monthPT}</Text>
            </View>
            <View style={styles.centerContainer}>
                <Text style={styles.weekDayText}>{weekDayPT}</Text>
                <Text style={styles.yearText}>{data.getFullYear()}</Text>
            </View>
            <View style={styles.dayContainer}>
                <Text style={styles.dayText}>{data.getDate()}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#D9D9D9',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingVertical: 10,
        width: '100%',
        height: 100,
        borderBottomWidth: 1,
        borderBottomColor: 'black',
    },
    monthContainer: {
        backgroundColor: '#F6D4C7',
        height: '90%',
        width: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthText: {
        color: 'white',
        fontSize: 20,
    },
    centerContainer: {
        alignItems: 'center',
    },
    weekDayText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
    },
    yearText: {
        color: 'white',
        fontSize: 16,
        width: '70%',
        textAlign: 'center',
    },
    dayContainer: {
        backgroundColor: '#F6D4C7',
        height: '90%',
        width: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        color: 'white',
        fontSize: 20,
    },
});
