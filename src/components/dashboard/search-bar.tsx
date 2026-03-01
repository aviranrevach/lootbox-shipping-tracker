"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(local);
    }, 300);

    return () => clearTimeout(timer);
  }, [local, onChange]);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <Input
      placeholder="Search by item, order number, tracking, or retailer..."
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      className="max-w-lg"
    />
  );
}
