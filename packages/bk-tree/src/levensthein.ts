export const getEditDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // initialize the matrix with ascending values on the first row/column
  const matrix: number[][] = [
    Array.from({ length: a.length + 1 }, (_, i) => i),
    ...Array.from({ length: b.length }, (_, i) => [i + 1]),
  ];

  // use dynamic programming to fill out the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const distance = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + distance,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
      );
    }
  }

  return matrix[b.length][a.length];
};
