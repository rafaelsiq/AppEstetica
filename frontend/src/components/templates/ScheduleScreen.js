import React from 'react';
import {
    Keyboard,
    SafeAreaView,
    StyleSheet
} from 'react-native';
import { Calendar } from '../atoms/Calendar/Calendar';
import { events_data } from '../../mock/calendarMock';


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

    const hideKeyboard = () => {
        Keyboard.dismiss();
    };
    
    scrollViewRef = (ref) => {
        this.timetableRef = ref;
    };

    return (
        <SafeAreaView onTouchStart={hideKeyboard} style={styles.container}>
            <Calendar events={events_data} />
        </SafeAreaView>
    );
};

export default ScheduleScreen;
