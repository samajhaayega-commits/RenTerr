/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Login from './pages/Login';
import ItemDetails from './pages/ItemDetails';
import Checkout from './pages/Checkout';
import BookingSuccess from './pages/BookingSuccess';
import MyBookings from './pages/MyBookings';
import AddItem from './pages/AddItem';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Chat from './pages/Chat';
import Inbox from './pages/Inbox';
import MyListings from './pages/MyListings';
import EditItem from './pages/EditItem';
import OwnerDashboard from './pages/OwnerDashboard';

import { useEffect } from 'react';
import { logSecurityEvent, createAuditLog } from './services/auditService';

function AppContent() {
  const { user, loading, profile } = useAuth();

  // Security Monitor & Self-Healing simulation
  useEffect(() => {
    if (!user) return;

    createAuditLog('DATA_ACCESS', 'User session heartbeat', user.uid);

    const checkSecurity = async () => {
      if (profile?.isRestricted) {
        // Force session termination or warning
        console.warn("RESTRICTED ACCOUNT: Limited functionality.");
      }
    };
    checkSecurity();

  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/item/:id" element={<ItemDetails />} />
          <Route path="/checkout/:id" element={<Checkout />} />
          <Route path="/booking-success/:id" element={<BookingSuccess />} />
          <Route path="/bookings" element={<MyBookings />} />
          <Route path="/add-item" element={<AddItem />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat/:chatId" element={<Chat />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
          <Route path="/edit-item/:id" element={<EditItem />} />
          <Route 
            path="/admin" 
            element={profile?.role === 'admin' ? <Admin /> : <Navigate to="/" />} 
          />
        </Routes>
        <Navigation />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
