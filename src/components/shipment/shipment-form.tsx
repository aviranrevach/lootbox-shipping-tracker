"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, STATUS_DOT_COLORS, STATUS_GROUPS } from "@/types/shipment";
import { cn } from "@/lib/utils";

interface ShipmentFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Record<string, string | null>;
}

export function ShipmentForm({
  open,
  onClose,
  onSuccess,
  initialData,
}: ShipmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};

    formData.forEach((value, key) => {
      if (typeof value === "string" && value.trim()) {
        data[key] = value.trim();
      }
    });

    try {
      const url = initialData?.id
        ? `/api/shipments/${initialData.id}`
        : "/api/shipments";
      const method = initialData?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save");
      }
    } catch {
      alert("Failed to save shipment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Edit Shipment" : "Add Shipment"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Item Name *</label>
            <Input
              name="itemName"
              required
              defaultValue={initialData?.itemName || ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Retailer</label>
              <Input
                name="retailer"
                defaultValue={initialData?.retailer || ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Order Number</label>
              <Input
                name="orderNumber"
                defaultValue={initialData?.orderNumber || ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Tracking Number</label>
              <Input
                name="trackingNumber"
                defaultValue={initialData?.trackingNumber || ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Carrier</label>
              <Input
                name="carrier"
                placeholder="e.g. USPS, UPS, Israel Post"
                defaultValue={initialData?.carrier || ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Purchase Date</label>
              <Input
                name="purchaseDate"
                type="date"
                defaultValue={initialData?.purchaseDate || ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Est. Delivery</label>
              <Input
                name="estimatedDelivery"
                type="date"
                defaultValue={initialData?.estimatedDelivery || ""}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <Select
              name="status"
              defaultValue={initialData?.status || "ordered"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_GROUPS.map((group, i) => (
                  <SelectGroup key={group.label}>
                    {i > 0 && <SelectSeparator />}
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className={cn("inline-block size-2 rounded-full shrink-0", STATUS_DOT_COLORS[s])} />
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Input name="notes" defaultValue={initialData?.notes || ""} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
