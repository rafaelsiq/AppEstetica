import React from 'react';
import {
    Keyboard,
    SafeAreaView,
    Alert,
    StyleSheet
} from 'react-native';
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
        id: '1',
        startTime: new Date('2023-09-19T13:00:00.000Z'),
        endTime: new Date('2023-09-19T14:00:00.000Z'),
        description: 'lavagem de orelha',
        subdescription: 'maria antonieta'
    },
    {
        id: '2',
        startTime: new Date('2023-09-18T13:00:00.000Z'),
        endTime: new Date('2023-09-18T15:00:00.000Z'),
        description: 'lavagem de orelha lavagem de orelha lavagem de orelha lavagem de orelha lavagem de',
        subdescription: 'maria antonieta'
    },
    {
        id: '2',
        startTime: new Date('2023-09-21T18:40:00.000Z'),
        endTime: new Date('2023-09-21T19:40:00.000Z'),
        description: 'lavagem de orelha lavagem de orelha lavagem de orelha lavagem de orelha lavagem de',
        subdescription: 'maria antonieta'
    }]

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
            <Calendar events={events_data} />
        </SafeAreaView>
    );
};

export default ScheduleScreen;
