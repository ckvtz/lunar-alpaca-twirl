import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useSession();

  if (isLoading) {
    // The SessionProvider handles the initial loading state with a spinner, 
    // but we keep this check here for safety if used outside the main app structure.
    return null; 
  }

  if (!user) {
    // User is not authenticated, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;