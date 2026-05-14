function getNextBusinessDay_(date) {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);

  while (isWeekend_(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}