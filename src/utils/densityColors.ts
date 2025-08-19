export const getDensityColor = (pct: number | null | undefined) => {
  const value = typeof pct === 'number' ? pct : 0;
  if (value > 75) return 'navy';
  if (value >= 50) return 'green';
  if (value >= 25) return 'orange';
  return 'red';
};

export const getDensityBadgeClass = (pct: number | null | undefined) => {
  const color = getDensityColor(pct);
  // Solid backgrounds with white text per requirements
  switch (color) {
    case 'navy':
      return 'border-transparent bg-blue-900 text-white hover:bg-blue-900';
    case 'green':
      return 'border-transparent bg-green-600 text-white hover:bg-green-600';
    case 'orange':
      return 'border-transparent bg-orange-500 text-white hover:bg-orange-500';
    case 'red':
    default:
      return 'border-transparent bg-red-600 text-white hover:bg-red-600';
  }
};

export const getProgressIndicatorClass = (pct: number | null | undefined) => {
  const color = getDensityColor(pct);
  switch (color) {
    case 'navy':
      return 'bg-blue-900';
    case 'green':
      return 'bg-green-600';
    case 'orange':
      return 'bg-orange-500';
    case 'red':
    default:
      return 'bg-red-600';
  }
};