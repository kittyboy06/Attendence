import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
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
    const [students, setStudents] = useState([]);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);

    // Forms
    const [editingId, setEditingId] = useState(null); // Track which item is being edited
    const [newTeacherName, setNewTeacherName] = useState('');
    const [newTeacherTitle, setNewTeacherTitle] = useState('Dr.');
    const [newTeacherPin, setNewTeacherPin] = useState('0000'); // New PIN state
    // Teacher Signature Ref
    const sigCanvasRef = useRef({});
    const [newSubject, setNewSubject] = useState({ name: '', code: '' });
    const [newClass, setNewClass] = useState({ day: 'Monday', start: '', end: '', subject: '', teacher: '' });
    const [newStudent, setNewStudent] = useState({ name: '', register_no: '' });

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated, activeTab, historyDate]);

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
        } else if (activeTab === 'students') {
            const { data } = await supabase.from('students').select('*').order('register_no');
            setStudents(data || []);
        } else if (activeTab === 'schedule') {
            const { data } = await supabase.from('time_table').select('*, subjects(name, code), teachers(name)').order('day_of_week');
            setSchedule(data || []);
            // Also need list for dropdowns
            const { data: t } = await supabase.from('teachers').select('*');
            const { data: s } = await supabase.from('subjects').select('*');
            setTeachers(t || []);
            setSubjects(s || []);
        } else if (activeTab === 'history') {
            const { data } = await supabase
                .from('attendance_logs')
                .select('*, subjects(name, code), teachers(name)')
                .eq('date', historyDate);
            setHistoryLogs(data || []);
        }
        setLoading(false);
    };

    const resetForms = () => {
        setEditingId(null);
        setNewTeacherName('');
        setNewTeacherTitle('Dr.');
        setNewTeacherPin('0000');
        if (sigCanvasRef.current && sigCanvasRef.current.clear) sigCanvasRef.current.clear(); // Clear canvas
        setNewSubject({ name: '', code: '' });
        setNewClass({ day: 'Monday', start: '', end: '', subject: '', teacher: '' });
        setNewStudent({ name: '', register_no: '' });
    };

    // --- Handlers ---

    const deleteLog = async (id) => {
        if (!confirm('Delete this attendance record? This cannot be undone.')) return;
        const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    // --- TEACHERS ---
    const addOrUpdateTeacher = async () => {
        if (!newTeacherName.trim()) return;
        const fullName = newTeacherTitle + ' ' + newTeacherName;

        let signatureUrl = null;

        // Upload Signature if drawn
        if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
            const signatureData = sigCanvasRef.current.toDataURL('image/png');
            const signatureBlob = await (await fetch(signatureData)).blob();
            const fileName = 'ref_sig_' + Date.now() + '.png';
            const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, signatureBlob);
            if (!uploadError) {
                signatureUrl = supabase.storage.from('signatures').getPublicUrl(fileName).data.publicUrl;
            }
        }

        if (editingId) {
            const updateData = { name: fullName, pin: newTeacherPin };
            if (signatureUrl) updateData.signature_url = signatureUrl; // Only update if new one drawn

            const { error } = await supabase
                .from('teachers')
                .update(updateData)
                .eq('id', editingId);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase
                .from('teachers')
                .insert({ name: fullName, pin: newTeacherPin, signature_url: signatureUrl });
            if (error) alert(error.message);
        }
        resetForms();
        fetchData();
    };

    const startEditTeacher = (t) => {
        setEditingId(t.id);
        const parts = t.name.split(' ');
        setNewTeacherTitle(parts[0]);
        setNewTeacherName(parts.slice(1).join(' '));
        setNewTeacherPin(t.pin || '0000');
        // Note: Can't easily "load" the existing signature into canvas, so we leave it empty.
        // If they draw new, it updates. If empty, it keeps old.
        if (sigCanvasRef.current && sigCanvasRef.current.clear) sigCanvasRef.current.clear();
    };

    const deleteTeacher = async (id) => {
        if (!confirm('Delete this teacher?')) return;
        const { error } = await supabase.from('teachers').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    // --- SUBJECTS ---
    const addOrUpdateSubject = async () => {
        if (!newSubject.name) return;
        const payload = {
            name: newSubject.name,
            code: newSubject.code.trim() || null
        };

        if (editingId) {
            const { error } = await supabase.from('subjects').update(payload).eq('id', editingId);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('subjects').insert(payload);
            if (error) alert(error.message);
        }
        resetForms();
        fetchData();
    };

    const startEditSubject = (s) => {
        setEditingId(s.id);
        setNewSubject({ name: s.name, code: s.code || '' });
    };

    const deleteSubject = async (id) => {
        if (!confirm('Delete this subject?')) return;
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    // --- SCHEDULE ---
    const addOrUpdateClass = async () => {
        const { day, start, end, subject, teacher } = newClass;
        if (!start || !end || !subject || !teacher) {
            alert('Please fill all fields');
            return;
        }

        const payload = {
            day_of_week: day,
            start_time: start,
            end_time: end,
            subject_id: subject,
            teacher_id: teacher
        };

        if (editingId) {
            const { error } = await supabase.from('time_table').update(payload).eq('id', editingId);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('time_table').insert(payload);
            if (error) alert(error.message);
        }
        resetForms();
        fetchData();
    };

    const startEditClass = (c) => {
        setEditingId(c.id);
        setNewClass({
            day: c.day_of_week,
            start: c.start_time,
            end: c.end_time,
            subject: c.subject_id,
            teacher: c.teacher_id
        });
    };

    const deleteClass = async (id) => {
        if (!confirm('Delete this class?')) return;
        const { error } = await supabase.from('time_table').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    // --- STUDENTS ---
    const addOrUpdateStudent = async () => {
        if (!newStudent.name || !newStudent.register_no) return;

        if (editingId) {
            const { error } = await supabase.from('students').update(newStudent).eq('id', editingId);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('students').insert(newStudent);
            if (error) alert(error.message);
        }
        resetForms();
        fetchData();
    };

    const startEditStudent = (s) => {
        setEditingId(s.id);
        setNewStudent({ name: s.name, register_no: s.register_no });
    };

    const deleteStudent = async (id) => {
        if (!confirm('Delete this student?')) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
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
                {['teachers', 'subjects', 'students', 'schedule', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
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
                        <h3 className="font-bold text-lg">{editingId ? 'Edit Teacher' : 'Add Teacher'}</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                className="border p-2 rounded bg-white"
                                value={newTeacherTitle}
                                onChange={e => setNewTeacherTitle(e.target.value)}
                            >
                                <option>Dr.</option>
                                <option>Prof.</option>
                                <option>Mr.</option>
                                <option>Ms.</option>
                                <option>Mrs.</option>
                            </select>
                            <input
                                className="border p-2 rounded flex-1"
                                placeholder="Prof. Name"
                                value={newTeacherName}
                                onChange={e => setNewTeacherName(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <input
                                    className="border p-2 rounded w-full sm:w-24"
                                    placeholder="PIN"
                                    type="tel"
                                    maxLength={4}
                                    value={newTeacherPin}
                                    onChange={e => setNewTeacherPin(e.target.value)}
                                />
                                <button onClick={addOrUpdateTeacher} className={`${editingId ? 'bg-orange-500' : 'bg-green-600'} text-white px-4 py-2 rounded flex-1 sm:flex-none`}>
                                    {editingId ? 'Update' : 'Add'}
                                </button>
                            </div>
                            {editingId && <button onClick={resetForms} className="text-gray-500 underline text-sm mt-1 sm:mt-0">Cancel</button>}
                        </div>
                        {/* Signature Canvas for Reference Signature */}
                        <div className="border border-gray-300 rounded p-2">
                            <p className="text-sm text-gray-600 mb-1">Teacher Signature (Reference):</p>
                            <SignatureCanvas
                                ref={sigCanvasRef}
                                canvasProps={{ width: 300, height: 150, className: 'sigCanvas border bg-gray-50' }}
                            />
                            <button onClick={() => sigCanvasRef.current.clear()} className="text-xs text-red-500 mt-1">Clear Signature</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {teachers.map(t => (
                            <div key={t.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <span>{t.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">PIN: {t.pin}</span>
                                    {t.signature_url && <span className="text-xs text-green-600 ml-2">(Sig ✓)</span>}
                                </div>
                                <div className="flex gap-2 text-sm">
                                    <button onClick={() => startEditTeacher(t)} className="text-blue-500">Edit</button>
                                    <button onClick={() => deleteTeacher(t.id)} className="text-red-500">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SUBJECTS TAB */}
            {activeTab === 'subjects' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">{editingId ? 'Edit Subject' : 'Add Subject'}</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                className="border p-2 rounded flex-1"
                                placeholder="Subject Name"
                                value={newSubject.name}
                                onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <input
                                    className="border p-2 rounded flex-1 sm:w-24"
                                    placeholder="Code"
                                    value={newSubject.code}
                                    onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                                />
                                <button onClick={addOrUpdateSubject} className={`${editingId ? 'bg-orange-500' : 'bg-green-600'} text-white px-4 py-2 rounded`}>
                                    {editingId ? 'Update' : 'Add'}
                                </button>
                            </div>
                            {editingId && <button onClick={resetForms} className="text-gray-500 underline text-center">Cancel</button>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {subjects.map(s => (
                            <div key={s.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <span className="font-bold block">{s.name}</span>
                                    <span className="text-sm text-gray-500">{s.code}</span>
                                </div>
                                <div className="flex gap-2 text-sm">
                                    <button onClick={() => startEditSubject(s)} className="text-blue-500">Edit</button>
                                    <button onClick={() => deleteSubject(s.id)} className="text-red-500">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* STUDENTS TAB */}
            {activeTab === 'students' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">{editingId ? 'Edit Student' : 'Add Student'}</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                className="border p-2 rounded flex-1"
                                placeholder="Student Name"
                                value={newStudent.name}
                                onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <input
                                    className="border p-2 rounded flex-1 sm:w-32"
                                    placeholder="Reg No."
                                    value={newStudent.register_no}
                                    onChange={e => setNewStudent({ ...newStudent, register_no: e.target.value })}
                                />
                                <button onClick={addOrUpdateStudent} className={`${editingId ? 'bg-orange-500' : 'bg-green-600'} text-white px-4 py-2 rounded`}>
                                    {editingId ? 'Update' : 'Add'}
                                </button>
                            </div>
                            {editingId && <button onClick={resetForms} className="text-gray-500 underline text-center">Cancel</button>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {students.map(s => (
                            <div key={s.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <span className="font-bold block">{s.name}</span>
                                    <span className="text-sm text-gray-500">{s.register_no}</span>
                                </div>
                                <div className="flex gap-2 text-sm">
                                    <button onClick={() => startEditStudent(s)} className="text-blue-500">Edit</button>
                                    <button onClick={() => deleteStudent(s.id)} className="text-red-500">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SCHEDULE TAB */}
            {activeTab === 'schedule' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">{editingId ? 'Edit Class' : 'Add Class'}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="flex gap-2">
                            <button onClick={addOrUpdateClass} className={`flex-1 ${editingId ? 'bg-orange-500' : 'bg-green-600'} text-white py-2 rounded font-bold`}>
                                {editingId ? 'Update Class' : 'Add Class'}
                            </button>
                            {editingId && <button onClick={resetForms} className="text-gray-500 underline px-4">Cancel</button>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {schedule.map(c => (
                            <div key={c.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <span className="font-bold text-blue-600 text-sm">{c.day_of_week}</span>
                                    <div className="font-bold">{c.subjects?.name} <span className="text-gray-400 text-xs">({c.subjects?.code})</span></div>
                                    <div className="text-sm text-gray-600">{c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)} • {c.teachers?.name}</div>
                                </div>
                                <div className="flex gap-2 text-sm">
                                    <button onClick={() => startEditClass(c)} className="text-blue-500">Edit</button>
                                    <button onClick={() => deleteClass(c.id)} className="text-red-500">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow space-y-3">
                        <h3 className="font-bold text-lg">Select Date</h3>
                        <input
                            type="date"
                            className="border p-2 rounded w-full"
                            value={historyDate}
                            onChange={e => setHistoryDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        {historyLogs.length === 0 ? <p className="text-center text-gray-500">No records found.</p> : null}
                        {historyLogs.map(log => (
                            <div key={log.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{log.subjects?.name}</div>
                                    <div className="text-xs text-gray-500">Teacher: {log.teachers?.name}</div>
                                    <div className="text-xs text-gray-500">
                                        Absentees: {log.absentees_json?.length} | OD: {log.od_students_json?.length}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteLog(log.id)}
                                    className="bg-red-50 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-100"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
