"use client";

import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";

export default function VehiclePhoto({ car, storedPhoto = null, className = "", priority = false }) {
  const [photos, setPhotos] = useState(storedPhoto ? [storedPhoto] : []);
  const [photoIndex, setPhotoIndex] = useState(0);
  const year = car?.year;
  const make = car?.make;
  const model = car?.model;
  const trim = car?.trim;
  const color = car?.color;
  const query = [year, make, model, trim, color].filter(Boolean).join("|");

  useEffect(() => {
    if (!year || !make || !model) return;
    const params = new URLSearchParams({ year, make, model });
    if (trim) params.set("trim", trim);
    if (color) params.set("color", color);
    fetch(`/api/photo?${params}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const candidates = [...new Set([...(data.photos || []), storedPhoto].filter(Boolean))];
        setPhotos(candidates);
        setPhotoIndex(0);
      })
      .catch(() => {});
  }, [query, storedPhoto, year, make, model, trim, color]);

  const photo = photos[photoIndex];
  if (!photo) {
    return (
      <div className={`vehicle-photo vehicle-photo-fallback ${className}`} role="img" aria-label={`${car.year} ${car.make} ${car.model} photo unavailable`}>
        <CarFront aria-hidden="true" />
        <span>{car.make} {car.model}</span>
      </div>
    );
  }

  return (
    <div className={`vehicle-photo ${className}`}>
      {/* Listing image hosts are dynamic; the ranked fallback set handles broken sources. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt={`Representative ${car.year} ${car.make} ${car.model}`} loading={priority ? "eager" : "lazy"} onError={() => setPhotoIndex((index) => index + 1)} referrerPolicy="no-referrer" />
      <span className="photo-provenance">Representative vehicle</span>
    </div>
  );
}
