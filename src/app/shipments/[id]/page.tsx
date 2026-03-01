"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shipment/status-badge";
import { ShipmentTimeline } from "@/components/shipment/shipment-timeline";
import { ShipmentForm } from "@/components/shipment/shipment-form";
import { STATUS_LABELS, STATUS_DOT_COLORS, STATUS_GROUPS, type ShipmentWithImages } from "@/types/shipment";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<ShipmentWithImages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailHtml, setEmailHtml] = useState<string | null>(null);
  const [emailImages, setEmailImages] = useState<string[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [savingImage, setSavingImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  async function fetchShipment() {
    try {
      const res = await fetch(`/api/shipments/${id}`);
      if (res.ok) {
        setShipment(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch shipment:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchShipment();
  }, [id]);

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/shipments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      fetchShipment();
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this shipment?")) return;

    const res = await fetch(`/api/shipments/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`/api/shipments/${id}/images`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      fetchShipment();
    }
  }

  async function handleViewEmail() {
    if (!shipment?.emailId) return;
    setShowEmail(true);
    setEmailLoading(true);
    setEmailImages([]);
    try {
      const res = await fetch(`/api/emails/${shipment.emailId}`);
      if (res.ok) {
        const data = await res.json();
        setEmailHtml(data.html || data.text || "No content available");
        if (data.images) setEmailImages(data.images);
      } else {
        setEmailHtml("<p>Failed to load email content.</p>");
      }
    } catch {
      setEmailHtml("<p>Failed to load email content.</p>");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePickImage(url: string) {
    setSavingImage(url);
    try {
      if (url.startsWith("data:image")) {
        // Convert data URI to blob and upload as file
        const res = await fetch(url);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append("image", blob, "picked-image.jpg");
        const uploadRes = await fetch(`/api/shipments/${id}/images`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) fetchShipment();
      } else {
        const res = await fetch(`/api/shipments/${id}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (res.ok) fetchShipment();
      }
    } catch (error) {
      console.error("Failed to save image:", error);
    } finally {
      setSavingImage(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Shipment not found</p>
        <Link href="/">
          <Button variant="link">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
      </div>

      {/* Status timeline */}
      <ShipmentTimeline
        currentStatus={shipment.status}
        purchaseDate={shipment.purchaseDate}
        actualDelivery={shipment.actualDelivery}
        onStatusChange={(s) => handleStatusChange(s)}
      />

      {/* Main layout: image left, items + details right */}
      <div className="grid gap-8 md:grid-cols-[2fr_3fr]">
        {/* Left: Image preview */}
        <div className="space-y-3">
          {shipment.images.length > 0 ? (
            <div className="relative aspect-square rounded-xl border bg-muted/30 overflow-hidden">
              <img
                src={`/api/images/${shipment.images[selectedImageIndex]?.filePath.replace(/^\.?\/?data\/images\//, "")}`}
                alt={shipment.itemName || ""}
                className="h-full w-full object-contain"
              />
              {shipment.images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((prev) =>
                        prev === 0 ? shipment.images.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 text-white p-1.5 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((prev) =>
                        prev === shipment.images.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 text-white p-1.5 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed bg-muted/50 text-muted-foreground text-sm">
              No images
            </div>
          )}
          <label className="block">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <span>Upload Image</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        </div>

        {/* Right: Item list + details */}
        <div className="space-y-6">
          {/* Title + meta */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-poppins">{shipment.itemName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {shipment.retailer && <span>{shipment.retailer}</span>}
              {shipment.orderNumber && (
                <>
                  <span>&middot;</span>
                  <span>Order #{shipment.orderNumber}</span>
                </>
              )}
              {shipment.purchaseDate && (
                <>
                  <span>&middot;</span>
                  <span>{format(new Date(shipment.purchaseDate), "MMM d, yyyy")}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <StatusBadge status={shipment.status} />
              <Select value={shipment.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Update status" />
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
              {shipment.emailId && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleViewEmail}>
                  View Email
                </Button>
              )}
            </div>
          </div>

          {/* Item list */}
          {shipment.images.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Items ({shipment.images.length})
                </p>
                <div className="divide-y rounded-lg border">
                  {shipment.images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImageIndex(index)}
                      onMouseEnter={() => setSelectedImageIndex(index)}
                      className={`flex items-center gap-4 w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                        index === selectedImageIndex ? "bg-muted/60" : ""
                      }`}
                    >
                      <img
                        src={`/api/images/${image.filePath.replace(/^\.?\/?data\/images\//, "")}`}
                        alt=""
                        className="h-16 w-16 rounded-lg object-cover bg-muted flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {shipment.itemName || "Item"}{shipment.images.length > 1 ? ` (${index + 1}/${shipment.images.length})` : ""}
                        </p>
                        {image.source && (
                          <p className="text-xs text-muted-foreground capitalize">{image.source}</p>
                        )}
                        {image.isPrimary && (
                          <span className="text-[10px] text-blue-600 font-medium">Primary</span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Shipping details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {shipment.carrier && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Carrier</p>
                <p className="text-sm">{shipment.carrier}</p>
              </div>
            )}
            {shipment.trackingNumber && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tracking</p>
                {shipment.trackingUrl ? (
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline font-mono"
                  >
                    {shipment.trackingNumber}
                  </a>
                ) : (
                  <p className="text-sm font-mono">{shipment.trackingNumber}</p>
                )}
              </div>
            )}
            {shipment.estimatedDelivery && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Estimated Delivery</p>
                <p className="text-sm">{format(new Date(shipment.estimatedDelivery), "MMM d, yyyy")}</p>
              </div>
            )}
            {shipment.actualDelivery && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Delivered</p>
                <p className="text-sm">{format(new Date(shipment.actualDelivery), "MMM d, yyyy")}</p>
              </div>
            )}
            {shipment.originCountry && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Origin</p>
                <p className="text-sm">{shipment.originCountry}{shipment.isInternational ? " (International)" : ""}</p>
              </div>
            )}
          </div>

          {shipment.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm">{shipment.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {shipment.productUrl && (
              <a
                href={shipment.productUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">Product Page</Button>
              </a>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      {showEdit && (
        <ShipmentForm
          open={showEdit}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            fetchShipment();
          }}
          initialData={
            shipment as unknown as Record<string, string | null>
          }
        />
      )}

      {/* Email Viewer Dialog */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {shipment.emailSubject || "Original Email"}
            </DialogTitle>
            {shipment.emailFrom && (
              <p className="text-sm text-muted-foreground">
                From: {shipment.emailFrom}
              </p>
            )}
          </DialogHeader>

          {/* Pick Image from Email */}
          {emailImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Pick a product image from this email:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {emailImages.map((url) => (
                  <button
                    key={url}
                    onClick={() => handlePickImage(url)}
                    disabled={savingImage === url}
                    className="relative flex-shrink-0 rounded-lg border-2 border-transparent hover:border-blue-500 transition-colors overflow-hidden disabled:opacity-50"
                  >
                    <img
                      src={url}
                      alt=""
                      className="h-[80px] w-[80px] object-contain bg-muted/30"
                      onError={(e) => {
                        // Hide broken images
                        const btn = (e.target as HTMLImageElement).closest("button");
                        if (btn) btn.style.display = "none";
                      }}
                      onLoad={(e) => {
                        // Hide tiny images (tracking pixels, spacers)
                        const img = e.target as HTMLImageElement;
                        if (img.naturalWidth < 30 || img.naturalHeight < 30) {
                          const btn = img.closest("button");
                          if (btn) btn.style.display = "none";
                        }
                      }}
                    />
                    {savingImage === url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs">
                        Saving...
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto rounded border bg-white min-h-0">
            {emailLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading email...
              </div>
            ) : emailHtml ? (
              <iframe
                srcDoc={emailHtml}
                className="w-full h-[60vh] border-0"
                sandbox="allow-same-origin"
                title="Email content"
              />
            ) : (
              <p className="p-4 text-muted-foreground">
                No email content available.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
