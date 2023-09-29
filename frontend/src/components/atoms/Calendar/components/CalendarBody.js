import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { CalendarEvent } from './CalendarEvent';

export const CalendarBody = ({ events }) => {
    const hours = Array.from({ length: 25 }, (_, index) => index);
    const [currentTimePosition, setCurrentTimePosition] = useState(0);

    useEffect(() => {
        const updateCurrentTimePosition = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const currentMinutes = hours * 60 + minutes;
            const position = ((currentMinutes * 0.1) / 1.500);
            setCurrentTimePosition(position);
        };
        const intervalId = setInterval(updateCurrentTimePosition, 60000);
        updateCurrentTimePosition();
        return () => clearInterval(intervalId);
    }, []);

    return (
        <ScrollView style={styles.container} vertical={true}>
            <View
                style={[
                    styles.currentTimeIndicator,
                    {
                        top: `${currentTimePosition}%`, // Posição vertical com base na porcentagem do dia
                    },
                ]}
            ></View>
            <View>
                {hours.map((hour) => (
                    <View key={hour} style={[styles.hourRow, {
                        borderBottomWidth: 1,
                        borderBottomColor: 'black',
                    }]}>
                        {
                            events.find((event) => event.startTime.getHours() === hour) ?
                                <View>
                                    <Text style={styles.hourText}>
                                        {hour.toString().padStart(2, '0')+'h'}
                                    </Text>
                                    <View style={styles.eventsColumn}>
                                        <CalendarEvent events={events.find((event) => event.startTime.getHours() === hour)} />
                                    </View>
                                </View> :
                                <View>
                                    <Text style={styles.hourText}>
                                        {hour.toString().padStart(2, '0')+'h'}
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
        display: 'none',
    },
    eventsColumn: {
        position: 'absolute',
        width: '90%',
        display: 'flex',
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
    },
    hourText: {
        width: 30,
        marginTop: 10,
        color: 'black',
        justifyContent: 'flex-start'
    },
    currentTimeIndicator: {
        position: 'absolute',
        width: '100%',
        height: 2, // Altura máxima de 2 pixels
        backgroundColor: 'red',
    },
});
