export interface ForecastRecord {
  periodId: string;
  expectedEopBalance: number;
  actualEopBalance: number;
  recordedAt: Date;
}

export function analyzeForecastAccuracy(record: ForecastRecord) {
  const error = record.actualEopBalance - record.expectedEopBalance;
  
  const threshold = record.expectedEopBalance > 0 ? record.expectedEopBalance * 0.05 : 100;
  
  let possibleCauses: string[] = [];
  if (error < -threshold) {
    possibleCauses = [
      'Higher variable spending than expected',
      'Unexpected bills or commitments',
      'One-time large purchase'
    ];
  } else if (error > threshold) {
    possibleCauses = [
      'Income arrived earlier than expected',
      'Under-budget on variable spending',
      'Cancelled subscription or commitment'
    ];
  }

  const accuracyPercent = record.expectedEopBalance > 0 
      ? Math.max(0, 100 - Math.abs(error / record.expectedEopBalance) * 100)
      : (record.actualEopBalance === record.expectedEopBalance ? 100 : 0);

  return {
    periodId: record.periodId,
    error,
    accuracyPercent,
    possibleCauses,
    message: error < 0 
      ? `Forecast over-estimated by ${Math.abs(error).toFixed(2)}.` 
      : (error > 0 ? `Forecast under-estimated by ${error.toFixed(2)}.` : 'Forecast was spot on.')
  };
}
