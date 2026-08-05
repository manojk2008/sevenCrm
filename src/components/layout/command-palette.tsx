"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Building2,
  CalendarClock,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LineChart,
  Package,
  PlusCircle,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, close, toggle } = useCommandPaletteStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  const runCommand = (command: () => void) => {
    close();
    command();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => router.push("/clients/new"))}>
            <PlusCircle className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>New Client</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/enquiries/new"))}>
            <PlusCircle className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>New Enquiry</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/quotations/new"))}>
            <PlusCircle className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>New Quotation</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/follow-ups/new"))}>
            <PlusCircle className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>New Follow-up</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/clients"))}>
            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Clients</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/products"))}>
            <Package className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Products</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/enquiries"))}>
            <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Enquiries</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/follow-ups"))}>
            <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Follow-ups</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/quotations"))}>
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Quotations</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/sales"))}>
            <IndianRupee className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Sales</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Intelligence">
          <CommandItem onSelect={() => runCommand(() => router.push("/reports"))}>
            <LineChart className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Reports</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/analytics"))}>
            <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Analytics</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => router.push("/users"))}>
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Users</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
