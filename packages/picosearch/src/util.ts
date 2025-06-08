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

export const getAutoFuzziness = (word: string): number => {
  const length = word.length;
  if (length < 3) return 0;
  if (length < 6) return 1;
  return 2;
};

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
