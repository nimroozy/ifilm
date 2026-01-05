import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Search from './pages/Search';
import Watch from './pages/Watch';
import WatchSeries from './pages/WatchSeries';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/Dashboard';
import JellyfinSettings from './pages/admin/JellyfinSettings';
import LibraryManagement from './pages/admin/LibraryManagement';
import UserManagement from './pages/admin/UserManagement';
import R2Settings from '@/pages/admin/R2Settings';
import R2FileManager from '@/pages/admin/R2FileManager';
import NotFound from './pages/NotFound';
import Footer from './components/Footer';
import { User } from './types/auth.types';

const queryClient = new QueryClient();

// Protected Route Component - Only for authenticated pages
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    // Store the current path to redirect back after login
    const currentPath = window.location.pathname;
    localStorage.setItem('redirectAfterLogin', currentPath);
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Admin Route Component - Only for admin users
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('accessToken');
  const userStr = localStorage.getItem('user');
  
  if (!token) {
    const currentPath = window.location.pathname;
    localStorage.setItem('redirectAfterLogin', currentPath);
    return <Navigate to="/login" replace />;
  }
  
  if (userStr) {
    const user: User = JSON.parse(userStr);
    if (user.role !== 'admin') {
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

// Public Route Component (redirect to home if already logged in on auth pages)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('accessToken');
  
  if (token) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Layout wrapper component to conditionally show footer
const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const hideFooterPaths = ['/login', '/register', '/watch/', '/watch-series/'];
  const shouldHideFooter = hideFooterPaths.some(path => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col">
      {children}
      {!shouldHideFooter && <Footer />}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Public Auth Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />

            {/* Public Browse Routes - No authentication required */}
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/series" element={<Series />} />
            <Route path="/search" element={<Search />} />

            {/* Protected Routes - Authentication required */}
            <Route
              path="/watch/:id"
              element={
                <ProtectedRoute>
                  <Watch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watch-series/:id"
              element={
                <ProtectedRoute>
                  <WatchSeries />
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

            {/* Admin Routes - Admin role required */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/jellyfin-settings"
              element={
                <AdminRoute>
                  <JellyfinSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/r2-settings"
              element={
                <AdminRoute>
                  <R2Settings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/r2-files"
              element={
                <AdminRoute>
                  <R2FileManager />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/libraries"
              element={
                <AdminRoute>
                  <LibraryManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;