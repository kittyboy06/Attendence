import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import LoadingBar from './LoadingBar';

const StudentDashboard = () => {
    const [regNo, setRegNo] = useState('');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        if (!regNo.trim()) return;
        setLoading(true);
        setError('');
        setStats(null);

        try {
            // 1. Find Student
            const { data: student, error: sError } = await supabase
                .from('students')
                .select('*')
                .ilike('register_no', regNo.trim())
                .single();

            if (sError || !student) {
                setError('Student not found with this Register Number.');
                setLoading(false);
                return;
            }

            // 2. Fetch Dependencies
            const { data: settingsData } = await supabase.from('settings').select('*').eq('key', 'academic_start_date').maybeSingle();
            const { data: logs } = await supabase.from('attendance_logs').select('*');
            const { data: holidays } = await supabase.from('holidays').select('date');
            const { data: overrides } = await supabase.from('special_schedules').select('date');

            if (!logs) throw new Error("Data fetch error");

            // holidays Set
            const holidaysSet = new Set(holidays ? holidays.map(h => h.date) : []);
            // overrides Set
            const overridesSet = new Set(overrides ? overrides.map(o => o.date) : []);

            // 3. Prepare Dates (Local Time handling)
            const startDateStr = settingsData?.value || '2000-01-01';

            const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
            const startDate = new Date(sYear, sMonth - 1, sDay); // Local Midnight

            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of Today

            const joinDateStr = new Date(student.created_at || '2000-01-01').toISOString().split('T')[0];

            // Index Logs (With Robust Normalization)
            const logsMap = {};
            logs.forEach(l => {
                if (!l.date) return;
                // Normalize Date to YYYY-MM-DD (Safe for ISO strings or Date strings)
                const dKey = l.date.substring(0, 10);
                // Normalize Period to String
                const pKey = String(l.period_number);

                if (!logsMap[dKey]) logsMap[dKey] = {};
                logsMap[dKey][pKey] = l;
            });

            // 4. STRICT 8-PERIOD CALCULATION LOOP
            let totalClasses = 0;
            let present = 0;
            let absent = 0;
            let od = 0;

            let current = new Date(startDate);
            // Safety Check
            if (current > today) {
                // Future start date
            } else {
                while (current <= today) {
                    const dayIndex = current.getDay();

                    // Skip Sunday (0) UNLESS Overridden
                    if (dayIndex !== 0 || overridesSet.has(current.toISOString().split('T')[0])) {
                        // Manually construct YYYY-MM-DD local string
                        // Manually construct YYYY-MM-DD local string
                        const dateStr = current.getFullYear() + '-' +
                            String(current.getMonth() + 1).padStart(2, '0') + '-' +
                            String(current.getDate()).padStart(2, '0');

                        // Check Holiday
                        if (holidaysSet.has(dateStr)) {
                            current.setDate(current.getDate() + 1);
                            continue;
                        }

                        // Assume 8 periods per day
                        for (let p = 1; p <= 8; p++) {
                            totalClasses++;

                            // Case A: Pre-Join?
                            if (dateStr < joinDateStr) {
                                absent++;
                                continue;
                            }

                            // Case B: Check Log Existence (Using String keys)
                            const log = logsMap[dateStr]?.[String(p)];

                            if (log) {
                                // Log Exists -> Use the data
                                if (log.absentees_json?.includes(student.id)) {
                                    absent++;
                                } else if (log.od_students_json?.includes(student.id)) {
                                    od++;
                                } else {
                                    // Log exists + Not Absent/OD => PRESENT
                                    present++;
                                }
                            } else {
                                // Case C: NO Log -> STRICT MODE implies ABSENT
                                absent++;
                            }
                        }
                    }
                    // Next Day
                    current.setDate(current.getDate() + 1);
                }
            }

            // 5. Finalize
            const percentage = totalClasses > 0 ? (((present + od) / totalClasses) * 100).toFixed(1) : 0;

            setStats({
                name: student.name,
                register_no: student.register_no,
                totalClasses,
                present: present + od,
                absent,
                od,
                percentage
            });

        } catch (err) {
            console.error(err);
            setError('Error fetching data.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 p-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 mt-2">Student Portal</h1>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Check Attendance</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Enter Register Number"
                        className="flex-1 border p-3 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchStats()}
                    />
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                    >
                        {loading ? '...' : 'Go'}
                    </button>
                </div>
                {error && <p className="text-red-500 text-sm mt-3 animate-pulse">{error}</p>}
            </div>

            {stats && (
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-slide-up relative">
                    <div className="bg-blue-600 p-6 text-white text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-white/10 blur-3xl transform -translate-y-1/2"></div>
                        <h2 className="text-2xl font-bold relative z-10">{stats.percentage}%</h2>
                        <p className="text-blue-100 text-sm relative z-10">Overall Attendance</p>
                    </div>

                    <div className="p-6">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">{stats.name}</h3>
                            <p className="text-gray-400 text-sm">{stats.register_no}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                                <span className="block text-2xl font-bold text-green-600">{stats.present}</span>
                                <span className="text-xs text-green-700 font-medium">Present (inc. OD)</span>
                            </div>
                            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                                <span className="block text-2xl font-bold text-red-600">{stats.absent}</span>
                                <span className="text-xs text-red-700 font-medium">Absent</span>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-center">
                                <span className="block text-2xl font-bold text-yellow-600">{stats.od}</span>
                                <span className="text-xs text-yellow-700 font-medium">On Duty</span>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                                <span className="block text-2xl font-bold text-gray-600">{stats.totalClasses}</span>
                                <span className="text-xs text-gray-500 font-medium">Total Classes</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-auto text-center text-xs text-gray-300 pb-2">
                Student Attendance System
            </div>
        </div>
    );
};

export default StudentDashboard;
