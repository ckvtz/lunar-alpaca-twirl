import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSession } from "@/contexts/SessionContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user } = useSession();

  if (user) {
    // Redirect authenticated users to the main dashboard page
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Welcome to SubscriptionGuard
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
          Track, manage, and never forget a payment again.
        </p>
        <Link to="/login">
          <Button size="lg">Get Started / Sign In</Button>
        </Link>
      </div>
      
      <div className="mt-auto pt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;