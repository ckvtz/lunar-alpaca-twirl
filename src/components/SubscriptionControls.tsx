import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowDownAZ, ArrowUpAZ, DollarSign, Calendar } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCategories } from '@/hooks/use-categories';
import { Skeleton } from '@/components/ui/skeleton';

interface SubscriptionControlsProps {
  sortBy: 'name' | 'renewal_price' | 'next_payment_date';
  setSortBy: (value: 'name' | 'renewal_price' | 'next_payment_date') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (value: 'asc' | 'desc') => void;
  filterCycle: 'monthly' | 'quarterly' | 'annually' | 'weekly' | 'all';
  setFilterCycle: (value: 'monthly' | 'quarterly' | 'annually' | 'weekly' | 'all') => void;
  filterCategory: string;
  setFilterCategory: (value: string) => void;
}

const SubscriptionControls: React.FC<SubscriptionControlsProps> = ({
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  filterCycle,
  setFilterCycle,
  filterCategory,
  setFilterCategory,
}) => {
  const { data: categories, isLoading: isLoadingCategories } = useCategories();

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-card">
      
      {/* Filter by Cycle */}
      <div className="flex flex-col space-y-1 flex-1">
        <Label htmlFor="filter-cycle">Billing Cycle</Label>
        <Select 
          value={filterCycle} 
          onValueChange={(value) => setFilterCycle(value as 'monthly' | 'quarterly' | 'annually' | 'weekly' | 'all')}
        >
          <SelectTrigger id="filter-cycle">
            <SelectValue placeholder="Filter by Cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter by Category */}
      <div className="flex flex-col space-y-1 flex-1">
        <Label htmlFor="filter-category">Category</Label>
        {isLoadingCategories ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select 
            value={filterCategory} 
            onValueChange={setFilterCategory}
          >
            <SelectTrigger id="filter-category">
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sort By */}
      <div className="flex flex-col space-y-1 flex-1">
        <Label htmlFor="sort-by">Sort By</Label>
        <Select 
          value={sortBy} 
          onValueChange={(value) => setSortBy(value as 'name' | 'renewal_price' | 'next_payment_date')}
        >
          <SelectTrigger id="sort-by">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next_payment_date" className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" /> Next Payment Date
            </SelectItem>
            <SelectItem value="renewal_price" className="flex items-center">
              <DollarSign className="h-4 w-4 mr-2" /> Price
            </SelectItem>
            <SelectItem value="name" className="flex items-center">
              <ArrowDownAZ className="h-4 w-4 mr-2" /> Name
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order */}
      <div className="flex flex-col space-y-1 w-20">
        <Label>Order</Label>
        <ToggleGroup 
          type="single" 
          value={sortOrder} 
          onValueChange={(value) => {
            if (value) setSortOrder(value as 'asc' | 'desc');
          }}
          className="h-10"
        >
          <ToggleGroupItem value="asc" aria-label="Toggle ascending" className="flex-1">
            <ArrowUpAZ className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="desc" aria-label="Toggle descending" className="flex-1">
            <ArrowDownAZ className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default SubscriptionControls;