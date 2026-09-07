const VIN_FIELDS = {
  Make: 26, Model: 28, ModelYear: 29, Trim: 38, BodyClass: 5,
  EngineCylinders: 9, DriveType: 15, FuelTypePrimary: 24, TransmissionStyle: 37,
};

export async function decodeVin(vin) {
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`, {
    next: { revalidate: 86400 * 30 },
  });
  if (!response.ok) throw new Error("VIN_SERVICE_UNAVAILABLE");
  const results = (await response.json()).Results || [];
  const vehicle = { VIN: vin };
  for (const [name, id] of Object.entries(VIN_FIELDS)) {
    vehicle[name] = results.find((item) => item.VariableId === id)?.Value || "";
  }
  return vehicle;
}
