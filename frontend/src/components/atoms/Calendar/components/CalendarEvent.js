import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

export const CalendarEvent = ({ events }) => {
    const { startTime, endTime, description, subdescription, id } = events;

    const diferencaEmMinutos = (dataInicio, dataFim) => {
        const diffEmMilissegundos = dataFim - dataInicio;
        const diffEmMinutos = Math.abs(diffEmMilissegundos / (1000 * 60));
        return diffEmMinutos / 1.5;
    };

    const diferencaMarginTop = (start) => 39 * start.getMinutes() / 100;

    const heightTotal = diferencaEmMinutos(startTime, endTime) - 1;
    const marginTopAdjust = diferencaMarginTop(startTime);
    const onEventPress = () => { };

    const [passedEvent, setPassedEvent] = useState(false);

    useEffect(() => {
        const updatePassed = () => {
            const now = new Date();
            const eventTime = endTime.getHours() * 60 + endTime.getMinutes();
            const nowTime = now.getHours() * 60 + now.getMinutes();
            setPassedEvent(eventTime < nowTime);
        };
        const intervalId = setInterval(updatePassed, 60000);
        updatePassed();
        return () => clearInterval(intervalId);
    }, [endTime]);
    return (
        <View style={[styles.eventsContainer, { zIndex: startTime.getHours() }]}>
            {
                <View
                    key={id}
                    style={[
                        passedEvent ? styles.eventRowPasted : styles.eventRow,
                        {
                            display: 'flex',
                            height: heightTotal,
                            width: '80%',
                            marginTop: marginTopAdjust,
                            zIndex: startTime.getHours()
                        },
                    ]}
                >
                    <View style={[styles.eventDetails, { zIndex: startTime.getHours() }]} onTouchStart={onEventPress}>
                        <Text style={[styles.eventDescription, { zIndex: startTime.getHours() }]}>{description}</Text>
                        <Text style={[styles.eventSubdescription, { zIndex: startTime.getHours() }]}>{subdescription}</Text>
                    </View>
                </View>

            }
        </View>
    );
};

const styles = StyleSheet.create({
    eventsContainer: {
        flex: 1,
        width: '100%',
    },
    eventRowPasted: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0D0E1',
        borderRadius: 12,
        marginLeft: 10,
        width: '100%',
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4C7F6',
        borderRadius: 12,
        marginLeft: 10,
        width: '100%',
    },
    eventTime: {
        width: 80,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    eventTimeText: {
        color: 'white',
    },
    eventDetails: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: 'black'
    },
    eventDescription: {
        marginBottom: 5,
    },
    eventSubdescription: {
        color: 'grey',
        marginLeft: '50%'
    },
});
