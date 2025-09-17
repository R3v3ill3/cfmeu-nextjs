"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building, Phone, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export type EmployerCardData = {
  id: string;
  name: string;
  abn: string | null;
  employer_type: string | null;
  phone: string | null;
  email: string | null;
  ebaCategory: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
};

export function EmployerCard({ employer, onClick }: { employer: EmployerCardData, onClick: () => void }) {
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{employer.name}</CardTitle>
            {employer.abn && (
              <p className="text-sm text-muted-foreground">ABN: {employer.abn}</p>
            )}
          </div>
          <Building className="h-5 w-5 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={employer.ebaCategory.variant}>{employer.ebaCategory.label}</Badge>
            {employer.employer_type && (
              <Badge variant="secondary" className="capitalize">{employer.employer_type.replace(/_/g, ' ')}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {employer.phone && (
              <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                <a href={`tel:${employer.phone}`}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            )}
            {employer.email && (
              <Button asChild variant="outline" size="icon" onClick={handleActionClick}>
                <a href={`mailto:${employer.email}`}>
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