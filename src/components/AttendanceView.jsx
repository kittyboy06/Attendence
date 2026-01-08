import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';
import { compareSignatures } from '../utils/signatureUtils';

const AttendanceView = () => {
    const [loading, setLoading] = useState(true);
    const [activeClass, setActiveClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // { studentId: 'Present' | 'Absent' | 'OD' }
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Verification State
    const [pinInput, setPinInput] = useState('');
    const [signatureAttempts, setSignatureAttempts] = useState(0);
    const [isPinFallback, setIsPinFallback] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState('');

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

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching time table:', error);
        }

        if (data) {
            setActiveClass(data);
            fetchStudents();
        } else {
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
            // Initialize all as Present, UNLESS status is 'Long Absent' or 'Drop Out'
            const initialStatus = {};
            data.forEach(s => {
                if (s.status === 'Long Absent' || s.status === 'Drop Out') {
                    initialStatus[s.id] = 'Absent';
                } else {
                    initialStatus[s.id] = 'Present';
                }
            });
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

    const submitAttendance = async (signatureUrlToSave = null) => {
        // 2. Prepare Data
        const absentees = students.filter(s => attendance[s.id] === 'Absent').map(s => s.id);
        const odStudents = students.filter(s => attendance[s.id] === 'OD').map(s => s.id);

        // 5. Upsert Attendance Log
        const today = new Date().toISOString().split('T')[0];

        const { data: existingLog } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('date', today)
            .eq('subject_id', activeClass.subject_id)
            .eq('teacher_id', activeClass.teacher_id)
            .maybeSingle();

        let errorResult;
        const payload = {
            subject_id: activeClass.subject_id,
            teacher_id: activeClass.teacher_id,
            absentees_json: absentees,
            od_students_json: odStudents,
            teacher_signature_url: signatureUrlToSave,
            date: today
        };

        if (existingLog) {
            const { error } = await supabase.from('attendance_logs').update(payload).eq('id', existingLog.id);
            errorResult = error;
        } else {
            const { error } = await supabase.from('attendance_logs').insert(payload);
            errorResult = error
        }

        if (errorResult) {
            alert('Error saving: ' + errorResult.message);
        } else {
            alert('Verified & Submitted Successfully!');
            setShowModal(false);
            setPinInput('');
            setSignatureAttempts(0);
            setIsPinFallback(false);
        }
    };


    const handleVerification = async () => {
        setUploading(true);
        setVerificationMessage('');

        try {
            // fetch teacher data first
            const { data: teacher, error } = await supabase
                .from('teachers')
                .select('pin, signature_url')
                .eq('id', activeClass.teacher_id)
                .single();

            if (error || !teacher) {
                alert("Error fetching teacher details.");
                setUploading(false);
                return;
            }

            // PIN FALLBACK MODE
            if (isPinFallback) {
                if (!pinInput) {
                    alert("Please enter PIN.");
                    setUploading(false);
                    return;
                }
                if (pinInput === teacher.pin) {
                    await submitAttendance(null); // No signature saved for PIN verify? Or we can save the last attempt?
                } else {
                    alert("Invalid PIN.");
                }
                setUploading(false);
                return;
            }

            // SIGNATURE MODE
            if (sigCanvas.current.isEmpty()) {
                alert("Please sign.");
                setUploading(false);
                return;
            }

            const currentSigData = sigCanvas.current.toDataURL('image/png');

            if (!teacher.signature_url) {
                // If no reference signature exists, fallback to PIN logic immediately or just accept (Security risk?)
                // Let's force PIN if no signature is set up.
                alert("No reference signature found. Please verify with PIN.");
                setIsPinFallback(true);
                setUploading(false);
                return;
            }

            // Client-side comparison
            const similarity = await compareSignatures(teacher.signature_url, currentSigData);
            console.log("Signature Similarity:", similarity);

            const THRESHOLD = 0.05; // 5% match - very lenient

            if (similarity >= THRESHOLD) {
                // Upload this valid signature and save
                const signatureBlob = await (await fetch(currentSigData)).blob();
                const fileName = `sig_${Date.now()}.png`;
                const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, signatureBlob);
                const publicUrl = uploadError ? null : supabase.storage.from('signatures').getPublicUrl(fileName).data.publicUrl;

                await submitAttendance(publicUrl);
            } else {
                // Mismatch
                const newAttempts = signatureAttempts + 1;
                setSignatureAttempts(newAttempts);
                setVerificationMessage(`Signature mismatch! (${newAttempts}/3)`);

                if (newAttempts >= 3) {
                    setTimeout(() => {
                        setIsPinFallback(true);
                        setVerificationMessage("Too many failed attempts. Use PIN.");
                    }, 1000);
                }
            }

        } catch (err) {
            console.error(err);
            alert("Verification error.");
        } finally {
            setUploading(false);
        }
    };

    const resetVerification = () => {
        if (sigCanvas.current && sigCanvas.current.clear) sigCanvas.current.clear();
        setPinInput('');
        setVerificationMessage('');
        // We do NOT reset attempts here to prevent brute forcing signature by clearing? 
        // Actually, clearing meant 'I messed up drawing', not 'I failed verification'.
        // But logic above increments only on FAIL. 
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
        <div className="flex flex-col h-full bg-white relative">
            {/* Header - Fixed at Top */}
            <div className="flex-none bg-blue-600 text-white p-6 rounded-b-3xl shadow-lg relative z-20">
                <h1 className="text-2xl font-bold">{activeClass.subjects.name}</h1>
                <div className="flex justify-between items-center mt-2 opacity-90">
                    <span className="text-sm font-medium bg-blue-500 px-2 py-1 rounded">{activeClass.subjects.code}</span>
                    <span className="text-sm">{activeClass.teachers.name}</span>
                </div>
                <div className="mt-4 text-blue-100 text-sm">
                    {activeClass.start_time} - {activeClass.end_time}
                </div>

                {/* Search Bar Embedded in Header area for better look (optional) or just below */}
            </div>

            {/* Search BarContainer */}
            <div className="flex-none px-4 mt-4 z-10">
                <input
                    type="text"
                    placeholder="Search by Name or Reg No..."
                    className="w-full p-3 rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Scrollable Student List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-4">
                {students.filter(s =>
                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.register_no.toLowerCase().includes(searchTerm.toLowerCase())
                ).map(student => (
                    <div
                        key={student.id}
                        onClick={() => toggleStatus(student.id)}
                        className={`p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all duration-200 border-2 ${(student.status === 'Long Absent' || student.status === 'Drop Out') ? 'border-red-500 bg-red-100 opacity-75' :
                                attendance[student.id] === 'Present' ? 'border-transparent bg-white shadow-sm hover:shadow-md' :
                                    attendance[student.id] === 'Absent' ? 'border-red-500 bg-red-50 shadow-inner' :
                                        'border-yellow-500 bg-yellow-50 shadow-inner'
                            }`}
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-800">{student.name}</p>
                                {student.status === 'Long Absent' && <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded border border-red-300">Long Absent</span>}
                                {student.status === 'Drop Out' && <span className="text-[10px] bg-gray-800 text-white px-1 rounded">Dropout</span>}
                            </div>
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

            {/* Submit Button - Static at Bottom of Flex Column */}
            <div className="flex-none p-4 bg-white border-t border-gray-100 z-30">
                <button
                    onClick={() => { setShowModal(true); setIsPinFallback(false); setSignatureAttempts(0); }}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-xl shadow-blue-200 active:scale-95 transition-transform"
                >
                    Verify & Submit
                </button>
            </div>

            {/* Verification Modal */}
            {showModal && (
                <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-slide-up">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Teacher Verification</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {isPinFallback ? "Verification Limit Exceeded. Enter PIN." : "Please sign below to authorize this attendance."}
                        </p>

                        {!isPinFallback ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 relative">
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    penColor="black"
                                    canvasProps={{ width: 340, height: 400, className: 'sigCanvas w-full h-full' }}
                                />
                                {verificationMessage && (
                                    <div className="absolute bottom-2 left-0 right-0 text-center text-red-500 text-xs font-bold bg-white/80 p-1">
                                        {verificationMessage}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="my-6">
                                <input
                                    type="password"
                                    maxLength={4}
                                    placeholder="Enter 4-digit PIN"
                                    className="w-full text-center text-3xl tracking-widest border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 outline-none"
                                    value={pinInput}
                                    onChange={e => setPinInput(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 text-gray-600 font-medium"
                            >
                                Cancel
                            </button>
                            {!isPinFallback && (
                                <button
                                    onClick={resetVerification}
                                    className="flex-1 py-3 text-red-500 font-medium"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                onClick={handleVerification}
                                disabled={uploading}
                                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-md disabled:bg-gray-400 ${isPinFallback ? 'bg-orange-500' : 'bg-blue-600'}`}
                            >
                                {uploading ? 'Checking...' : isPinFallback ? 'Verify PIN' : 'Verify Sign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceView;
