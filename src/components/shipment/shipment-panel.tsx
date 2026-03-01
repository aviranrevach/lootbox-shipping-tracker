"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ShipmentTimeline } from "@/components/shipment/shipment-timeline";
import { ShipmentForm } from "@/components/shipment/shipment-form";
import { STATUS_LABELS, STATUS_DOT_COLORS, STATUS_GROUPS, type ShipmentWithImages } from "@/types/shipment";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Ellipsis, ExternalLink, MailOpen, Pencil, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_COLORS } from "@/types/shipment";
import { cn } from "@/lib/utils";

interface RelatedEmail {
  gmailMessageId: string;
  subject: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  parserUsed: string | null;
}

interface ShipmentPanelProps {
  shipmentId: number | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function ShipmentPanel({ shipmentId, onClose, onDeleted }: ShipmentPanelProps) {
  const [shipment, setShipment] = useState<ShipmentWithImages | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmailView, setShowEmailView] = useState(false);
  const [selectedEmailIndex, setSelectedEmailIndex] = useState(0);
  const [emailHtml, setEmailHtml] = useState<string | null>(null);
  const [emailImages, setEmailImages] = useState<string[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [savingImage, setSavingImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedEmails, setRelatedEmails] = useState<RelatedEmail[]>([]);

  const fetchShipment = useCallback(async () => {
    if (!shipmentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`);
      if (res.ok) {
        setShipment(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch shipment:", error);
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId]);

  const fetchEmails = useCallback(async () => {
    if (!shipmentId) return;
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/emails`);
      if (res.ok) setRelatedEmails(await res.json());
    } catch {
      setRelatedEmails([]);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (shipmentId) {
      setSelectedImageIndex(0);
      setShipment(null);
      setRelatedEmails([]);
      setShowEmailView(false);
      setEmailHtml(null);
      fetchShipment();
      fetchEmails();
    }
  }, [shipmentId, fetchShipment, fetchEmails]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && shipmentId) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shipmentId, onClose]);

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/shipments/${shipmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchShipment();
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this shipment?")) return;
    const res = await fetch(`/api/shipments/${shipmentId}`, { method: "DELETE" });
    if (res.ok) {
      onClose();
      onDeleted?.();
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/shipments/${shipmentId}/images`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) fetchShipment();
  }

  function openEmailView() {
    if (relatedEmails.length === 0 && !shipment?.emailId) return;
    setShowEmailView(true);
    setSelectedEmailIndex(0);
    // Load the first email
    const firstId = relatedEmails[0]?.gmailMessageId || shipment?.emailId;
    if (firstId) loadEmailContent(firstId);
  }

  async function loadEmailContent(messageId: string) {
    setEmailLoading(true);
    setEmailHtml(null);
    setEmailImages([]);
    try {
      const res = await fetch(`/api/emails/${messageId}`);
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

  function selectEmail(index: number) {
    setSelectedEmailIndex(index);
    const email = relatedEmails[index];
    if (email) loadEmailContent(email.gmailMessageId);
  }

  async function handlePickImage(url: string) {
    setSavingImage(url);
    try {
      if (url.startsWith("data:image")) {
        const res = await fetch(url);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append("image", blob, "picked-image.jpg");
        const uploadRes = await fetch(`/api/shipments/${shipmentId}/images`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) fetchShipment();
      } else {
        const res = await fetch(`/api/shipments/${shipmentId}/images`, {
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

  const isOpen = shipmentId !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-background shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel header */}
        <div className="border-b px-6 py-4 shrink-0 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="text-lg font-semibold font-poppins truncate">
                {shipment?.itemName || "Shipment Details"}
              </h2>
              {shipment && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:brightness-90 shrink-0", STATUS_COLORS[shipment.status])}>
                      {STATUS_LABELS[shipment.status]}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {STATUS_GROUPS.map((group, gi) => (
                      <DropdownMenuGroup key={group.label}>
                        {gi > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                        {group.statuses.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className={cn("gap-2", s === shipment.status && "font-semibold")}
                          >
                            <span className={cn("inline-block size-2 rounded-full shrink-0", STATUS_DOT_COLORS[s])} />
                            {STATUS_LABELS[s]}
                            {s === shipment.status && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center shrink-0">
              {(relatedEmails.length > 0 || shipment?.emailId) ? (
                <button
                  onClick={() => showEmailView ? setShowEmailView(false) : openEmailView()}
                  className={cn(
                    "relative rounded-md p-2 transition-colors",
                    showEmailView
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={relatedEmails.length > 1 ? `${relatedEmails.length} emails` : "View Email"}
                >
                  <MailOpen className="h-4 w-4" />
                  {relatedEmails.length > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {relatedEmails.length}
                    </span>
                  )}
                </button>
              ) : (
                <span className="rounded-md p-2 text-muted-foreground/30">
                  <MailOpen className="h-4 w-4" />
                </span>
              )}
              {shipment && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="More"
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowEdit(true)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={onClose}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {shipment && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {shipment.retailer && <span>{shipment.retailer}</span>}
              {shipment.carrier && shipment.carrier !== shipment.retailer && (
                <>
                  <span>&middot;</span>
                  <span>via {shipment.carrier}</span>
                </>
              )}
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
              {shipment.accountEmail && (
                <>
                  <span>&middot;</span>
                  <span>{shipment.accountEmail.split("@")[0]}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showEmailView && shipment ? (
            /* ── Email browsing view ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Email view header */}
              <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30 shrink-0">
                <button
                  onClick={() => setShowEmailView(false)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Back to shipment"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="text-sm font-medium">
                  Related Emails ({relatedEmails.length || 1})
                </h3>
              </div>

              {/* Email split view */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden">
                {/* Left: Email list */}
                <div className="border-r md:border-r border-b md:border-b-0 overflow-y-auto max-h-48 md:max-h-none">
                  {relatedEmails.length > 0 ? (
                    <div className="divide-y">
                      {relatedEmails.map((email, index) => (
                        <div
                          key={email.gmailMessageId}
                          onClick={() => selectEmail(index)}
                          className={cn(
                            "px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40",
                            index === selectedEmailIndex && "bg-muted/60"
                          )}
                        >
                          <p className="text-sm font-medium truncate">
                            {email.subject || "No subject"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {email.fromAddress || "Unknown sender"}
                          </p>
                          {email.receivedAt && (
                            <p className="text-[11px] text-muted-foreground/70 mt-1">
                              {format(new Date(email.receivedAt), "MMM d, yyyy · h:mm a")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : shipment.emailId ? (
                    <div className="px-4 py-3 bg-muted/60">
                      <p className="text-sm font-medium truncate">
                        {shipment.emailSubject || "Original Email"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {shipment.emailFrom || "Unknown sender"}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      No emails found
                    </div>
                  )}

                  {/* Image picker from email */}
                  {emailImages.length > 0 && (
                    <div className="border-t p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pick Image
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {emailImages.map((url) => (
                          <button
                            key={url}
                            onClick={() => handlePickImage(url)}
                            disabled={savingImage === url}
                            className="relative rounded-md border-2 border-transparent hover:border-blue-500 transition-colors overflow-hidden disabled:opacity-50 aspect-square"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-contain bg-muted/30"
                              onError={(e) => {
                                const btn = (e.target as HTMLImageElement).closest("button");
                                if (btn) btn.style.display = "none";
                              }}
                              onLoad={(e) => {
                                const img = e.target as HTMLImageElement;
                                if (img.naturalWidth < 30 || img.naturalHeight < 30) {
                                  const btn = img.closest("button");
                                  if (btn) btn.style.display = "none";
                                }
                              }}
                            />
                            {savingImage === url && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-[10px]">
                                Saving...
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Email content */}
                <div className="overflow-hidden flex flex-col">
                  {emailLoading ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      Loading email...
                    </div>
                  ) : emailHtml ? (
                    <iframe
                      srcDoc={`<style>body{margin:0!important;padding:16px!important;box-sizing:border-box!important;overflow-x:hidden!important;}table{max-width:100%!important;}img{max-width:100%!important;height:auto!important;}</style>${emailHtml}`}
                      className="flex-1 w-full border-0 bg-white"
                      sandbox="allow-same-origin"
                      title="Email content"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                      Select an email to view
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── Shipment content view ── */
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                  <div className="grid gap-8 grid-cols-1 md:grid-cols-[2fr_3fr]">
                    <Skeleton className="aspect-square rounded-xl" />
                    <div className="space-y-4">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-8 w-40" />
                    </div>
                  </div>
                </div>
              ) : !shipment ? (
                <div className="text-center py-12 text-muted-foreground">
                  Shipment not found
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Status timeline */}
                  <ShipmentTimeline
                    currentStatus={shipment.status}
                    purchaseDate={shipment.purchaseDate}
                    actualDelivery={shipment.actualDelivery}
                    onStatusChange={(s) => handleStatusChange(s)}
                  />

                  {/* Main layout: items left, image right */}
                  <div className="grid gap-8 grid-cols-1 md:grid-cols-[3fr_2fr]">
                    {/* Left: Item list + details */}
                    <div className="space-y-6">
                      {/* Item list */}
                      {shipment.images.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                            Items ({shipment.images.length})
                          </p>
                          <div className="divide-y rounded-lg border">
                            {shipment.images.map((image, index) => {
                              const itemUrl = shipment.productUrl;
                              return (
                                <div
                                  key={image.id}
                                  onClick={() => setSelectedImageIndex(index)}
                                  onMouseEnter={() => setSelectedImageIndex(index)}
                                  className={cn(
                                    "flex items-center gap-4 w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 cursor-pointer",
                                    index === selectedImageIndex && "bg-muted/60"
                                  )}
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
                                  {itemUrl ? (
                                    <a
                                      href={itemUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground flex-shrink-0"
                                      title="Open item page"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  ) : (
                                    <ExternalLink className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

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
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-sm">{shipment.notes}</p>
                        </div>
                      )}

                      {shipment.productUrl && (
                        <div>
                          <a href={shipment.productUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">Product Page</Button>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Right: Image preview */}
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
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showEdit && shipment && (
          <ShipmentForm
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false);
              fetchShipment();
            }}
            initialData={shipment as unknown as Record<string, string | null>}
          />
        )}
      </div>
    </>
  );
}
