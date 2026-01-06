// components/CatalogueCard.tsx
"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

type Format = {
  id: string | number;
  title: string;
  description?: string | null;
  image_url?: string | null;
};

const PLACEHOLDER = "/placeholder-catalogue.jpg";

function normalizeImageUrl(src?: string | null) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (src.startsWith("/")) return `${base}${src}`;
  return `${base}/${src.replace(/^\/+/, "")}`;
}

export default function CatalogueCard({ format }: { format: Format }) {
  const initialUrl = useMemo(
    () => normalizeImageUrl(format.image_url) ?? PLACEHOLDER,
    [format.image_url]
  );
  const [src, setSrc] = useState<string>(initialUrl);

  return (
    <div className="border rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition">
      {src ? (
        <img
          src={src}
          alt={format.title}
          className="w-full h-48 object-cover"
          onError={() => setSrc(PLACEHOLDER)}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
          Pas d’image
        </div>
      )}

      <div className="p-6 space-y-2">
        <h3 className="font-semibold">{format.title}</h3>
        {format.description ? (
          <p className="text-sm opacity-80">{format.description}</p>
        ) : null}
        <Link
          href={`/request/new?format=${format.id}`}
          className="btn btn-primary mt-2 inline-block"
        >
          Demander
        </Link>
      </div>
    </div>
  );
}
