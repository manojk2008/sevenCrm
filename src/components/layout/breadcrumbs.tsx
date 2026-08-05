"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import React from "react";

export function Breadcrumbs() {
  const pathname = usePathname();
  
  if (!pathname || pathname === "/") return null;
  
  const segments = pathname.split("/").filter(Boolean);
  
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
      <Link
        href="/"
        className="flex h-8 items-center justify-center rounded-md px-2 hover:bg-muted hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        
        const title = segment
          .replace(/-/g, " ")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-4 w-4 mx-1 shrink-0 text-muted-foreground/50" />
            {isLast ? (
              <span className="px-2 font-medium text-foreground">{title}</span>
            ) : (
              <Link
                href={href}
                className="truncate max-w-[150px] rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
              >
                {title}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
