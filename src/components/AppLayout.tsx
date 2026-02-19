import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Plus, BarChart3, Users, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logoPrimary from '@/assets/logo-primary.png';

const AppLayout: React.FC = () => {
  const { isAdmin, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/invoices/new', icon: Plus, label: 'New' },
    { path: '/customers', icon: Users, label: 'Customers' },
    ...(isAdmin ? [
      { path: '/reports', icon: BarChart3, label: 'Reports' },
    ] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <img src={logoPrimary} alt="Banaras Dyeing" className="h-8" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/users')}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <UserCircle className="h-6 w-6" />
          </button>

          <button
            onClick={signOut}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/dashboard' && item.path !== '/invoices/new' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
              >
                <Icon className={`h-5 w-5 ${item.path === '/invoices/new' ? 'rounded-full bg-primary p-0.5 text-primary-foreground' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
