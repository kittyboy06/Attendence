
import { format, parse, isWithinInterval } from 'date-fns';

export const PERIODS = [
    { id: 1, label: 'Period 1', start: '08:30', end: '09:15' },
    { id: 2, label: 'Period 2', start: '09:15', end: '10:00' },
    { id: 'Short Break', label: 'Break', start: '10:00', end: '10:10', type: 'break' },
    { id: 3, label: 'Period 3', start: '10:10', end: '10:55' },
    { id: 4, label: 'Period 4', start: '10:55', end: '11:40' },
    { id: 'Lunch', label: 'Lunch', start: '11:40', end: '12:20', type: 'break' },
    { id: 5, label: 'Period 5', start: '12:20', end: '13:05' },
    { id: 6, label: 'Period 6', start: '13:05', end: '13:50' },
    { id: 'Long Break', label: 'Break', start: '13:50', end: '14:00', type: 'break' },
    { id: 7, label: 'Period 7', start: '14:00', end: '14:45' },
    { id: 8, label: 'Period 8', start: '14:45', end: '15:30' },
    { id: 0, label: 'Extra Class', start: 'Custom', end: 'Time', type: 'extra' }, // Custom handling
];

export const getCurrentPeriod = () => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');

    // Simple string comparison works for 24h format "HH:mm"
    // e.g. "08:30" <= "09:00" <= "09:15"

    for (const p of PERIODS) {
        if (currentTime >= p.start && currentTime < p.end) {
            return p;
        }
    }
    return null;
};

export const getPeriodById = (id) => PERIODS.find(p => p.id === id);
