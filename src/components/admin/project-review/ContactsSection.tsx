'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { User, Mail, Phone, Edit, Trash } from 'lucide-react';
import type { SiteContactDetails } from '@/types/pendingProjectReview';

interface ContactsSectionProps {
  contacts: SiteContactDetails[];
  onEdit?: (contact: SiteContactDetails) => void;
  onDelete?: (contactId: string) => void;
  onAdd?: () => void;
  readOnly?: boolean;
}

export function ContactsSection({
  contacts,
  onEdit,
  onDelete,
  onAdd,
  readOnly = false,
}: ContactsSectionProps) {
  if (!contacts || contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Project Contacts</CardTitle>
            {!readOnly && onAdd && (
              <Button variant="outline" size="sm" onClick={onAdd}>
                Add Contact
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No contacts have been added to this project
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">
              Project Contacts ({contacts.length})
            </CardTitle>
          </div>
          {!readOnly && onAdd && (
            <Button variant="outline" size="sm" onClick={onAdd}>
              Add Contact
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contact Info</TableHead>
              {!readOnly && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <span className="font-medium">{contact.name}</span>
                </TableCell>
                <TableCell>
                  {contact.role ? (
                    <Badge variant="outline">{contact.role}</Badge>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    {contact.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <a
                          href={`tel:${contact.phone}`}
                          className="hover:text-primary hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:text-primary hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {!contact.phone && !contact.email && (
                      <span className="text-muted-foreground">No contact info</span>
                    )}
                  </div>
                </TableCell>
                {!readOnly && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(contact)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(contact.id)}
                        >
                          <Trash className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
