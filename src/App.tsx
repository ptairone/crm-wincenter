import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
// removed TooltipProvider import
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/Dashboard";
import Reports from "./pages/admin/Reports";
import Products from "./pages/admin/Products";
import Goals from "./pages/admin/Goals";
import CompanyCosts from "./pages/admin/CompanyCosts";
import CommissionRules from "./pages/admin/CommissionRules";
import AdminCommissions from "./pages/admin/Commissions";
import AdminSales from "./pages/admin/Sales";
import UsersInvites from "./pages/admin/UsersInvites";
import SiteSettings from "./pages/admin/SiteSettings";
import Notifications from "./pages/Notifications";
import SellerDashboard from "./pages/seller/Dashboard";
import Clients from "./pages/seller/Clients";
import Opportunities from "./pages/seller/Opportunities";
import Sales from "./pages/seller/Sales";
import Commissions from "./pages/seller/Commissions";
import Visits from "./pages/seller/Visits";
import Demonstrations from "./pages/seller/Demonstrations";
import SellerProducts from "./pages/seller/Products";
import SellerReports from "./pages/seller/Reports";
import NotFound from "./pages/NotFound";
 import Warranties from "./pages/seller/Warranties";
 import ServiceOrders from "./pages/seller/ServiceOrders";
 import TasksPage from "./pages/Tasks";
 const queryClient = new QueryClient();

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { loading } = useSiteSettings();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Navigate to="/seller/dashboard" replace />} />
            
            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <AdminRoute>
                  <Reports />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminRoute>
                  <Products />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/goals"
              element={
                <AdminRoute>
                  <Goals />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/company-costs"
              element={
                <AdminRoute>
                  <CompanyCosts />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/commission-rules"
              element={
                <AdminRoute>
                  <CommissionRules />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/commissions"
              element={
                <AdminRoute>
                  <AdminCommissions />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/sales"
              element={
                <AdminRoute>
                  <AdminSales />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users-invites"
              element={
                <AdminRoute>
                  <UsersInvites />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/site-settings"
              element={
                <AdminRoute>
                  <SiteSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            
            {/* Shared Tasks Route */}
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TasksPage />
                </ProtectedRoute>
              }
            />
            
            {/* Seller Routes */}
            <Route
              path="/seller/dashboard"
              element={
                <ProtectedRoute>
                  <SellerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/clients"
              element={
                <ProtectedRoute>
                  <Clients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/opportunities"
              element={
                <ProtectedRoute>
                  <Opportunities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/products"
              element={
                <ProtectedRoute>
                  <SellerProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/sales"
              element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/commissions"
              element={
                <ProtectedRoute>
                  <Commissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/visits"
              element={
                <ProtectedRoute>
                  <Visits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/demonstrations"
              element={
                <ProtectedRoute>
                  <Demonstrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/reports"
              element={
                <ProtectedRoute>
                  <SellerReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/warranties"
              element={
                <ProtectedRoute>
                  <Warranties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/service-orders"
              element={
                <ProtectedRoute>
                  <ServiceOrders />
                </ProtectedRoute>
              }
            />


            <Route path="*" element={<NotFound />} />
            </Routes>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </>
  </QueryClientProvider>
);

export default App;
