import { MadeWithDyad } from "@/components/made-with-dyad";
import SupabaseConnectionTest from "@/components/SupabaseConnectionTest";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">Welcome to Your App</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Start building your amazing project here!
        </p>
      </div>
      
      <SupabaseConnectionTest />

      <div className="mt-auto">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;