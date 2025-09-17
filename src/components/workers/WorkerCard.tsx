"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Phone, MessageSquare, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export type WorkerCardData = {
  id: string;
  first_name: string | null;
  surname: string | null;
  member_number: string | null;
  union_membership_status: string | null;
  mobile_phone: string | null;
  email: string | null;
};

export function WorkerCard({ worker, onClick }: { worker: WorkerCardData, onClick: () => void }) {
  const fullName = [worker.first_name, worker.surname].filter(Boolean).join(' ') || "Unnamed Worker"

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{fullName}</CardTitle>
            {worker.member_number && (
              <p className="text-sm text-muted-foreground">Member #: {worker.member_number}</p>
            )}
          </div>
          <User className="h-5 w-5 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {worker.union_membership_status && (
            <Badge 
              variant={worker.union_membership_status === 'member' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {worker.union_membership_status.replace(/_/g, ' ')}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            {worker.mobile_phone && (
              <>
                <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                  <a href={`tel:${worker.mobile_phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                  <a href={`sms:${worker.mobile_phone}`}>
                    <MessageSquare className="h-4 w-4" />
                  </a>
                </Button>
              </>
            )}
            {worker.email && (
              <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                <a href={`mailto:${worker.email}`}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

