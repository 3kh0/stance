export const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

export const titleCase = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .map(capitalize)
    .join(" ");
