import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import AttendanceView from './components/AttendanceView';
// Note: We might need AttendanceView if the "Edit" button in History still navigates to it.
// If so, we need to decide if Admin App includes marking functionality or if it redirects to the main app.
// For now, let's include AttendanceView in AdminApp too so they can edit without leaving the "Admin App" scope.

function AdminApp() {
    // Use basename '/Attendence/admin' if deployed under subdir, or just '/admin'
    // But wait, if we are doing MPA, the entry point is /admin/index.html.
    // The 'basename' for Router depends on where this is served.
    // If served at /Attendence/admin/, then basename should be /Attendence/admin

    const base = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL + 'admin'
        : import.meta.env.BASE_URL + '/admin';

    return (
        <Router basename={base}>
            <div className="fixed inset-0 w-full h-full bg-gray-100 font-sans text-gray-900 flex flex-col overflow-hidden">
                {/* Admin Dashboard is full screen usually, or constrained? Let's keep same layout style */}
                <div className="h-full w-full sm:max-w-2xl sm:mx-auto bg-white shadow-xl relative overflow-hidden">
                    <Routes>
                        <Route path="/" element={<AdminDashboard />} />
                        {/* If Admin clicks "Edit" on a log, it goes to /mark (root in main app) or a route here? */}
                        {/* In AdminDashboard.jsx, navigate is call to '/', so it would go to root of THIS router */}
                        {/* So we mount AttendanceView at '/' ? No, AdminDashboard is at '/'. */}
                        {/* Let's mount AttendanceView at '/mark' inside Admin App specifically for editing? */}
                        {/* And update AdminDashboard to navigate to '/mark' instead of '/'? */}
                        {/* Or just navigate to '../' to go to main app? */}
                        {/* For now, let's keep it simple: Map root '/' to AdminDashboard. */}

                        {/* If we want to support "Edit", we need the route. Let's add it. */}
                        <Route path="/mark" element={<AttendanceView />} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default AdminApp;
