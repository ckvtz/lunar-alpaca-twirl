import React, { useState } from 'react';
import SubscriptionList from '@/components/SubscriptionList';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import SubscriptionControls from '@/components/SubscriptionControls';

const Subscriptions: React.FC = () => {
  const [sortBy, setSortBy] = useState<'name' | 'renewal_price' | 'next_payment_date'>('next_payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterCycle, setFilterCycle] = useState<'monthly' | 'quarterly' | 'annually' | 'weekly' | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const queryOptions = {
    sortBy,
    sortOrder,
    filterCycle: filterCycle === 'all' ? undefined : filterCycle,
    filterCategory: filterCategory === 'all' ? undefined : filterCategory,
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Subscriptions</h1>
        <Link to="/subscriptions/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </Link>
      </div>
      
      <div className="mb-6">
        <SubscriptionControls
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          filterCycle={filterCycle}
          setFilterCycle={setFilterCycle}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
        />
      </div>

      <SubscriptionList queryOptions={queryOptions} />
    </div>
  );
};

export default Subscriptions;