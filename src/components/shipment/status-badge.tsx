import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS, type ShipmentStatus } from "@/types/shipment";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ShipmentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_COLORS[status], "text-xs font-medium", className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
