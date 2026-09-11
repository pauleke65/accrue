"use client";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const statusLabel: Record<string, string> = {
  awaiting: "Awaiting acceptance",
  ready: "Ready to fund",
  active: "In progress",
  cancelled: "Cancelled",
  expired: "Expired",
  complete: "Complete",
  waiting: "Not submitted",
  submitted: "Ready for review",
  changes: "Changes requested",
  approved: "Verified",
};
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["submitted", "awaiting", "changes", "ready"].includes(value) ? "amber" : ""}`}
    >
      {statusLabel[value] ?? value}
    </span>
  );
}
export function Choice({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
