"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import Image from "next/image";
import { ASSETS, ASSET_SLUGS, type AssetConfig } from "@/lib/assets";

const ASSET_LOGOS: Record<string, string> = {
  eth: "/eth.png",
  okb: "/okb.svg",
};

function AssetIcon({
  slug,
  size = 20,
}: {
  slug: string;
  size?: number;
}) {
  const logoSrc = ASSET_LOGOS[slug];
  if (logoSrc) {
    return (
      <Image
        src={logoSrc}
        alt={ASSETS[slug]?.symbol ?? slug}
        width={size}
        height={size}
        className="shrink-0 rounded-full"
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center
        text-white font-bold shrink-0 bg-[#888]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(ASSETS[slug]?.symbol ?? slug).charAt(0)}
    </div>
  );
}

export function AssetSelector({
  current,
}: {
  current: AssetConfig;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2.5 rounded-xl border
            border-[var(--border)] bg-[var(--surface)] px-4 py-2.5
            hover:border-[var(--accent)] transition-colors duration-200"
        >
          <AssetIcon slug={current.slug} />
          <span className="text-base font-semibold text-[var(--bone)]">
            {current.symbol}
          </span>
          <ChevronsUpDown className="size-4 text-[var(--text-secondary)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-0 border-[var(--border)]
          bg-[var(--bg)]"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search asset..."
            className="text-[var(--text)]"
          />
          <CommandList>
            <CommandEmpty className="text-[var(--text-secondary)]">
              No asset found.
            </CommandEmpty>
            <CommandGroup>
              {ASSET_SLUGS.map((slug) => {
                const asset = ASSETS[slug];
                const isActive = slug === current.slug;
                const disabled = asset.comingSoon === true;
                return (
                  <CommandItem
                    key={slug}
                    value={`${asset.symbol} ${asset.name}`}
                    disabled={disabled}
                    onSelect={() => {
                      if (disabled) return;
                      if (!isActive) {
                        router.push(`/earn/${slug}`);
                      }
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5
                      text-[var(--text)]
                      data-[selected=true]:bg-[var(--surface)]
                      data-[selected=true]:text-[var(--text)]
                      ${disabled ? "opacity-50 cursor-default" : "cursor-pointer"}`}
                  >
                    <AssetIcon slug={slug} size={18} />
                    <span className="font-medium">{asset.symbol}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {asset.name}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="text-[9px] font-medium text-cyan-400
                        bg-cyan-500/10 px-1 py-0.5 rounded">
                        X Layer
                      </span>
                      {disabled && (
                        <span className="text-[10px] font-medium
                          text-[var(--text-secondary)] border
                          border-[var(--border)] rounded px-1.5 py-0.5">
                          Soon
                        </span>
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { AssetIcon };
