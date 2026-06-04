import Anthropic from "@anthropic-ai/sdk";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    isEnthusiast: { type: "boolean" },
    reason: { type: "string" },
    marketType: { type: "string", enum: ["mainstream", "enthusiast", "collector"] },
    privatePartyMultiplier: { type: "number" },
    recommendedPlatforms: { type: "array", items: { type: "string" } },
    enthusiastNotes: { type: "string" },
  },
  required: [
    "isEnthusiast",
    "reason",
    "marketType",
    "privatePartyMultiplier",
    "recommendedPlatforms",
    "enthusiastNotes",
  ],
  additionalProperties: false,
};

export async function classifyVehicle({ year, make, model, trim, body, engine, drive, fuel }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA,
      },
    },
    messages: [
      {
        role: "user",
        content: `Classify this vehicle for the used car market:

Year: ${year}
Make: ${make}
Model: ${model}
Trim: ${trim || "standard"}
Body: ${body || "unknown"}
Engine: ${engine ? engine + " cylinders" : "unknown"}
Drive: ${drive || "unknown"}
Fuel: ${fuel || "unknown"}

Determine whether this is an enthusiast or collector vehicle that commands a price premium above standard market comps.

Enthusiast examples: BMW M models, Mercedes-AMG, Lexus IS-F, Honda Type R/Civic Si, Subaru WRX STI, Ford Shelby GT350/GT500, Chevrolet Z06/ZR1/SS, Dodge Hellcat/Demon/Viper, Toyota GR86/GR Corolla/Supra, Nissan GT-R/370Z Nismo, Porsche GT3/GT4/Turbo S, Audi RS models, VW Golf R, Mitsubishi EVO, Mazda MX-5/RX-7/RX-8, Acura NSX/Integra Type R.

Collector examples: low-production classic performance cars, first-year models, last-year models of discontinued nameplates, special editions.

For privatePartyMultiplier: 1.0 = standard private party (~88% of retail). Enthusiast variants typically sell at 1.05–1.3x retail comps. Rare collectors can reach 1.5x+. Mainstream cars stay at 0.85–1.0x.

For recommendedPlatforms: pick the best venues for this specific car. Examples: "Bring a Trailer", "Cars & Bids", "Facebook Marketplace", "AutoTrader", "owner forums", "PNW Cars", "Hemmings".`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return null;
  return JSON.parse(text);
}
