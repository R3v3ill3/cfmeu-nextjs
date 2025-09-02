'use client';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MobileMap = dynamic(() => import('@/components/map/MobileMap'), { ssr: false });
const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false });

export default function MapPage() {
  const isMobile = useIsMobile();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Patches Map</h1>
      <Card>
        <CardHeader>
          <CardTitle>Map View</CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <MobileMap />
          ) : (
            <div style={{ height: '70vh' }}>
              <InteractiveMap 
                showJobSites={true}
                showPatches={true}
                selectedPatchTypes={['geo']}
                mapMode="standard"
                showPatchNames={true}
                showOrganisers={true}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
