"use client";

import { useState, useEffect, useCallback } from "react";
import type { ShipmentWithImages, ShipmentStatus } from "@/types/shipment";

interface UseShipmentsOptions {
  status?: ShipmentStatus;
  statuses?: ShipmentStatus[];
  search?: string;
  accountEmail?: string;
}

interface ShipmentsResponse {
  shipments: ShipmentWithImages[];
  total: number;
  statusCounts: Record<string, number>;
}

export function useShipments(options: UseShipmentsOptions = {}) {
  const [data, setData] = useState<ShipmentsResponse>({
    shipments: [],
    total: 0,
    statusCounts: {},
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.statuses?.length) params.set("statuses", options.statuses.join(","));
      if (options.search) params.set("search", options.search);
      if (options.accountEmail) params.set("accountEmail", options.accountEmail);

      const res = await fetch(`/api/shipments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch shipments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [options.status, options.statuses?.join(","), options.search, options.accountEmail]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Auto-refresh when sync completes
  useEffect(() => {
    const handler = () => fetchShipments();
    window.addEventListener("shipments-updated", handler);
    return () => window.removeEventListener("shipments-updated", handler);
  }, [fetchShipments]);

  return { ...data, isLoading, refetch: fetchShipments };
}
