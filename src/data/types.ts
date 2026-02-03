export type VelocityCategory = "swift" | "medium" | "slow";
export type ParentObjectType = "asteroid" | "comet";
export type HemispherePreference = "northern" | "southern" | "both";

export type MeteorShower = {
  id: string;
  code: string;
  name: string;
  activePeriod: {
    start: string;
    end: string;
  };
  peak: {
    month: number;
    dayOfMonth: number;
  };
  zhr: number;
  velocity: {
    kmPerSec: number;
    category: VelocityCategory;
  };
  radiant: {
    ra: string;
    dec: string;
    constellation: string;
  };
  parentObject: {
    name: string;
    type: ParentObjectType;
  };
  moonPhase2026: {
    percentIlluminated: number;
    phaseName: string;
  };
  hemisphere: {
    preference: HemispherePreference;
    note: string;
  };
  description: string;
  image: string;
};
