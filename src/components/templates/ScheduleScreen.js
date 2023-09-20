import React, { useState } from 'react';
import {
    Keyboard,
    SafeAreaView,
    View,
    Alert,
    StyleSheet
} from 'react-native';
import TimeTableView from 'react-native-timetable';
import { stylesBlue } from './styles';
import { Calendar } from '../atoms/Calendar/Calendar';


const styles = StyleSheet.create({
    headerStyle: {
        backgroundColor: '#81E1B8'
    },
    container: {
        flex: 1,
        backgroundColor: '#F8F8F8',
    },
});

const ScheduleScreen = () => {
    const events_data = [{
        id: 1,
        description: 'Event',
        startDate: new Date(2023, 9, 17, 12, 0),
        endDate: new Date(2023, 9, 17, 12, 30),
        color: 'blue',
        startTime: new Date(2023, 9, 17, 12, 0),
        endTime: new Date(2023, 9, 17, 18, 30),
        style: { borderColor: 'red' },
        eventKind: 'block',
    },
    {
        id: 1,
        startDate: new Date(2023, 1, 20, 9),
        endDate: new Date(2023, 1, 20, 11),
        startTime: new Date(2023, 9, 19, 11, 0),
        endTime: new Date(2023, 9, 19, 11, 30),
        color: 'blue',
        description: 'E1',
    },
    {
        id: 2,
        startDate: new Date(2023, 1, 22, 10),
        endDate: new Date(2023, 1, 22, 11, 30),
        startTime: new Date(2023, 9, 18, 12, 0),
        endTime: new Date(2023, 9, 18, 12, 30),
        color: 'red',
        description: 'E2',
    },]
    const hideKeyboard = () => {
        Keyboard.dismiss();
    };
    scrollViewRef = (ref) => {
        this.timetableRef = ref;
    };

    onEventPress = (evt) => {
        Alert.alert("onEventPress", JSON.stringify(evt));
    };

    return (
        <SafeAreaView onTouchStart={hideKeyboard} style={styles.container}>
           <Calendar/>
        </SafeAreaView>
    );
};

export default ScheduleScreen;
