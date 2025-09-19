"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import QRCode from "react-qr-code"

const JOIN_URL = "https://nsw.cfmeu.org/members/member-sign-up/"

type JoinQrDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JoinQrDialog({ open, onOpenChange }: JoinQrDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join the CFMEU</DialogTitle>
          <DialogDescription>
            Scan the QR code or open the link below to start a membership application.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <QRCode
              value={JOIN_URL}
              size={200}
              style={{ height: "auto", width: "200px" }}
              viewBox="0 0 256 256"
            />
          </div>
          <p className="break-all text-center text-sm text-muted-foreground">{JOIN_URL}</p>
          <Button asChild className="w-full">
            <a href={JOIN_URL} target="_blank" rel="noopener noreferrer">
              Open join form
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
