export const PROJECT_TYPE_VALUES = ["government", "private", "mixed"] as const;

export type ProjectTypeValue = (typeof PROJECT_TYPE_VALUES)[number];

const PROJECT_TYPE_LABELS: Record<ProjectTypeValue, string> = {
  government: "Government",
  private: "Private",
  mixed: "Mixed"
};

const PROJECT_TYPE_DESCRIPTIONS: Record<ProjectTypeValue, string> = {
  government: "Primarily government funded or managed projects",
  private: "Privately funded or managed projects",
  mixed: "Public/private or joint venture projects"
};

const NORMALIZED_ALIASES: Record<string, ProjectTypeValue> = {
  government: "government",
  gov: "government",
  govt: "government",
  gov_funded: "government",
  government_funded: "government",
  public: "government",
  public_sector: "government",
  state: "government",
  state_funded: "government",
  federal: "government",
  federal_funded: "government",
  private: "private",
  private_sector: "private",
  corporate: "private",
  commercial: "private",
  developer: "private",
  mixed: "mixed",
  hybrid: "mixed",
  joint: "mixed",
  joint_venture: "mixed",
  public_private: "mixed",
  public_private_partnership: "mixed",
  ppp: "mixed",
  alliance: "mixed",
  partnership: "mixed"
};

function sanitizeProjectType(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_/, "")
    .replace(/_$/, "");
}

export function normalizeProjectType(value: unknown): ProjectTypeValue | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const sanitized = sanitizeProjectType(raw);

  if (NORMALIZED_ALIASES[sanitized]) {
    return NORMALIZED_ALIASES[sanitized];
  }

  return PROJECT_TYPE_VALUES.find((type) => type === sanitized) ?? null;
}

export function isProjectTypeValue(value: unknown): value is ProjectTypeValue {
  return typeof value === "string" && PROJECT_TYPE_VALUES.includes(value as ProjectTypeValue);
}

export function formatProjectTypeLabel(value: string | null | undefined): string {
  if (!value) {
    return "Not specified";
  }
  const normalized = normalizeProjectType(value);
  if (!normalized) {
    return value;
  }
  return PROJECT_TYPE_LABELS[normalized];
}

export function getProjectTypeDescription(value: string | null | undefined): string | null {
  const normalized = normalizeProjectType(value);
  return normalized ? PROJECT_TYPE_DESCRIPTIONS[normalized] : null;
}

export interface ProjectTypeOption {
  value: ProjectTypeValue;
  label: string;
  description: string;
}

export const PROJECT_TYPE_OPTIONS: ProjectTypeOption[] = PROJECT_TYPE_VALUES.map((value) => ({
  value,
  label: PROJECT_TYPE_LABELS[value],
  description: PROJECT_TYPE_DESCRIPTIONS[value]
}));
