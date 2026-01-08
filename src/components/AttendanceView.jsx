import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';

const AttendanceView = () => {
    const [loading, setLoading] = useState(true);
    const [activeClass, setActiveClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // { studentId: 'Present' | 'Absent' | 'OD' }
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const sigCanvas = useRef({});

    // Fetch active class based on current time
    useEffect(() => {
        checkActiveClass();
    }, []);

    const checkActiveClass = async () => {
        setLoading(true);
        const now = new Date();
        const day = format(now, 'EEEE'); // 'Monday'
        const time = format(now, 'HH:mm:ss');

        // Query time_table to find class happening NOW
        // Note: This logic assumes simple time ranges. Database Time type comparison is standard.
        // We fetch ALL for the day and filter in JS for simplicity or use exact DB queries.
        // For now, let's fetch pending classes for the day.

        // Simplification: Just get the FIRST match for the current Day and Time
        const { data, error } = await supabase
            .from('time_table')
            .select(`
        *,
        subjects (name, code),
        teachers (name)
      `)
            .eq('day_of_week', day)
            .lte('start_time', time)
            .gte('end_time', time)
            .limit(1)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
            console.error('Error fetching time table:', error);
        }

        if (data) {
            setActiveClass(data);
            fetchStudents();
        } else {
            // Fallback for demo if no class is found currently (remove in prod)
            // setActiveClass({ 
            //     subjects: { name: 'Demo Subject', code: 'DEMO101' }, 
            //     teachers: { name: 'Demo Teacher' } 
            // });
            // fetchStudents();
            setActiveClass(null);
        }
        setLoading(false);
    };

    const fetchStudents = async () => {
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .order('register_no', { ascending: true });

        if (error) console.error('Error fetching students:', error);
        if (data) {
            setStudents(data);
            // Initialize all as Present
            const initialStatus = {};
            data.forEach(s => initialStatus[s.id] = 'Present');
            setAttendance(initialStatus);
        }
    };

    const toggleStatus = (studentId) => {
        setAttendance(prev => {
            const current = prev[studentId];
            let next = 'Present';
            if (current === 'Present') next = 'Absent';
            else if (current === 'Absent') next = 'OD';
            else next = 'Present';
            return { ...prev, [studentId]: next };
        });
    };

    const handleSubmit = async () => {
        if (sigCanvas.current.isEmpty()) {
            alert('Teacher signature is required!');
            return;
        }

        setUploading(true);

        // 1. Upload Signature
        const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        const signatureBlob = await (await fetch(signatureData)).blob();
        const fileName = `sig_${Date.now()}.png`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('signatures')
            .upload(fileName, signatureBlob);

        if (uploadError) {
            alert('Error uploading signature: ' + uploadError.message);
            setUploading(false);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from('signatures')
            .getPublicUrl(fileName);

        const signatureUrl = publicUrlData.publicUrl;

        // 2. Prepare Data
        const absentees = students.filter(s => attendance[s.id] === 'Absent').map(s => s.id);
        const odStudents = students.filter(s => attendance[s.id] === 'OD').map(s => s.id);

        // 3. Insert Log
        const { error: insertError } = await supabase
            .from('attendance_logs')
            .insert({
                subject_id: activeClass.subject_id,
                teacher_id: activeClass.teacher_id,
                absentees_json: absentees,
                od_students_json: odStudents,
                teacher_signature_url: signatureUrl,
                date: new Date().toISOString().split('T')[0]
            });

        if (insertError) {
            alert('Error saving attendance: ' + insertError.message);
        } else {
            alert('Attendance Marked Successfully!');
            setShowModal(false);
            // Reset or redirect
        }
        setUploading(false);
    };

    if (loading) return <div className="p-4 text-center">Checking Schedule...</div>;
    if (!activeClass) return (
        <div className="p-4 text-center mt-10">
            <h2 className="text-xl font-bold text-gray-700">No Active Class Found</h2>
            <p className="text-gray-500">You are free for now!</p>
            <button onClick={checkActiveClass} className="mt-4 text-blue-500 underline">Refresh</button>
        </div>
    );

    return (
        <div className="max-w-md mx-auto bg-white min-h-screen pb-20 shadow-md sm:rounded-xl sm:overflow-hidden sm:min-h-0 sm:my-10">
            {/* Header */}
            <div className="bg-blue-600 text-white p-6 rounded-b-3xl shadow-lg relative z-10">
                <h1 className="text-2xl font-bold">{activeClass.subjects.name}</h1>
                <div className="flex justify-between items-center mt-2 opacity-90">
                    <span className="text-sm font-medium bg-blue-500 px-2 py-1 rounded">{activeClass.subjects.code}</span>
                    <span className="text-sm">{activeClass.teachers.name}</span>
                </div>
                <div className="mt-4 text-blue-100 text-sm">
                    {activeClass.start_time} - {activeClass.end_time}
                </div>
            </div>

            {/* Student List */}
            <div className="p-4 space-y-3 mt-2">
                {students.map(student => (
                    <div
                        key={student.id}
                        onClick={() => toggleStatus(student.id)}
                        className={`p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all duration-200 border-2 ${attendance[student.id] === 'Present' ? 'border-transparent bg-white shadow-sm hover:shadow-md' :
                            attendance[student.id] === 'Absent' ? 'border-red-500 bg-red-50 shadow-inner' :
                                'border-yellow-500 bg-yellow-50 shadow-inner'
                            }`}
                    >
                        <div>
                            <p className="font-semibold text-gray-800">{student.name}</p>
                            <p className="text-xs text-gray-400">{student.register_no}</p>
                        </div>
                        <div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${attendance[student.id] === 'Present' ? 'bg-green-100 text-green-700' :
                                attendance[student.id] === 'Absent' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                {attendance[student.id]}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Submit Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 sm:absolute">
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
                >
                    Verify & Submit
                </button>
            </div>

            {/* Verification Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-slide-up">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Teacher Verification</h3>
                        <p className="text-sm text-gray-500 mb-4">Please sign below to authorize this attendance.</p>

                        <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                            <SignatureCanvas
                                ref={sigCanvas}
                                penColor="black"
                                canvasProps={{ width: 300, height: 160, className: 'sigCanvas' }}
                            />
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 text-gray-600 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => sigCanvas.current.clear()}
                                className="flex-1 py-3 text-red-500 font-medium"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={uploading}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md disabled:bg-gray-400"
                            >
                                {uploading ? '...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceView;
