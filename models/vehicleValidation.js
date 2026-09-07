export function cleanVehicleQuery(searchParams) {
  const text = (name, max = 60) => (searchParams.get(name) || "").trim().slice(0, max);
  const year = Number(text("year", 4));
  const mileage = Number(text("mileage", 8));
  const zip = text("zip", 10);
  if (!Number.isInteger(year) || year < 1981 || year > new Date().getFullYear() + 1) throw new Error("Enter a valid model year.");
  if (!Number.isFinite(mileage) || mileage < 0 || mileage > 1_500_000) throw new Error("Enter valid mileage.");
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip)) throw new Error("Enter a valid US ZIP code.");
  const make = text("make");
  const model = text("model");
  if (!make || !model) throw new Error("Year, make, and model are required.");
  return { year: String(year), mileage, zip: zip || "94538", make, model };
}
