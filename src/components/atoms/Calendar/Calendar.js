import React from 'react'
import { View } from '../View/View'
import { CalendarHeader } from './components/CalendarHeader'
import { CalendarBody } from './components/CalendarBody'


export const Calendar = () => {
    return <View>
        <CalendarHeader />
        <CalendarBody />
    </View>
}