import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import AttendanceView from './components/AttendanceView';
import HistoryView from './components/HistoryView';
import StudentDashboard from './components/StudentDashboard';

const Nav = () => {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="w-full bg-white border-t border-gray-200 z-40 flex-none px-2 py-2 flex justify-around items-center">
            <Link to="/" className={`flex flex-col items-center p-2 rounded-lg transition ${isActive('/') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                <span className="text-xs font-medium mt-1">Mark</span>
            </Link>
            <Link to="/history" className={`flex flex-col items-center p-2 rounded-lg transition ${isActive('/history') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-xs font-medium mt-1">History</span>
            </Link>
            <Link to="/student" className={`flex flex-col items-center p-2 rounded-lg transition ${isActive('/student') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                <span className="text-xs font-medium mt-1">Student</span>
            </Link>
        </nav>
    );
}

function ClientApp() {
    return (
        <Router basename={import.meta.env.BASE_URL}>
            <div className="fixed inset-0 w-full h-full bg-gray-100 font-sans text-gray-900 flex flex-col overflow-hidden sm:p-4">
                <div className="flex-1 flex flex-col w-full h-full sm:max-w-md sm:mx-auto bg-white sm:rounded-xl sm:overflow-hidden shadow-xl relative">
                    <div className="flex-1 w-full overflow-hidden relative">
                        <Routes>
                            <Route path="/" element={<AttendanceView />} />
                            <Route path="/history" element={<HistoryView />} />
                            <Route path="/student" element={<StudentDashboard />} />
                        </Routes>
                    </div>
                    <Nav />
                </div>
            </div>
        </Router>
    );
}

export default ClientApp;
