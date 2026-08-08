"use client";

import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";

export default function VehiclePhoto({ car, storedPhoto = null, className = "", priority = false }) {
  const [photo, setPhoto] = useState(storedPhoto);
  const [failed, setFailed] = useState(false);
  const query = [car?.year, car?.make, car?.model, car?.trim, car?.color].filter(Boolean).join("|");

  useEffect(() => {
    if (storedPhoto) return;
    const params = new URLSearchParams({ year: car.year, make: car.make, model: car.model });
    if (car.trim) params.set("trim", car.trim);
    if (car.color) params.set("color", car.color);
    fetch(`/api/photo?${params}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => data.photo && setPhoto(data.photo))
      .catch(() => setFailed(true));
  }, [query, storedPhoto]);

  if (!photo || failed) {
    return (
      <div className={`vehicle-photo vehicle-photo-fallback ${className}`} role="img" aria-label={`${car.year} ${car.make} ${car.model} photo unavailable`}>
        <CarFront aria-hidden="true" />
        <span>{car.make} {car.model}</span>
      </div>
    );
  }

  return (
    <div className={`vehicle-photo ${className}`}>
      <img src={photo} alt={`${car.year} ${car.make} ${car.model}`} loading={priority ? "eager" : "lazy"} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      <span className="photo-provenance">Representative listing photo</span>
    </div>
  );
}
