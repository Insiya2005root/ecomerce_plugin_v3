"use client";

import * as React from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ActionItem = {
  label: string;
  icon?: IconSvgElement;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function ActionMenu({ groups, label = "Actions" }: { groups: ActionItem[][]; label?: string }) {
  const visible = groups.filter((g) => g.length > 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-md text-muted-foreground"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44 rounded-lg">
        {visible.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {group.map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  className="rounded-md text-[13px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onSelect();
                  }}
                >
                  {item.icon && <HugeiconsIcon icon={item.icon} strokeWidth={2} className="text-muted-foreground" />}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
