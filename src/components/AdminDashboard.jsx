import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AdminDashboard = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('teachers'); // teachers, subjects, schedule
    const [loading, setLoading] = useState(false);

    // Data handling
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [schedule, setSchedule] = useState([]);

    // Forms
    const [newTeacherName, setNewTeacherName] = useState('');
    const [newSubject, setNewSubject] = useState({ name: '', code: '' });
    const [newClass, setNewClass] = useState({ day: 'Monday', start: '', end: '', subject: '', teacher: '' });

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated, activeTab]);

    const handleLogin = () => {
        if (password === 'admin123') { // Simple hardcoded password
            setIsAuthenticated(true);
        } else {
            alert('Invalid Password');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        if (activeTab === 'teachers') {
            const { data } = await supabase.from('teachers').select('*').order('created_at');
            setTeachers(data || []);
        } else if (activeTab === 'subjects') {
            const { data } = await supabase.from('subjects').select('*').order('created_at');
            setSubjects(data || []);
        } else if (activeTab === 'schedule') {
            const { data } = await supabase.from('time_table').select('*, subjects(name, code), teachers(name)').order('day_of_week');
            setSchedule(data || []);
            // Also need list for dropdowns
            const { data: t } = await supabase.from('teachers').select('*');
            const { data: s } = await supabase.from('subjects').select('*');
            setTeachers(t || []);
            setSubjects(s || []);
        }
        setLoading(false);
    };

    // --- Handlers ---

    const addTeacher = async () => {
        if (!newTeacherName.trim()) return;
        const { error } = await supabase.from('teachers').insert({ name: newTeacherName });
        if (error) alert(error.message);
        else {
            setNewTeacherName('');
            fetchData();
        }
    };

    const deleteTeacher = async (id) => {
        if (!confirm('Delete this teacher?')) return;
        const { error } = await supabase.from('teachers').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const addSubject = async () => {
        if (!newSubject.name || !newSubject.code) return;
        const { error } = await supabase.from('subjects').insert(newSubject);
        if (error) alert(error.message);
        else {
            setNewSubject({ name: '', code: '' });
            fetchData();
        }
    };

    const deleteSubject = async (id) => {
        if (!confirm('Delete this subject?')) return;
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const addClass = async () => {
        const { day, start, end, subject, teacher } = newClass;
        if (!start || !end || !subject || !teacher) {
            alert('Please fill all fields');
            return;
        }
        const { error } = await supabase.from('time_table').insert({
            day_of_week: day,
            start_time: start,
            end_time: end,
            subject_id: subject,
            teacher_id: teacher
        });
        if (error) alert(error.message);
        else {
            fetchData();
            // Reset some fields
            setNewClass(prev => ({ ...prev, start: '', end: '' }));
        }
    };

    const deleteClass = async (id) => {
        if (!confirm('Delete this class?')) return;
        const { error } = await supabase.from('time_table').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
                <h2 className="text-2xl font-bold mb-4">Admin Login</h2>
                <input
                    type="password"
                    placeholder="Enter Password"
                    className="border p-2 rounded mb-4 w-full max-w-xs"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <button onClick={handleLogin} className="bg-blue-600 text-white px-6 py-2 rounded">Login</button>
            </div>
        );
    }

    return (
        <div className="p-4 pb-20 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Dashboard</h1>

            {/* Tabs */}
            <div className="flex space-x-2 mb-6 overflow-x-auto">
                {['teachers', 'subjects', 'schedule'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {loading && <p>Loading...</p>}

            {/* TEACHERS TAB */}
            {activeTab === 'teachers' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">Add Teacher</h3>
                        <div className="flex gap-2">
                            <input
                                className="border p-2 rounded flex-1"
                                placeholder="Prof. Name"
                                value={newTeacherName}
                                onChange={e => setNewTeacherName(e.target.value)}
                            />
                            <button onClick={addTeacher} className="bg-green-600 text-white px-4 rounded">Add</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {teachers.map(t => (
                            <div key={t.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <span>{t.name}</span>
                                <button onClick={() => deleteTeacher(t.id)} className="text-red-500 text-sm">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SUBJECTS TAB */}
            {activeTab === 'subjects' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">Add Subject</h3>
                        <div className="flex gap-2">
                            <input
                                className="border p-2 rounded flex-1"
                                placeholder="Subject Name"
                                value={newSubject.name}
                                onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                            />
                            <input
                                className="border p-2 rounded w-24"
                                placeholder="Code"
                                value={newSubject.code}
                                onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                            />
                            <button onClick={addSubject} className="bg-green-600 text-white px-4 rounded">Add</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {subjects.map(s => (
                            <div key={s.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <span className="font-bold block">{s.name}</span>
                                    <span className="text-sm text-gray-500">{s.code}</span>
                                </div>
                                <button onClick={() => deleteSubject(s.id)} className="text-red-500 text-sm">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SCHEDULE TAB */}
            {activeTab === 'schedule' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">Add Class</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                className="border p-2 rounded"
                                value={newClass.day}
                                onChange={e => setNewClass({ ...newClass, day: e.target.value })}
                            >
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <div className="flex gap-1">
                                <input type="time" className="border p-2 rounded flex-1" value={newClass.start} onChange={e => setNewClass({ ...newClass, start: e.target.value })} />
                                <input type="time" className="border p-2 rounded flex-1" value={newClass.end} onChange={e => setNewClass({ ...newClass, end: e.target.value })} />
                            </div>
                            <select
                                className="border p-2 rounded"
                                value={newClass.subject}
                                onChange={e => setNewClass({ ...newClass, subject: e.target.value })}
                            >
                                <option value="">Select Subject</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select
                                className="border p-2 rounded"
                                value={newClass.teacher}
                                onChange={e => setNewClass({ ...newClass, teacher: e.target.value })}
                            >
                                <option value="">Select Teacher</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <button onClick={addClass} className="w-full bg-green-600 text-white py-2 rounded font-bold">Add Class</button>
                    </div>

                    <div className="space-y-2">
                        {schedule.map(c => (
                            <div key={c.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <span className="font-bold text-blue-600 text-sm">{c.day_of_week}</span>
                                    <div className="font-bold">{c.subjects?.name} <span className="text-gray-400 text-xs">({c.subjects?.code})</span></div>
                                    <div className="text-sm text-gray-600">{c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)} • {c.teachers?.name}</div>
                                </div>
                                <button onClick={() => deleteClass(c.id)} className="text-red-500 text-sm">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
