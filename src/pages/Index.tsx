import { MadeWithDyad } from "@/components/made-with-dyad";
import SupabaseConnectionTest from "@/components/SupabaseConnectionTest";
import { useSession } from "@/contexts/SessionContext";
import { Navigate } from "react-router-dom";

const Index = () => {
  const { user } = useSession();

  if (user) {
    // Redirect authenticated users to the main subscriptions page
    return <Navigate to="/subscriptions" replace />;
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Welcome to SubscriptionGuard
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Please sign in to manage your subscriptions.
        </p>
      </div>
      
      <div className="space-y-6 w-full max-w-lg">
        <SupabaseConnectionTest />
      </div>

      <div className="mt-auto pt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;