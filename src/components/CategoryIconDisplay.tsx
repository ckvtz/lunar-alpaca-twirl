import React from 'react';
import * as LucideIcons from 'lucide-react';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryIconDisplayProps {
  iconName: string | null;
  className?: string;
}

// Map of Lucide icon names to components
const iconMap: Record<string, React.ElementType> = LucideIcons as unknown as Record<string, React.ElementType>;

const CategoryIconDisplay: React.FC<CategoryIconDisplayProps> = ({ iconName, className }) => {
  if (!iconName) {
    return <DollarSign className={cn("h-4 w-4", className)} />;
  }

  // Capitalize the first letter to match Lucide component names (e.g., 'monitor' -> 'Monitor')
  const normalizedIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  
  const IconComponent = iconMap[normalizedIconName];

  if (IconComponent) {
    // We need to ensure the component is rendered with the correct size/class
    return <IconComponent className={cn("h-4 w-4", className)} />;
  }

  // Fallback if the icon name is invalid or not found
  return <DollarSign className={cn("h-4 w-4", className)} />;
};

export default CategoryIconDisplay;