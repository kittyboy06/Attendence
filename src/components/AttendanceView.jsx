import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';
import { compareSignatures } from '../utils/signatureUtils';
import LoadingBar from './LoadingBar';
import { getCurrentPeriod, PERIODS } from '../utils/timeUtils';

import { useLocation, useNavigate } from 'react-router-dom';

const AttendanceView = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const editMode = location.state?.editMode;
    const logData = location.state?.logData;
    const fromPath = location.state?.from || '/admin';

    // Manual Mode State
    const manualMode = location.state?.manualMode;
    const manualClassData = location.state?.manualClassData;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeClass, setActiveClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // { studentId: 'Present' | 'Absent' | 'OD' }
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Multi-Teacher & Verification State
    const [selectedPeriods, setSelectedPeriods] = useState(new Set());
    const [combinedClasses, setCombinedClasses] = useState([]); // Store full class objects for each period
    const [requiredTeachers, setRequiredTeachers] = useState([]); // Unique teachers to verify
    const [currentVerifierIndex, setCurrentVerifierIndex] = useState(0);
    const [verifiedSignatures, setVerifiedSignatures] = useState({}); // { teacherId: signatureUrl }

    const [customStartTime, setCustomStartTime] = useState('');
    const [customEndTime, setCustomEndTime] = useState('');

    // Verification State
    const [pinInput, setPinInput] = useState('');
    const [signatureAttempts, setSignatureAttempts] = useState(0);
    const [isPinFallback, setIsPinFallback] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState('');

    const sigCanvas = useRef({});

    // Fetch active class based on current time OR Edit Data OR Manual Mode
    useEffect(() => {
        if (editMode && logData) {
            // Edit Mode: Hydrate from passing data
            setActiveClass({
                id: null,
                subject_id: logData.subject_id,
                teacher_id: logData.teacher_id,
                subjects: logData.subjects || { name: 'Unknown Subject', code: '---' },
                teachers: logData.teachers || { name: 'Unknown Teacher' },
                start_time: 'EDIT',
                end_time: 'MODE',
                period_label: 'Editing Record',
                date: logData.date
            });
            // Editing single record, so just that period
            setSelectedPeriods(new Set([logData.period_number]));
            setCombinedClasses([{ period_number: logData.period_number, teacher_id: logData.teacher_id, teachers: logData.teachers }]);
            setRequiredTeachers([logData.teachers]); // Just one for edit
            fetchStudents(logData);
            setLoading(false);
        } else if (manualMode && manualClassData) {
            // Manual Mode: New Entry for Past Date
            setActiveClass({
                ...manualClassData,
                start_time: 'MANUAL',
                end_time: 'ENTRY',
                period_label: manualClassData.period_number === 0 ? 'Extra Class' : 'Manual Entry'
            });
            setSelectedPeriods(new Set([manualClassData.period_number]));
            setCombinedClasses([manualClassData]);

            // Need to fetch teacher pin/sig for verification if not present
            loadTeacherDetails([manualClassData]);

            // Default Custom Time if Extra Class
            if (manualClassData.period_number === 0) {
                const now = new Date();
                setCustomStartTime(format(now, 'hh:mm a'));
                setCustomEndTime(format(new Date(now.getTime() + 60 * 60 * 1000), 'hh:mm a'));
            }

            fetchStudents(null);
            setLoading(false);
        } else {
            checkActiveClass();
        }
    }, [editMode, logData, manualMode, manualClassData]);

    const loadTeacherDetails = async (classes) => {
        const tIds = [...new Set(classes.map(c => c.teacher_id))];
        const { data } = await supabase.from('teachers').select('*').in('id', tIds);
        if (data) setRequiredTeachers(data);
    };

    const checkActiveClass = async () => {
        setLoading(true);
        const now = new Date();
        const currentDateStr = format(now, 'yyyy-MM-dd');
        let day = format(now, 'EEEE');
        const currentTime = format(now, 'HH:mm:ss');
        const currentPeriod = getCurrentPeriod();

        // CHECK OVERRIDE
        const { data: override } = await supabase.from('special_schedules').select('day_order').eq('date', currentDateStr).maybeSingle();
        if (override) {
            day = override.day_order; // e.g. 'Monday'
        }

        let initialClass = null;

        // 1. Try finding a standard period class first
        if (currentPeriod && currentPeriod.type !== 'break') {
            const { data } = await supabase
                .from('time_table')
                .select(`*, subjects (name, code), teachers (name)`)
                .eq('day_of_week', day)
                .eq('period_number', currentPeriod.id)
                .limit(1)
                .maybeSingle();

            if (data) initialClass = { ...data, start_time: currentPeriod.start, end_time: currentPeriod.end, period_label: currentPeriod.label };
        }

        // 2. Fallback to Extra Class logic
        if (!initialClass) {
            const { data: extraClass } = await supabase
                .from('time_table')
                .select(`*, subjects (name, code), teachers (name)`)
                .eq('day_of_week', day)
                .eq('period_number', 0)
                .lte('start_time', currentTime)
                .gte('end_time', currentTime)
                .limit(1)
                .maybeSingle();

            if (extraClass) {
                initialClass = {
                    ...extraClass,
                    period_label: 'Extra Class',
                    start_time: extraClass.start_time.slice(0, 5),
                    end_time: extraClass.end_time.slice(0, 5)
                };
            }
        }

        if (initialClass) {
            setActiveClass(initialClass);

            // AUTO-COMBINE LOGIC: Find Contiguous Periods for Same Subject
            // We only do this for standard periods (1-8). Extra class (0) is usually standalone.
            let relatedClasses = [initialClass];
            let periods = new Set([initialClass.period_number]);

            if (initialClass.period_number !== 0) {
                // Fetch ALL classes for this subject today
                const { data: allSubjectClasses } = await supabase
                    .from('time_table')
                    .select(`*, subjects (name, code), teachers (name)`)
                    .eq('day_of_week', day)
                    .eq('subject_id', initialClass.subject_id)
                    .neq('period_number', 0) // Explicitly ignore Extra Classes in auto-combine
                    .order('period_number');

                if (allSubjectClasses) {
                    // Logic: Keep adding previous/next periods if they are adjacent
                    // CURRENT: P2. ALL: P1, P2, P3.
                    // We want [P1, P2, P3].
                    // Simple logic: Just group ALL periods of this subject? 
                    // No, P1 (Math) and P8 (Math) should usually be separate unless adjacent.
                    // Contiguity check:
                    // 1. Find index of current class
                    // 2. Expand left/right

                    const sorted = allSubjectClasses.sort((a, b) => a.period_number - b.period_number);
                    const currentIdx = sorted.findIndex(c => c.period_number === initialClass.period_number);

                    if (currentIdx !== -1) {
                        const contiguous = [sorted[currentIdx]];

                        // Expand Left
                        for (let i = currentIdx - 1; i >= 0; i--) {
                            if (sorted[i].period_number === sorted[i + 1].period_number - 1) {
                                contiguous.unshift(sorted[i]);
                            } else break;
                        }
                        // Expand Right
                        for (let i = currentIdx + 1; i < sorted.length; i++) {
                            if (sorted[i].period_number === sorted[i - 1].period_number + 1) {
                                contiguous.push(sorted[i]);
                            } else break;
                        }
                        relatedClasses = contiguous;
                        periods = new Set(contiguous.map(c => c.period_number));
                    }
                }
            }

            setSelectedPeriods(periods);
            setCombinedClasses(relatedClasses); // These have different teacher_ids potentially
            loadTeacherDetails(relatedClasses); // Helper to set requiredTeachers
            fetchStudents(null);
        } else {
            setActiveClass(null);
        }
        setLoading(false);
    };

    const fetchStudents = async (existingLog = null) => {
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .order('register_no', { ascending: true });

        if (data) {
            setStudents(data);
            const initialStatus = {};

            if (existingLog) {
                const absentees = existingLog.absentees_json || [];
                const ods = existingLog.od_students_json || [];
                data.forEach(s => {
                    if (absentees.includes(s.id)) initialStatus[s.id] = 'Absent';
                    else if (ods.includes(s.id)) initialStatus[s.id] = 'OD';
                    else initialStatus[s.id] = 'Present';
                });
            } else {
                data.forEach(s => {
                    if (s.status === 'Long Absent' || s.status === 'Drop Out') {
                        initialStatus[s.id] = 'Absent';
                    } else {
                        initialStatus[s.id] = 'Present';
                    }
                });
            }
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

    const submitAttendance = async (finalSignatures = null) => {
        setSubmitting(true);
        const absentees = students.filter(s => attendance[s.id] === 'Absent').map(s => s.id);
        const odStudents = students.filter(s => attendance[s.id] === 'OD').map(s => s.id);
        let errorResult;

        if (editMode && logData) {
            // UPDATE EXISTING RECORD (Single)
            // Just assume one teacher for edit
            const currentTId = logData.teacher_id;
            const signatureUrl = finalSignatures ? finalSignatures[currentTId] : null;

            const payload = {
                absentees_json: absentees,
                od_students_json: odStudents,
                ...(signatureUrl && { teacher_signature_url: signatureUrl })
            };
            const { error } = await supabase.from('attendance_logs').update(payload).eq('id', logData.id);
            errorResult = error;

        } else {
            // INSERT NEW RECORD (Multi-Period Support)
            const logDate = activeClass.date || new Date().toISOString().split('T')[0];
            const periodsToSave = Array.from(selectedPeriods); // [1, 2, ...]

            if (periodsToSave.length === 0) {
                alert("Please select at least one period.");
                setSubmitting(false);
                return;
            }

            try {
                // Loop through periods and insert
                const promises = periodsToSave.map(async (pNum) => {
                    // Find the config for this period
                    const periodConfig = combinedClasses.find(c => c.period_number === pNum) || activeClass;
                    const signatureUrl = finalSignatures ? finalSignatures[periodConfig.teacher_id] : null;

                    const loadPayload = {
                        subject_id: periodConfig.subject_id,
                        teacher_id: periodConfig.teacher_id,
                        absentees_json: absentees,
                        od_students_json: odStudents,
                        teacher_signature_url: signatureUrl,
                        date: logDate,
                        period_number: pNum
                    };

                    // Check duplicate
                    const { data: existingCheck } = await supabase
                        .from('attendance_logs')
                        .select('id')
                        .eq('date', logDate)
                        .eq('subject_id', periodConfig.subject_id)
                        .eq('teacher_id', periodConfig.teacher_id)
                        .eq('period_number', pNum)
                        .maybeSingle();

                    if (existingCheck) {
                        return supabase.from('attendance_logs').update(loadPayload).eq('id', existingCheck.id);
                    } else {
                        return supabase.from('attendance_logs').insert(loadPayload);
                    }
                });

                const results = await Promise.all(promises);
                const errors = results.filter(r => r.error).map(r => r.error.message);

                if (errors.length > 0) errorResult = { message: errors.join(', ') };

            } catch (err) {
                errorResult = err;
            }
        }

        if (errorResult) {
            alert('Error saving: ' + errorResult.message);
        } else {
            alert('Success!');
            if (editMode || manualMode) {
                navigate('/admin');
            } else {
                setShowModal(false);
                setPinInput('');
                setSignatureAttempts(0);
                setIsPinFallback(false);
                setVerifiedSignatures({});
                setCurrentVerifierIndex(0);
            }
        }
        setSubmitting(false);
    };


    const handleVerification = async () => {
        setUploading(true);
        setVerificationMessage('');

        try {
            const currentTeacher = requiredTeachers[currentVerifierIndex];
            if (!currentTeacher) {
                alert("Configuration Error: No teacher found to verify.");
                setUploading(false);
                return;
            }

            const teacherPin = currentTeacher.pin || '0000';

            // PIN MODE
            if (isPinFallback) {
                if (!pinInput) {
                    alert("Please enter PIN.");
                    setUploading(false);
                    return;
                }
                if (pinInput === teacherPin) {
                    await handleVerificationSuccess(currentTeacher.id, null); // PIN = no sig URL
                } else {
                    alert("Invalid PIN.");
                    setUploading(false); // Stop here
                }
                return;
            }

            // SIGNATURE MODE
            if (sigCanvas.current.isEmpty()) {
                alert("Please sign.");
                setUploading(false);
                return;
            }

            const currentSigData = sigCanvas.current.toDataURL('image/png');

            if (!currentTeacher.signature_url) {
                alert(`No reference signature for ${currentTeacher.name}. Use PIN.`);
                setIsPinFallback(true);
                setUploading(false);
                return;
            }

            const similarity = await compareSignatures(currentTeacher.signature_url, currentSigData);

            if (similarity >= 0.05) { // 5% threshold
                const signatureBlob = await (await fetch(currentSigData)).blob();
                const fileName = `sig_${currentTeacher.id}_${Date.now()}.png`;
                const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, signatureBlob);
                const publicUrl = uploadError ? null : supabase.storage.from('signatures').getPublicUrl(fileName).data.publicUrl;
                await handleVerificationSuccess(currentTeacher.id, publicUrl);
            } else {
                const newAttempts = signatureAttempts + 1;
                setSignatureAttempts(newAttempts);
                setVerificationMessage(`Signature mismatch! (${newAttempts}/3)`);

                if (newAttempts >= 3) {
                    setTimeout(() => {
                        setIsPinFallback(true);
                        setVerificationMessage("Too many failed attempts. Use PIN.");
                    }, 1000);
                }
                setUploading(false);
            }

        } catch (err) {
            console.error(err);
            alert("Verification error.");
            setUploading(false);
        }
    };

    const handleVerificationSuccess = async (teacherId, publicUrl) => {
        const newMap = { ...verifiedSignatures, [teacherId]: publicUrl || 'PIN_VERIFIED' };
        setVerifiedSignatures(newMap);

        if (currentVerifierIndex + 1 < requiredTeachers.length) {
            // Move to next teacher
            alert(`Verified ${requiredTeachers[currentVerifierIndex].name}. Next: ${requiredTeachers[currentVerifierIndex + 1].name}`);
            setCurrentVerifierIndex(prev => prev + 1);
            if (sigCanvas.current && sigCanvas.current.clear) sigCanvas.current.clear();
            setPinInput('');
            setSignatureAttempts(0);
            setIsPinFallback(false);
            setUploading(false);
            setVerificationMessage('');
        } else {
            // All verified, submit!
            await submitAttendance(newMap);
        }
    };

    const resetVerification = () => {
        if (sigCanvas.current && sigCanvas.current.clear) sigCanvas.current.clear();
        setPinInput('');
        setVerificationMessage('');
        setSignatureAttempts(0);
        setIsPinFallback(false);
    };

    if (loading) return <div className="p-4 text-center">Checking Schedule...</div>;
    if (!activeClass) return (
        <div className="p-4 text-center mt-10">
            <h2 className="text-xl font-bold text-gray-700">No Active Class Found</h2>
            <button onClick={checkActiveClass} className="mt-4 text-blue-500 underline">Refresh</button>
        </div>
    );

    const isExtraClass = activeClass.period_number === 0 || selectedPeriods.has(0);
    const currentVerifier = requiredTeachers[currentVerifierIndex];

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header */}
            {submitting && <LoadingBar />}
            <div className={`flex-none text-white p-6 rounded-b-3xl shadow-lg relative z-20 transition-colors ${isExtraClass ? 'bg-purple-600' : 'bg-blue-600'}`}>
                <h1 className="text-2xl font-bold">{activeClass.subjects?.name || 'Unknown Class'}</h1>
                <div className="flex justify-between items-center mt-2 opacity-90">
                    <span className={`text-sm font-medium px-2 py-1 rounded ${isExtraClass ? 'bg-purple-500' : 'bg-blue-500'}`}>{activeClass.subjects?.code || '---'}</span>
                    <div className="text-right">
                        <span className="text-sm block">{activeClass.teachers?.name || 'Unknown Teacher'}</span>
                        {/* Show if combined */}
                        {requiredTeachers.length > 1 && <span className="text-xs opacity-75"> + {requiredTeachers.length - 1} others</span>}
                    </div>
                </div>

                {/* Time Display/Edit */}
                <div className={`mt-4 text-sm ${isExtraClass ? 'text-purple-100' : 'text-blue-100'} flex items-center gap-2`}>
                    {isExtraClass && manualMode ? (
                        <div className="flex gap-2 items-center bg-white/20 p-1 px-2 rounded-lg backdrop-blur-sm">
                            <input value={customStartTime} onChange={e => setCustomStartTime(e.target.value)} className="bg-transparent w-20 border-b border-white/50 focus:outline-none text-center" placeholder="--:--" />
                            <span>-</span>
                            <input value={customEndTime} onChange={e => setCustomEndTime(e.target.value)} className="bg-transparent w-20 border-b border-white/50 focus:outline-none text-center" placeholder="--:--" />
                        </div>
                    ) : (
                        <span>
                            {selectedPeriods.size > 1 ? `Periods: Array.from(selectedPeriods).join(', ')` : (activeClass.period_label || ('Period ' + activeClass.period_number))}
                            {' • '}{activeClass.start_time} - {activeClass.end_time}
                        </span>
                    )}
                </div>
            </div>



            {/* Search */}
            <div className="flex-none px-4 mt-4 z-10">
                <input
                    type="text"
                    placeholder="Search..."
                    className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-4">
                {students.filter(s =>
                    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.register_no?.toLowerCase().includes(searchTerm.toLowerCase())
                ).map(student => (
                    <div
                        key={student.id}
                        onClick={() => toggleStatus(student.id)}
                        className={`p-4 rounded-xl flex justify-between items-center cursor-pointer border-2 transition-all ${(student.status === 'Long Absent' || student.status === 'Drop Out') ? 'border-red-500 bg-red-100 opacity-75' :
                            attendance[student.id] === 'Present' ? 'border-transparent bg-white shadow-sm' :
                                attendance[student.id] === 'Absent' ? 'border-red-500 bg-red-50' :
                                    'border-yellow-500 bg-yellow-50'
                            }`}
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-800">{student.name}</p>
                                {student.status === 'Long Absent' && <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded">LA</span>}
                            </div>
                            <p className="text-xs text-gray-400">{student.register_no}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${attendance[student.id] === 'Present' ? 'bg-green-100 text-green-700' : attendance[student.id] === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {attendance[student.id]}
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex-none p-4 bg-white border-t z-30">
                <button
                    onClick={() => { setShowModal(true); setIsPinFallback(false); setSignatureAttempts(0); setCurrentVerifierIndex(0); setVerifiedSignatures({}); }}
                    className={`w-full text-white py-3 rounded-xl font-bold shadow-xl active:scale-95 transition-transform ${isExtraClass ? 'bg-purple-600 shadow-purple-200' : 'bg-blue-600 shadow-blue-200'}`}
                >
                    Verify & Submit
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Verification</h3>
                            {requiredTeachers.length > 1 && (
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                    Step {currentVerifierIndex + 1}/{requiredTeachers.length}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                            Verifying: <span className="font-bold text-gray-800">{currentVerifier?.name}</span>
                        </p>

                        {!isPinFallback ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl h-64 bg-gray-50 relative">
                                <SignatureCanvas ref={sigCanvas} canvasProps={{ className: 'w-full h-full' }} />
                                {verificationMessage && <div className="absolute bottom-0 w-full text-center text-red-500 bg-white/80">{verificationMessage}</div>}
                            </div>
                        ) : (
                            <input
                                type="password"
                                maxLength={4}
                                placeholder="PIN"
                                className="w-full text-center text-3xl border-2 rounded-lg p-3"
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value)}
                            />
                        )}
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500">Cancel</button>
                            <button onClick={handleVerification} disabled={uploading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">
                                {uploading ? 'Checking...' : (currentVerifierIndex + 1 < requiredTeachers.length ? 'Next' : 'Verify')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceView;
