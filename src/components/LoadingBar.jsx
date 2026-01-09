import React from 'react';

const LoadingBar = () => {
    return (
        <div className="fixed top-0 left-0 w-full h-1 bg-blue-100 z-[100] overflow-hidden">
            <div className="h-full bg-blue-600 animate-loading-bar"></div>
        </div>
    );
};

export default LoadingBar;
