export const getJsonKeyReplacer =
  (keyMapping: Record<string, string>) =>
  (key: string, value: any): any => {
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [keyMapping?.[k] ?? k, v]),
      );
    }

    return value;
  };

export const getJsonKeyReviver = (keyMapping: Record<string, string>) => {
  const invertedMapping = Object.fromEntries(
    Object.entries(keyMapping).map(([k, v]) => [v, k]),
  );
  return (key: string, value: any): any => {
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [invertedMapping?.[k] ?? k, v]),
      );
    }

    return value;
  };
};

export const parseFieldNameAndWeight = (
  fieldNameWithOptionalWeight: string,
): [fieldName: string, weight: number] => {
  const weightLoc = fieldNameWithOptionalWeight.search(/\^[0-9]*\.?[0-9]+$/);
  if (weightLoc !== -1) {
    const weight = Number.parseFloat(
      fieldNameWithOptionalWeight.slice(weightLoc + 1),
    );
    return [fieldNameWithOptionalWeight.slice(0, weightLoc), weight];
  }
  return [fieldNameWithOptionalWeight, 1];
};
