import { describe, expect, it } from "vitest";
import { tripServices } from "./trip-services";

describe("tripServices", () => {
  const on = { ENABLE_MAPS: "true", GOOGLE_MAPS_API_KEY: "maps", EIA_API_KEY: "eia" };

  it("connects Google Maps and EIA only when Maps is switched on and both keys are set", () => {
    expect(tripServices(on)).toMatchObject({
      findPlace: expect.any(Function),
      findPlaces: expect.any(Function),
      route: expect.any(Function),
      gasPrice: expect.any(Function),
    });
    expect(tripServices({ ...on, ENABLE_MAPS: "false" })).toBeNull();
    expect(tripServices({ ...on, ENABLE_MAPS: undefined })).toBeNull();
    expect(tripServices({ ...on, GOOGLE_MAPS_API_KEY: undefined })).toBeNull();
    expect(tripServices({ ...on, EIA_API_KEY: "" })).toBeNull();
  });
});
