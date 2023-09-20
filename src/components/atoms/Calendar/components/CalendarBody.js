import React from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { CalendarEvent } from './CalendarEvent';

export const CalendarBody = ({ events = [{
    id: '1',
    endTime: new Date(2023, 9, 19, 3, 20),
    startTime: new Date(2023, 9, 19, 2, 20),
    description: 'lavagem de orelha',
    subdescription: 'maria antonieta'
},
{
    id: '1',
    endTime: new Date(2023, 9, 19, 8, 0),
    startTime: new Date(2023, 9, 19, 7, 0),
    description: 'lavagem de orelha lavagem de orelha',
    subdescription: 'maria antonieta'
}]
}) => {
    const hours = Array.from({ length: 25 }, (_, index) => index);
    return (
        <ScrollView style={styles.container} vertical={true}>
            <View>
                {hours.map((hour) => (
                    <View key={hour} style={styles.hourRow}>
                        {
                            events.find((event) => event.startTime.getHours() === hour) ?
                                <View  >
                                    <Text style={styles.hourText}>
                                        {hour.toString().padStart(2, '0')}
                                    </Text>
                                    <View style={styles.eventsColumn}>
                                        <CalendarEvent events={events.find((event) => event.startTime.getHours() === hour)} />
                                    </View>
                                </View> :
                                <View>
                                    <Text style={styles.hourText}>
                                        {hour.toString().padStart(2, '0')}
                                    </Text>
                                    <View style={styles.emptyEventsColumn}>
                                        <Text style={styles.emptyEventsColumn}>
                                            {'-'}
                                        </Text>
                                    </View>
                                </View>
                        }
                    </View>
                ))}
            </View>
        </ScrollView>

    );
};

const styles = StyleSheet.create({
    emptyEventsColumn: {
        width: '100%',
        display:'none',
    },
    eventsColumn: {
        position:'absolute',
        width:'90%',
        display:'flex',
        marginLeft: 30
    },
    container: {
        backgroundColor: '#D9D9D9',
        width: '100%'
    },
    verticalLine: {
        width: '100%',
        backgroundColor: 'black',
    },
    hourRow: {
        height: 40,
        paddingLeft: 10,
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: 'black',
    },
    hourText: {
        width:20,
        marginTop:10,
        color: 'white',
        justifyContent: 'flex-start'
    },
});
