import React from 'react';
import { Home, ClipboardList, PlusCircle, User, ShieldCheck, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export default function Navigation() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 bottom-tab-shadow flex justify-between items-center z-50">
      <TabItem to="/" icon={<Home size={22} />} label="Home" />
      <TabItem to="/bookings" icon={<ClipboardList size={22} />} label="Bookings" />
      <TabItem to="/add-item" icon={<PlusCircle size={28} className="text-primary-600" />} label="Add" />
      <TabItem to="/inbox" icon={<MessageSquare size={22} />} label="Messages" />
      <TabItem to="/profile" icon={<User size={22} />} label="Profile" />
      {isAdmin && (
        <TabItem to="/admin" icon={<ShieldCheck size={22} />} label="Admin" />
      )}
    </nav>
  );
}

function TabItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 transition-colors",
          isActive ? "text-primary-600" : "text-gray-400"
        )
      }
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </NavLink>
  );
}
