import React from 'react';
import ProfileForm from '@/components/ProfileForm';

const Profile: React.FC = () => {
  return (
    <div className="container mx-auto py-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-6">User Settings</h1>
      <ProfileForm />
    </div>
  );
};

export default Profile;