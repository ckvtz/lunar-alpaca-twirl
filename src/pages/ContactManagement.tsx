import React from 'react';
import ContactForm from '@/components/ContactForm';

const ContactManagement: React.FC = () => {
  return (
    <div className="container mx-auto py-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
      <ContactForm />
    </div>
  );
};

export default ContactManagement;