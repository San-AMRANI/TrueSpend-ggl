# Financial Calculation Contract

## 1. Total Liquidity
**Definition**: The total currently available liquid funds.
**Calculation**: 
`Bank Balance + Cash On Hand`
*Note*: This represents the actual money available before any obligations are deducted.

## 2. Safe to Spend
**Definition**: The true amount of money available for discretionary spending without jeopardizing financial stability or obligations.
**Calculation**:
`Total Liquidity - Emergency Buffer - Pending Payables`
*Future Additions*: `- Upcoming Recurring Expenses - Required Goal Contributions + Expected Near-Term Income`

## 3. Runway
**Definition**: The number of days the user can sustain their current spending habits using their Safe to Spend amount.
**Calculation**:
`Safe to Spend / Average Daily Spend`
where `Average Daily Spend = Monthly Expenses / Elapsed Days in current financial period`.

## 4. End-of-Period Forecast
**Definition**: The projected end-of-period liquidity based on current spending pace.
**Calculation**:
- **Expected**: `Total Liquidity - (Average Daily Spend * Days Remaining)`
- **Best**: `Total Liquidity - (Average Daily Spend * 0.8 * Days Remaining)`
- **Worst**: `Total Liquidity - (Average Daily Spend * 1.3 * Days Remaining)`

## 5. Financial Health Score
**Definition**: A composite score (0-100) reflecting overall financial stability.
**Factors**:
- **Savings (20 pts)**: Rate of saving. `((Monthly Income - Monthly Expenses) / Monthly Income) * 100`.
- **Emergency Buffer (20 pts)**: `Total Liquidity / (Emergency Buffer * 2)`. Max 20.
- **Debt Load (15 pts)**: `Pending Payables / Monthly Income`. Lower ratio = higher score.
- **Budget Control (15 pts)**: Adherence to total budget. `Spending Pace Percent` vs ideal pace.
- **Runway (15 pts)**: `Runway Days / Days Until Payday`.
- **Daily Discipline (15 pts)**: `Daily Usage Percent`. Below 100% is good.
