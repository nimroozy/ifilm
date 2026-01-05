import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, Library, Users, LogOut, Menu, Shield, Cloud, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { isDemoMode, exitDemoMode } from '@/services/mockAuth.service';

interface AdminLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/jellyfin-settings', label: 'Jellyfin Settings', icon: Settings },
  { path: '/admin/r2-settings', label: 'R2 Settings', icon: Cloud },
  { path: '/admin/r2-files', label: 'R2 File Manager', icon: FolderOpen },
  { path: '/admin/libraries', label: 'Library Management', icon: Library },
  { path: '/admin/users', label: 'User Management', icon: Users },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDemo = isDemoMode();

  const handleLogout = () => {
    if (isDemo) {
      exitDemoMode();
      toast.success('Exited demo mode');
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      toast.success('Logged out successfully');
    }
    navigate('/');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[#2A2A2A]">
        <Link to="/" className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[#E50914]">iFilm</h1>
          <Badge className="bg-blue-600 hover:bg-blue-700">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={`w-full justify-start ${
                  isActive
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#2A2A2A]">
        <Button
          variant="ghost"
          className="w-full justify-start text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          {isDemo ? 'Exit Demo' : 'Logout'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#141414] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-[#1F1F1F] border-r border-[#2A2A2A]">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden fixed top-4 left-4 z-50">
          <Button variant="outline" size="icon" className="bg-[#1F1F1F] border-[#2A2A2A]">
            <Menu className="h-5 w-5 text-white" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-[#1F1F1F] border-[#2A2A2A]">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}