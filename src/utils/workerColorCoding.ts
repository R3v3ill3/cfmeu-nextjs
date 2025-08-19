/**
 * Utility functions for worker color coding based on union membership status and roles
 */

export interface WorkerColorInfo {
  backgroundColor: string;
  textColor: string;
  label: string;
}

/**
 * Get color coding for a worker based on their union membership status and roles
 */
export function getWorkerColorCoding(
  membershipStatus: string | null,
  roles: string[] = []
): WorkerColorInfo {
  // Check if worker has delegate or HSR role (blue)
  const hasLeadershipRole = roles.some(role => 
    role === 'company_delegate' || role === 'hsr'
  );
  
  if (hasLeadershipRole) {
    return {
      backgroundColor: 'bg-blue-100 dark:bg-blue-950/30',
      textColor: 'text-blue-900 dark:text-blue-100',
      label: 'Leadership Role'
    };
  }

  // Check membership status
  switch (membershipStatus) {
    case 'member':
      return {
        backgroundColor: 'bg-green-100 dark:bg-green-950/30',
        textColor: 'text-green-900 dark:text-green-100',
        label: 'Union Member'
      };
    case 'potential':
    case 'potential_member':
      return {
        backgroundColor: 'bg-orange-100 dark:bg-orange-950/30',
        textColor: 'text-orange-900 dark:text-orange-100',
        label: 'Potential Member'
      };
    case 'declined':
      return {
        backgroundColor: 'bg-red-100 dark:bg-red-950/30',
        textColor: 'text-red-900 dark:text-red-100',
        label: 'Declined Membership'
      };
    case 'non_member':
    default:
      return {
        backgroundColor: 'bg-gray-100 dark:bg-gray-800/30',
        textColor: 'text-gray-900 dark:text-gray-100',
        label: 'Non-Member'
      };
  }
}

/**
 * Get the color legend for the worker color coding system
 */
export function getWorkerColorLegend(): Array<{
  color: string;
  textColor: string;
  label: string;
  description: string;
}> {
  return [
    {
      color: 'bg-blue-100 dark:bg-blue-950/30',
      textColor: 'text-blue-900 dark:text-blue-100',
      label: 'Leadership',
      description: 'Delegates & HSRs'
    },
    {
      color: 'bg-green-100 dark:bg-green-950/30',
      textColor: 'text-green-900 dark:text-green-100',
      label: 'Member',
      description: 'Union members'
    },
    {
      color: 'bg-orange-100 dark:bg-orange-950/30',
      textColor: 'text-orange-900 dark:text-orange-100',
      label: 'Potential',
      description: 'Potential members'
    },
    {
      color: 'bg-red-100 dark:bg-red-950/30',
      textColor: 'text-red-900 dark:text-red-100',
      label: 'Declined',
      description: 'Declined membership'
    },
    {
      color: 'bg-gray-100 dark:bg-gray-800/30',
      textColor: 'text-gray-900 dark:text-gray-100',
      label: 'Non-Member',
      description: 'Non-union workers'
    }
  ];
}