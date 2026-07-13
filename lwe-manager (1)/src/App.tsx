// Replacement of /src/App.tsx - Added route for Daily Stats Entry module
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Players } from './pages/Players';
import { Home } from './pages/Home';
import { Approvals } from './pages/Approvals';
import { Complaints } from './pages/Complaints';
import { Chatbox } from './pages/Chatbox';
import { SettingsPage } from './pages/Settings';
import { Stats } from './pages/Stats';
import { Finance } from './pages/Finance';
import { DailyStats } from './pages/DailyStats';
import { Profile } from './pages/Profile';
import { PaymentHistory } from './pages/PaymentHistory';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public login/register page */}
          <Route path="/login" element={<Login />} />

          {/* Core App Protected Routes */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/players" 
            element={
              <ProtectedRoute>
                <Players />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/stats" 
            element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payment-history" 
            element={
              <ProtectedRoute>
                <PaymentHistory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/complaints" 
            element={
              <ProtectedRoute>
                <Complaints />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chatbox" 
            element={
              <ProtectedRoute>
                <Chatbox />
              </ProtectedRoute>
            } 
          />

          {/* Admin-only Routes */}
          <Route 
            path="/finance" 
            element={
              <ProtectedRoute adminOnly={true}>
                <Finance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/approvals" 
            element={
              <ProtectedRoute adminOnly={true}>
                <Approvals />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/daily-stats" 
            element={
              <ProtectedRoute adminOnly={true}>
                <DailyStats />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute adminOnly={true}>
                <SettingsPage />
              </ProtectedRoute>
            } 
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
      
      {/* Toast notifier configurations */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#0c081e',
            color: '#f3f4f6',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            fontSize: '13px',
            fontFamily: 'monospace',
          },
          success: {
            iconTheme: {
              primary: '#a855f7',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          }
        }}
      />
    </AuthProvider>
  );
}
