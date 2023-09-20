import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

export const CalendarEvent = (event) => {
    const {
        startTime,
        endTime
    } = event?.events

    const diferencaEmMinutos = (dataInicio, dataFim) => {
        const diffEmMilissegundos = dataFim - dataInicio;
        let diffEmMinutos = diffEmMilissegundos / (1000 * 60);
        if (diffEmMinutos < 0)
            diffEmMinutos = diffEmMinutos * -1
        let aux = diffEmMinutos / 1.5;
        return aux
    }
    
    const diferencaMarginTop = (startTime) => {
        return initalMargin = 39 * startTime.getMinutes() / 100
    }


    const heightTotal = diferencaEmMinutos(startTime,endTime)-1;
    const marginTopAdjust = diferencaMarginTop(startTime)

    return (
        <View style={styles.eventsContainer}>
            {
                <View
                    key={event?.events.id}
                    style={[
                        styles.eventRow,
                        {
                            display: 'flex',
                            height: heightTotal,
                            width: '80%',
                            marginTop: marginTopAdjust
                        },
                    ]}
                >
                    <View style={styles.eventDetails}>
                        <View style={styles.eventDescription}>
                            <Text>{event?.events.description}</Text>
                        </View>
                        <View style={styles.eventSubdescription}>
                            <Text>{event?.events.subdescription}</Text>
                        </View>
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
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F6D4C7',
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
    eventSubdescription: {},
});
