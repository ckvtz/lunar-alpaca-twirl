import React from 'react';
import TelegramContactForm from '@/components/TelegramContactForm';
import EmailContactStatus from '@/components/EmailContactStatus';
import { Separator } from '@/components/ui/separator';

const ContactManagement: React.FC = () => {
  return (
    <div className="container mx-auto py-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
      
      <div className="space-y-8">
        <EmailContactStatus />
        <Separator />
        <TelegramContactForm />
      </div>
    </div>
  );
};

export default ContactManagement;