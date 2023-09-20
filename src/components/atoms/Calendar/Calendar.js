import React, { useState, useEffect } from 'react';
import { View } from '../View/View';
import { CalendarHeader } from './components/CalendarHeader';
import { CalendarBody } from './components/CalendarBody';
import CalendarPicker from 'react-native-calendar-picker';
import { Modal, SafeAreaView } from 'react-native';

export const Calendar = ({ events }) => {
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [visible, setVisible] = useState(false)
    const [dayEvent, setDayEvent] = useState([])

    useEffect(() => {
        setDayEvent(events.filter(event => {
            const eventDate = event.startTime;
            return (
                eventDate.toDateString() === selectedDate.toDateString());
        }));
    }, [selectedDate])

    const changeSelectedDate = (date) => {
        setVisible(false)
        setSelectedDate(new Date(date))
    }

    return <View>
        <CalendarHeader selectedDate={selectedDate} setModalVisibility={setVisible} />
        <>
            <Modal
                animationType="slide"
                visible={visible}
                style={{
                    marginTop: 50
                }}
            >
                <SafeAreaView>
                    <CalendarPicker
                        previousTitle='Anterior'
                        nextTitle='Proximo'
                        onDateChange={changeSelectedDate}
                    />
                </SafeAreaView>

            </Modal>
        </>
        <CalendarBody selectedDate={selectedDate} events={dayEvent} />
    </View>
}