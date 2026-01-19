import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import LoadingBar from './LoadingBar';
import { PERIODS } from '../utils/timeUtils';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('teachers');
    const [loading, setLoading] = useState(false);

    // Data handling
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [students, setStudents] = useState([]);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [academicStartDate, setAcademicStartDate] = useState('');

    // Forms
    const [editingId, setEditingId] = useState(null);
    const [newTeacherName, setNewTeacherName] = useState('');
    const [newTeacherTitle, setNewTeacherTitle] = useState('Dr.');
    const [newTeacherPin, setNewTeacherPin] = useState('0000');
    const sigCanvasRef = useRef({});
    const [showSigModal, setShowSigModal] = useState(false);
    const [pendingSignature, setPendingSignature] = useState(null);
    const [newSubject, setNewSubject] = useState({ name: '', code: '' });
    const [newClass, setNewClass] = useState({ day: 'Monday', period: 1, subject: '', teacher: '' });
    const [newStudent, setNewStudent] = useState({ name: '', register_no: '', status: 'Active' });

    // Holidays
    const [holidays, setHolidays] = useState([]);
    const [newHoliday, setNewHoliday] = useState({ date: '', description: '' });

    // Special Schedules (Day Order)
    const [specialSchedules, setSpecialSchedules] = useState([]);
    const [newOverride, setNewOverride] = useState({ date: '', day_order: 'Monday', description: '' });

    // History - Manual Add
    const [showPeriodSelector, setShowPeriodSelector] = useState(false);

    // Schedule - Custom Time
    const [customTime, setCustomTime] = useState({ start: '', end: '' });
    const [schedulePeriods, setSchedulePeriods] = useState(new Set([1]));

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated, activeTab, historyDate]);

    const handleLogin = () => {
        if (password === 'admin123') {
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

            if (students.length === 0) {
                const { data: studs } = await supabase.from('students').select('*');
                setStudents(studs || []);
            }
        } else if (activeTab === 'settings') {
            const { data } = await supabase.from('settings').select('value').eq('key', 'academic_start_date').maybeSingle();
            if (data) setAcademicStartDate(data.value);

            const { data: h } = await supabase.from('holidays').select('*').order('date');
            setHolidays(h || []);

            const { data: ss } = await supabase.from('special_schedules').select('*').order('date');
            setSpecialSchedules(ss || []);
        }
        setLoading(false);
    };

    const resetForms = () => {
        setEditingId(null);
        setNewTeacherName('');
        setNewTeacherTitle('Dr.');
        setNewTeacherPin('0000');
        setPendingSignature(null);
        if (sigCanvasRef.current && sigCanvasRef.current.clear) sigCanvasRef.current.clear();
        setNewSubject({ name: '', code: '' });
        setNewClass({ day: 'Monday', period: 1, subject: '', teacher: '' });
        setNewStudent({ name: '', register_no: '', status: 'Active' });
    };

    const saveSettings = async () => {
        if (!academicStartDate) return;
        const { error } = await supabase.from('settings').upsert({ key: 'academic_start_date', value: academicStartDate });
        if (error) alert('Error saving settings');
        else alert('Settings saved!');
    };

    const addHoliday = async () => {
        if (!newHoliday.date || !newHoliday.description) {
            alert("Please enter Date and Description");
            return;
        }
        const { error } = await supabase.from('holidays').insert(newHoliday);
        if (error) alert(error.message);
        else {
            setNewHoliday({ date: '', description: '' });
            fetchData();
        }
    };

    const deleteHoliday = async (id) => {
        if (!confirm('Delete this holiday?')) return;
        const { error } = await supabase.from('holidays').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const addOverride = async () => {
        if (!newOverride.date) return alert("Select a date");
        const { error } = await supabase.from('special_schedules').upsert({
            date: newOverride.date,
            day_order: newOverride.day_order,
            description: newOverride.description
        }, { onConflict: 'date' });

        if (error) alert(error.message);
        else {
            setNewOverride({ date: '', day_order: 'Monday', description: '' });
            fetchData();
        }
    };

    const deleteOverride = async (id) => {
        if (!confirm('Remove this override?')) return;
        const { error } = await supabase.from('special_schedules').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

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

        if (pendingSignature) {
            const signatureBlob = await (await fetch(pendingSignature)).blob();
            const fileName = 'ref_sig_' + Date.now() + '.png';
            const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, signatureBlob);
            if (!uploadError) {
                signatureUrl = supabase.storage.from('signatures').getPublicUrl(fileName).data.publicUrl;
            }
        }

        if (editingId) {
            const updateData = { name: fullName, pin: newTeacherPin };
            if (signatureUrl) updateData.signature_url = signatureUrl;
            const { error } = await supabase.from('teachers').update(updateData).eq('id', editingId);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('teachers').insert({ name: fullName, pin: newTeacherPin, signature_url: signatureUrl });
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
    // --- SCHEDULE ---
    const addOrUpdateClass = async () => {
        const { day, subject, teacher } = newClass;

        // Validate basic fields (removed 'period' check as we use Set)
        if (!day || !subject || !teacher) {
            alert('Please select Day, Subject, and Teacher');
            return;
        }

        if (schedulePeriods.size === 0) {
            alert('Please select at least one period');
            return;
        }

        const periodsToSave = Array.from(schedulePeriods);
        let errorOccurred = false;

        for (const pId of periodsToSave) {
            const periodInfo = PERIODS.find(p => p.id === pId);

            let sTime = periodInfo?.start;
            let eTime = periodInfo?.end;

            // Custom Time Logic for Extra Class (Period 0)
            if (pId === 0) {
                if (!customTime.start || !customTime.end) {
                    alert("Please set Start and End time for Extra Class.");
                    return;
                }
                sTime = customTime.start;
                eTime = customTime.end;
            }

            // Ensure format HH:MM:00
            if (sTime && sTime.length === 5) sTime += ':00';
            if (eTime && eTime.length === 5) eTime += ':00';

            const payload = {
                day_of_week: day,
                period_number: pId,
                start_time: sTime,
                end_time: eTime,
                subject_id: subject,
                teacher_id: teacher
            };

            if (editingId) {
                // Edit: Update ONLY the specific record being edited
                const { error } = await supabase.from('time_table').update(payload).eq('id', editingId);
                if (error) { console.error(error); errorOccurred = true; }
                break; // Only update once for edit mode
            } else {
                // Add: Insert for each selected period
                const { error } = await supabase.from('time_table').insert(payload);
                if (error) { console.error(error); errorOccurred = true; }
            }
        }

        if (errorOccurred) alert('Some operations failed. See console.');
        else resetForms();

        setCustomTime({ start: '', end: '' });
        fetchData();
    };

    const startEditClass = (c) => {
        setEditingId(c.id);
        setNewClass({
            day: c.day_of_week,
            period: c.period_number,
            subject: c.subject_id,
            teacher: c.teacher_id
        });
        setSchedulePeriods(new Set([c.period_number]));

        if (c.period_number === 0) {
            setCustomTime({
                start: c.start_time ? c.start_time.slice(0, 5) : '',
                end: c.end_time ? c.end_time.slice(0, 5) : ''
            });
        }
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
        setNewStudent({ name: s.name, register_no: s.register_no, status: s.status || 'Active' });
    };

    const deleteStudent = async (id) => {
        if (!confirm('Delete this student?')) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    // --- HISTORY MANUAL ADD ---
    const handlePeriodSelect = async (periodNum) => {
        if (periodNum === 0) {
            // EXTRA CLASS (Custom) logic
            // We pass dummy "Extra Class" data so AttendanceView initializes correctly
            // We'll let the user fill details? Or just generic "Extra Class"
            // For now, let's grab the first Subject/Teacher as default or just Unknown
            // Actually, AttendanceView will just crash if subject_id is null?
            // Let's create a "Custom Entry" shell
            const extraData = {
                period_number: 0,
                // We need valid subject/teacher for DB constraints if strict?
                // Our DB schema might enforce NOT NULL on subject/teacher. 
                // We'll pick the first available one or let AttendanceView error?
                // Better: Check if we have subjects to pick from, default to first (usually a "General" or similar helps)
                subject_id: subjects.length > 0 ? subjects[0].id : null,
                teacher_id: teachers.length > 0 ? teachers[0].id : null,
                subjects: subjects.length > 0 ? subjects[0] : { name: 'Select Subject', code: 'EXT' },
                teachers: teachers.length > 0 ? teachers[0] : { name: 'Select Teacher' }
            };

            navigate('/', {
                state: {
                    manualMode: true,
                    manualClassData: extraData,
                    from: '/admin'
                }
            });
            return;
        }

        // Regular 1-8 logic (Fetching schedule)
        const dateObj = new Date(historyDate);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[dateObj.getDay()];

        setLoading(true);
        const { data: classInfo, error } = await supabase
            .from('time_table')
            .select('*, subjects(name, code), teachers(name)')
            .eq('day_of_week', dayName)
            .eq('period_number', periodNum)
            .maybeSingle();
        setLoading(false);

        if (error) { alert('Error fetching schedule'); return; }

        if (!classInfo) {
            alert(`No class scheduled for ${dayName} Period ${periodNum}.`);
            return;
        }

        const manualClassData = { ...classInfo, date: historyDate };
        navigate('/', { state: { manualMode: true, manualClassData, from: '/admin' } });
    };

    if (!isAuthenticated) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 bg-gray-50 h-screen">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Admin Login</h2>
                <input type="password" placeholder="Enter Password" className="border p-3 rounded-xl mb-4 w-full bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" value={password || ''} onChange={e => setPassword(e.target.value)} />
                <button onClick={handleLogin} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg shadow-blue-200">Login</button>
            </div>
        </div>
    );

    return (
        <div className="h-full bg-gray-50 flex flex-col sm:max-w-md sm:mx-auto">
            <div className="bg-white p-4 shadow-sm flex-none z-10 sticky top-0"><h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1></div>
            {loading && <LoadingBar />}
            <div className="bg-white border-b overflow-x-auto flex-none">
                <div className="flex px-4 py-2 gap-2 min-w-max">
                    {['teachers', 'subjects', 'students', 'schedule', 'history', 'settings'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-20">
                {activeTab === 'teachers' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <h3 className="font-bold text-lg text-gray-800">{editingId ? 'Edit Teacher' : 'Add Teacher'}</h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <select className="border p-3 rounded-xl bg-gray-50 w-20 flex-shrink-0" value={newTeacherTitle} onChange={e => setNewTeacherTitle(e.target.value)}>
                                        <option>Dr.</option><option>Prof.</option><option>Mr.</option><option>Ms.</option><option>Mrs.</option>
                                    </select>
                                    <input className="border p-3 rounded-xl bg-gray-50 flex-1 w-full" placeholder="Name" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} />
                                </div>
                                <div className="flex gap-2">
                                    <input className="border p-3 rounded-xl bg-gray-50 w-24 text-center font-mono" placeholder="PIN" type="tel" maxLength={4} value={newTeacherPin} onChange={e => setNewTeacherPin(e.target.value)} />
                                    <button onClick={() => { setShowSigModal(true); setTimeout(() => sigCanvasRef.current?.clear(), 100); }} className={`flex-1 py-3 rounded-xl text-white font-medium shadow-sm active:scale-95 transition-all text-sm ${pendingSignature ? 'bg-green-500' : 'bg-gray-400'}`}>{pendingSignature ? 'Sig Captured' : 'Capture Sig'}</button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button onClick={addOrUpdateTeacher} className={`flex-1 ${editingId ? 'bg-orange-500' : 'bg-blue-600'} text-white py-3 rounded-xl font-bold shadow-md`}>{editingId ? 'Update' : 'Add'}</button>
                                    {editingId && <button onClick={resetForms} className="text-gray-400 py-3 px-4 font-medium">Cancel</button>}
                                </div>
                            </div>
                        </div>
                        {showSigModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                                    <h3 className="text-lg font-bold mb-4">Draw Signature</h3>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white relative h-64 mb-4"><SignatureCanvas ref={sigCanvasRef} canvasProps={{ className: 'sigCanvas w-full h-full' }} /></div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowSigModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium">Cancel</button>
                                        <button onClick={() => sigCanvasRef.current.clear()} className="flex-1 py-3 rounded-xl bg-red-50 text-red-500 font-medium">Clear</button>
                                        <button onClick={() => { if (!sigCanvasRef.current.isEmpty()) { setPendingSignature(sigCanvasRef.current.toDataURL('image/png')); setShowSigModal(false); } else { alert("Please sign first"); } }} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold">Save</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            {teachers.map(t => (
                                <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100">
                                    <div><h4 className="font-bold text-gray-800">{t.name}</h4><div className="flex items-center gap-2 mt-1"><span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">PIN: {t.pin}</span>{t.signature_url && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">Sig Added</span>}</div></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditTeacher(t)} className="bg-blue-50 text-blue-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                                        <button onClick={() => deleteTeacher(t.id)} className="bg-red-50 text-red-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'subjects' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <h3 className="font-bold text-lg text-gray-800">{editingId ? 'Edit Subject' : 'Add Subject'}</h3>
                            <div className="flex flex-col gap-3">
                                <input className="border p-3 rounded-xl bg-gray-50" placeholder="Subject Name" value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} />
                                <div className="flex gap-2">
                                    <input className="border p-3 rounded-xl bg-gray-50 flex-1" placeholder="Code (e.g., CS101)" value={newSubject.code} onChange={e => setNewSubject({ ...newSubject, code: e.target.value })} />
                                    <button onClick={addOrUpdateSubject} className={`${editingId ? 'bg-orange-500' : 'bg-blue-600'} text-white px-6 rounded-xl font-bold shadow-md`}>{editingId ? 'Update' : 'Add'}</button>
                                </div>
                                {editingId && <button onClick={resetForms} className="text-gray-400 text-sm text-center">Cancel</button>}
                            </div>
                        </div>
                        <div className="space-y-3">
                            {subjects.map(s => (
                                <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100">
                                    <div><h4 className="font-bold text-gray-800 leading-tight">{s.name}</h4><span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded mt-1 inline-block">{s.code}</span></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditSubject(s)} className="bg-blue-50 text-blue-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                                        <button onClick={() => deleteSubject(s.id)} className="bg-red-50 text-red-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'students' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <h3 className="font-bold text-lg text-gray-800">{editingId ? 'Edit Student' : 'Add Student'}</h3>
                            <div className="flex flex-col gap-3">
                                <input className="border p-3 rounded-xl bg-gray-50" placeholder="Student Name" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                                <div className="flex gap-2">
                                    <input className="border p-3 rounded-xl bg-gray-50 w-full" placeholder="Reg No." value={newStudent.register_no} onChange={e => setNewStudent({ ...newStudent, register_no: e.target.value })} />
                                    <select className="border p-3 rounded-xl bg-white flex-1 min-w-[100px]" value={newStudent.status || 'Active'} onChange={e => setNewStudent({ ...newStudent, status: e.target.value })}><option value="Active">Active</option><option value="Long Absent">Absent</option><option value="Drop Out">Dropped</option></select>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={addOrUpdateStudent} className={`w-full ${editingId ? 'bg-orange-500' : 'bg-blue-600'} text-white py-3 rounded-xl font-bold shadow-md`}>{editingId ? 'Update Student' : 'Add Student'}</button>
                                    {editingId && <button onClick={resetForms} className="text-gray-400 px-2">Cancel</button>}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {students.map(s => (
                                <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100">
                                    <div className="min-w-0 pr-2">
                                        <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-gray-900 block truncate">{s.name}</span>{s.status === 'Long Absent' && <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">Long Absent</span>}{s.status === 'Drop Out' && <span className="text-[10px] bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full border border-gray-300 whitespace-nowrap">Dropout</span>}</div>
                                        <span className="text-xs text-gray-400">{s.register_no}</span>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => startEditStudent(s)} className="bg-blue-50 text-blue-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                                        <button onClick={() => deleteStudent(s.id)} className="bg-red-50 text-red-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'schedule' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <h3 className="font-bold text-lg text-gray-800">{editingId ? 'Edit Class' : 'Add Class'}</h3>
                            <div className="flex flex-col gap-3">
                                <select className="border p-3 rounded-xl bg-gray-50 w-full" value={newClass.day} onChange={e => setNewClass({ ...newClass, day: e.target.value })}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (<option key={d} value={d}>{d}</option>))}</select>

                                {/* MULTI-SELECT PERIOD GRID */}
                                <div className="grid grid-cols-4 gap-2">
                                    {PERIODS.filter(p => !p.type || p.type === 'extra').map(p => {
                                        const isSelected = schedulePeriods && schedulePeriods.has(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    const newSet = new Set(schedulePeriods);
                                                    if (p.id === 0) {
                                                        // If selecting Extra (0), clear everything else
                                                        if (newSet.has(0)) newSet.delete(0); // Toggle off
                                                        else {
                                                            newSet.clear();
                                                            newSet.add(0);
                                                        }
                                                    } else {
                                                        // If selecting standard period, remove Extra (0) if present
                                                        if (newSet.has(0)) newSet.delete(0);

                                                        // Toggle current
                                                        if (newSet.has(p.id)) newSet.delete(p.id);
                                                        else newSet.add(p.id);
                                                    }
                                                    setSchedulePeriods(newSet);
                                                }}
                                                className={`py-2 rounded-lg text-sm font-bold border-2 transition-all ${isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                                    }`}
                                            >
                                                {p.id === 0 ? 'Extra' : p.id}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* CUSTOM TIME INPUTS FOR EXTRA CLASS (If Selected) */}
                                {schedulePeriods && schedulePeriods.has(0) && (
                                    <div className="flex gap-2 animate-fade-in">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 ml-1">Start Time</label>
                                            <input type="time" className="w-full border p-3 rounded-xl bg-purple-50 border-purple-200" value={customTime.start} onChange={e => setCustomTime({ ...customTime, start: e.target.value })} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 ml-1">End Time</label>
                                            <input type="time" className="w-full border p-3 rounded-xl bg-purple-50 border-purple-200" value={customTime.end} onChange={e => setCustomTime({ ...customTime, end: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                <select className="border p-3 rounded-xl bg-gray-50 w-full" value={newClass.subject} onChange={e => setNewClass({ ...newClass, subject: e.target.value })}><option value="">Select Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                <select className="border p-3 rounded-xl bg-gray-50 w-full" value={newClass.teacher} onChange={e => setNewClass({ ...newClass, teacher: e.target.value })}><option value="">Select Teacher</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={addOrUpdateClass} className={`flex-1 ${editingId ? 'bg-orange-500' : 'bg-blue-600'} text-white py-3 rounded-xl font-bold shadow-md`}>{editingId ? 'Update Class' : 'Add Class'}</button>
                                {editingId && <button onClick={resetForms} className="text-gray-400 px-4 font-medium">Cancel</button>}
                            </div>
                        </div>
                        <div className="space-y-3">
                            {schedule.map(c => {
                                const periodInfo = PERIODS.find(p => p.id === c.period_number);
                                return (
                                    <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100">
                                        <div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.period_number === 0 ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {c.day_of_week}
                                            </span>
                                            <div className="font-bold text-gray-800 mt-1">{c.subjects?.name}</div>
                                            <div className="text-sm text-gray-500 mt-0.5">
                                                {c.period_number === 0
                                                    ? `Extra Class (${c.start_time?.slice(0, 5)} - ${c.end_time?.slice(0, 5)})`
                                                    : `${periodInfo?.label || 'Period ' + c.period_number} (${periodInfo?.start || ''})`
                                                }
                                                {' • '}{c.teachers?.name}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => startEditClass(c)} className="bg-blue-50 text-blue-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                                            <button onClick={() => deleteClass(c.id)} className="bg-red-50 text-red-600 p-2 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                            <h3 className="font-bold text-lg text-gray-800">Select Date</h3>
                            <input type="date" className="border p-3 rounded-xl bg-gray-50 w-full" value={historyDate} onChange={e => setHistoryDate(e.target.value)} />
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                            <button onClick={() => setShowPeriodSelector(!showPeriodSelector)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>{showPeriodSelector ? 'Cancel' : 'Add Past Attendance'}</button>
                            {showPeriodSelector && (
                                <div className="mt-4 animate-fade-in">
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                                            <button key={p} onClick={() => handlePeriodSelect(p)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 rounded-xl border border-indigo-200 transition-colors">Period {p}</button>
                                        ))}
                                    </div>
                                    <button onClick={() => handlePeriodSelect(0)} className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-3 rounded-xl border border-purple-200 transition-colors">Extra Class (Custom)</button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            {historyLogs.length === 0 ? <p className="text-center text-gray-400 py-10">No records found for this date.</p> : null}
                            {historyLogs.map(log => {
                                const isExpanded = expandedLogId === log.id;
                                const absenteeNames = students.filter(s => log.absentees_json?.includes(s.id)).map(s => s.name);
                                const odNames = students.filter(s => log.od_students_json?.includes(s.id)).map(s => s.name);
                                return (
                                    <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                                        <div className="flex justify-between items-center">
                                            <div><div className="font-bold text-gray-800">{log.subjects?.name}</div><div className="text-xs text-gray-500">{log.teachers?.name}</div><div className="text-xs mt-1"><span className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 mr-2">Absent: {log.absentees_json?.length}</span><span className="bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded border border-yellow-100">OD: {log.od_students_json?.length}</span></div></div>
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); navigate('/mark', { state: { editMode: true, logData: log, from: '/admin' } }); }} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium">Edit</button>
                                                <button onClick={(e) => { e.stopPropagation(); deleteLog(log.id); }} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium">Delete</button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-4 pt-3 border-t text-sm animate-fade-in"><div className="mb-3"><span className="font-bold text-red-600 block text-xs uppercase tracking-wider mb-1">Absentees</span>{absenteeNames.length > 0 ? (<div className="flex flex-wrap gap-2">{absenteeNames.map(name => (<span key={name} className="bg-red-50 text-red-700 px-2 py-1 rounded-lg text-xs border border-red-100 font-medium">{name}</span>))}</div>) : <span className="text-gray-400 italic text-xs">None</span>}</div><div><span className="font-bold text-yellow-600 block text-xs uppercase tracking-wider mb-1">On Duty</span>{odNames.length > 0 ? (<div className="flex flex-wrap gap-2">{odNames.map(name => (<span key={name} className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg text-xs border border-yellow-100 font-medium">{name}</span>))}</div>) : <span className="text-gray-400 italic text-xs">None</span>}</div></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-lg text-gray-800 mb-4">Academic Settings</h3>
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Academic Start Date</label>
                                <p className="text-xs text-gray-400 mb-3 leading-relaxed">Attendance percentage starts calculating from this date.</p>
                                <input type="date" className="border p-4 rounded-xl w-full bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none transition-all" value={academicStartDate} onChange={e => setAcademicStartDate(e.target.value)} />
                                <button onClick={saveSettings} className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform">Save Start Date</button>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-lg text-gray-800 mb-4">Holidays</h3>
                            <div className="flex flex-col gap-3 mb-6">
                                <div className="flex gap-2">
                                    <input type="date" className="border p-3 rounded-xl bg-gray-50 w-40" value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} />
                                    <input className="border p-3 rounded-xl bg-gray-50 flex-1" placeholder="Holiday Description (e.g. Diwali)" value={newHoliday.description} onChange={e => setNewHoliday({ ...newHoliday, description: e.target.value })} />
                                </div>
                                <button onClick={addHoliday} className="bg-green-600 text-white py-3 rounded-xl font-bold shadow-md active:scale-95 transition-transform">Add Holiday</button>
                            </div>

                            <div className="space-y-2">
                                {holidays.length === 0 && <p className="text-center text-gray-400 text-sm">No holidays added.</p>}
                                {holidays.map(h => (
                                    <div key={h.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <div>
                                            <span className="font-bold text-gray-800 block">{h.description}</span>
                                            <span className="text-xs text-gray-500">{h.date}</span>
                                        </div>
                                        <button onClick={() => deleteHoliday(h.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-lg text-gray-800 mb-4">Special Schedules (Day Order Change)</h3>
                            <p className="text-xs text-gray-400 mb-4">Make a specific date follow a different day's timetable (e.g. Saturday following Monday order).</p>

                            <div className="flex flex-col gap-3 mb-6">
                                <div className="flex gap-2">
                                    <input type="date" className="border p-3 rounded-xl bg-gray-50 flex-1" value={newOverride.date} onChange={e => setNewOverride({ ...newOverride, date: e.target.value })} />
                                    <select className="border p-3 rounded-xl bg-gray-50 flex-1" value={newOverride.day_order} onChange={e => setNewOverride({ ...newOverride, day_order: e.target.value })}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d}>{d}</option>)}</select>
                                </div>
                                <div className="flex gap-2">
                                    <input className="border p-3 rounded-xl bg-gray-50 flex-1" placeholder="Description (Optional)" value={newOverride.description} onChange={e => setNewOverride({ ...newOverride, description: e.target.value })} />
                                    <button onClick={addOverride} className="bg-purple-600 text-white px-6 rounded-xl font-bold shadow-md active:scale-95 transition-transform">Set Override</button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {specialSchedules.length === 0 && <p className="text-center text-gray-400 text-sm">No active overrides.</p>}
                                {specialSchedules.map(ss => (
                                    <div key={ss.id} className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                                        <div>
                                            <span className="font-bold text-purple-900 block">{ss.date} <span className="text-gray-400">→</span> {ss.day_order} Order</span>
                                            {ss.description && <span className="text-xs text-gray-500">{ss.description}</span>}
                                        </div>
                                        <button onClick={() => deleteOverride(ss.id)} className="bg-white text-red-600 p-2 rounded-lg border border-purple-100 shadow-sm hover:bg-red-50 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
