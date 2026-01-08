import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';

const HistoryView = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState({}); // Map id -> name

    useEffect(() => {
        fetchStudents();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [date]);

    const fetchStudents = async () => {
        const { data } = await supabase.from('students').select('id, name, register_no');
        if (data) {
            const temp = {};
            data.forEach(s => temp[s.id] = s);
            setStudents(temp);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('attendance_logs')
            .select(`
        *,
        subjects (name, code),
        teachers (name)
      `)
            .eq('date', date);

        if (error) console.error('Error fetching logs:', error);
        setLogs(data || []);
        setLoading(false);
    };

    const downloadReport = (log) => {
        // Generate text/csv content
        const subject = log.subjects.name;
        const teacher = log.teachers.name;
        const dateStr = log.date;

        let content = `Attendance Report\nDate: ${dateStr}\nSubject: ${subject} (${log.subjects.code})\nTeacher: ${teacher}\n\n`;

        content += `Status Summary:\n`;
        // We don't have total 'Present' count easily without full student list size, but we listed Absentees.
        content += `Absentees: ${log.absentees_json.length}\n`;
        content += `On-Duty: ${log.od_students_json.length}\n\n`;

        content += `--- Absentees ---\n`;
        log.absentees_json.forEach(id => {
            const s = students[id];
            if (s) content += `${s.name} (${s.register_no})\n`;
        });

        content += `\n--- On-Duty ---\n`;
        log.od_students_json.forEach(id => {
            const s = students[id];
            if (s) content += `${s.name} (${s.register_no})\n`;
        });

        content += `\nTeacher Signature: ${log.teacher_signature_url}\n`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attendance_${subject}_${dateStr}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-20">
            <h1 className="text-2xl font-bold mb-4 text-gray-800">Attendance History</h1>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {loading ? (
                <p>Loading records...</p>
            ) : logs.length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-lg">
                    No records found for this date.
                </div>
            ) : (
                <div className="space-y-4">
                    {logs.map(log => (
                        <div key={log.id} className="bg-white p-4 rounded-lg shadow border border-gray-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{log.subjects.name}</h3>
                                    <p className="text-sm text-gray-500">{log.subjects.code} • {log.teachers.name}</p>
                                </div>
                                <button
                                    onClick={() => downloadReport(log)}
                                    className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
                                >
                                    Download
                                </button>
                            </div>

                            <div className="mt-4 flex gap-4 text-sm">
                                <div className="bg-red-50 text-red-700 px-2 py-1 rounded">
                                    Absent: <span className="font-bold">{log.absentees_json.length}</span>
                                </div>
                                <div className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                                    OD: <span className="font-bold">{log.od_students_json.length}</span>
                                </div>
                            </div>

                            {/* Expandable details could go here, for now keeping it simple summary */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoryView;
