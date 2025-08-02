// calculation of accumulated platform results

function createLeftPaddedMatrix(rows: number[][]): number[][] {
  const columnCount = rows[0].length - 1;

  const leftPaddedMatrix: number[][] = rows.map((row, shift) => {
    const padded = Array(columnCount).fill(0);

    for (let index = 0; index < row.length; index++) {
      padded[shift + index] = row[index];
    }
    console.log(`row+${shift}`, padded);
    return padded;
  });

  return leftPaddedMatrix;
}

function calculateColumnSums(leftPaddedMatrix: number[][]): number[] {
  const columnCount = leftPaddedMatrix[0].length;
  const columnSums: number[] = Array.from({ length: columnCount }, (_, col) =>
    leftPaddedMatrix.reduce((sum, row) => sum + row[col], 0)
  );

  return columnSums;
}

function calculateAccumulatedResults(
  rows: number[][],
  stepFactor: number,
  initialValue: number
): number {
  const leftPaddedMatrix = createLeftPaddedMatrix(rows); // number[] x number[]
  const columnSums = calculateColumnSums(leftPaddedMatrix); // number[]

  return columnSums.reduce((acc, currentColumnValue) => {
    const next = acc * stepFactor + currentColumnValue;
    return next;
  }, initialValue);
}

export function calculateAccumulatedResultsWithMultiplication(
  rowsWithMultipliers: { multiplier: number; values: number[] }[],
  stepFactor: number,
  initialValue: number
): number {
  const multipliedRows = rowsWithMultipliers.map(row =>
    row.values.map(value => value * row.multiplier)
  );

  return calculateAccumulatedResults(multipliedRows, stepFactor, initialValue);
}
