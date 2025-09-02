'use client';
import MobileMap from '@/components/map/MobileMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MapPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Patches Map</h1>
      <Card>
        <CardHeader>
          <CardTitle>Map View</CardTitle>
        </CardHeader>
        <CardContent>
          <MobileMap />
        </CardContent>
      </Card>
    </div>
  );
}
