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

    const downloadDailyReport = () => {
        if (logs.length === 0) {
            alert("No logs to download.");
            return;
        }

        let content = `Daily Attendance Report - ${date}\n`;
        content += `-------------------------------------------------------------------------------------------------------------------\n`;
        content += `| S.NO | SUBJECT               | TEACHER              | ABSENTEES (Reg No)           | OD (Reg No)                  | VERIFIED |\n`;
        content += `-------------------------------------------------------------------------------------------------------------------\n`;

        logs.forEach((log, index) => {
            const sno = (index + 1).toString().padEnd(4);
            const subject = (log.subjects.name.substring(0, 20)).padEnd(21);
            const teacher = (log.teachers.name.substring(0, 20)).padEnd(20);

            // Get Reg Nos for Absentees
            const absentRegs = log.absentees_json
                .map(id => students[id]?.register_no)
                .filter(Boolean)
                .join(', ');

            const odRegs = log.od_students_json
                .map(id => students[id]?.register_no)
                .filter(Boolean)
                .join(', ');

            // Verified Status
            // If signature exists -> Signed, else if generic -> Verified
            const isVerified = log.teacher_signature_url ? 'Signed' : 'Verified';

            // Allow wrapping for long lists of absentees? 
            // For simple text table, let's just truncate or let it run long? 
            // User asked for specific columns, let's try to fit in one line or handle it simply.
            // Let's just put the string.

            content += `| ${sno} | ${subject} | ${teacher} | ${absentRegs.padEnd(28)} | ${odRegs.padEnd(28)} | ${isVerified.padEnd(8)} |\n`;
        });

        content += `-------------------------------------------------------------------------------------------------------------------\n`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Daily_Report_${date}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-xl mx-auto p-4 pb-20">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Attendance History</h1>
                {logs.length > 0 && (
                    <button
                        onClick={downloadDailyReport}
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition font-bold"
                    >
                        Download Report
                    </button>
                )}
            </div>

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
                <p className="text-center py-4">Loading records...</p>
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
                            </div>

                            <div className="mt-4 flex gap-4 text-sm">
                                <div className="bg-red-50 text-red-700 px-2 py-1 rounded">
                                    Absent: <span className="font-bold">{log.absentees_json.length}</span>
                                </div>
                                <div className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                                    OD: <span className="font-bold">{log.od_students_json.length}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoryView;
