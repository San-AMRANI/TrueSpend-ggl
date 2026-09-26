/**
 * Safe, robust mathematical expression evaluator for TrueSpend Calculator.
 * Supports +, -, *, /, %, unary minus, parentheses, and floating point.
 * Avoids unsafe eval().
 */

export function sanitizeExpression(expr: string): string {
  // Replace visual multiplication and division symbols
  return expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '');
}

export function evaluateExpression(expr: string): { success: boolean; result: number; error?: string } {
  try {
    const sanitized = sanitizeExpression(expr).trim();
    if (!sanitized) {
      return { success: true, result: 0 };
    }

    // Tokenize
    const tokens = tokenize(sanitized);
    if (tokens.length === 0) {
      return { success: true, result: 0 };
    }

    // Parse & evaluate using Shunting-yard / RPN
    const rpn = infixToRPN(tokens);
    const result = evaluateRPN(rpn);

    if (isNaN(result) || !isFinite(result)) {
      return { success: false, result: 0, error: 'Invalid calculation (division by zero)' };
    }

    // Round small floating-point imprecisions (e.g. 0.1 + 0.2 = 0.3)
    const rounded = Math.round(result * 1e8) / 1e8;
    return { success: true, result: rounded };
  } catch (err: any) {
    return { success: false, result: 0, error: err?.message || 'Syntax Error' };
  }
}

type TokenType = 'NUMBER' | 'OPERATOR' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Check for number
    if (/\d/.test(ch) || (ch === '.' && i + 1 < input.length && /\d/.test(input[i + 1]))) {
      let numStr = '';
      let hasDot = false;
      while (i < input.length && (/\d/.test(input[i]) || input[i] === '.')) {
        if (input[i] === '.') {
          if (hasDot) break;
          hasDot = true;
        }
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Check for parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Check for operators: +, -, *, /, %
    if (['+', '-', '*', '/', '%'].includes(ch)) {
      // Check for unary minus:
      // A minus is unary if it is at the start, or preceded by an operator or '('
      if (ch === '-') {
        const prev = tokens[tokens.length - 1];
        if (!prev || prev.type === 'OPERATOR' || prev.type === 'LPAREN') {
          // Unary minus: parse as part of number or special unary token
          tokens.push({ type: 'OPERATOR', value: 'UNARY_MINUS' });
          i++;
          continue;
        }
      }
      tokens.push({ type: 'OPERATOR', value: ch });
      i++;
      continue;
    }

    // Unknown character, skip
    i++;
  }

  return tokens;
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  UNARY_MINUS: 3,
};

function infixToRPN(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'NUMBER') {
      output.push(token);
    } else if (token.type === 'OPERATOR') {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1].type === 'OPERATOR' &&
        PRECEDENCE[opStack[opStack.length - 1].value] >= PRECEDENCE[token.value]
      ) {
        output.push(opStack.pop()!);
      }
      opStack.push(token);
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'LPAREN') {
        opStack.pop();
      }
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop()!;
    if (top.type !== 'LPAREN') {
      output.push(top);
    }
  }

  return output;
}

function evaluateRPN(tokens: Token[]): number {
  const stack: number[] = [];

  for (const token of tokens) {
    if (token.type === 'NUMBER') {
      stack.push(parseFloat(token.value));
    } else if (token.type === 'OPERATOR') {
      if (token.value === 'UNARY_MINUS') {
        if (stack.length < 1) throw new Error('Malformed expression');
        const val = stack.pop()!;
        stack.push(-val);
        continue;
      }

      if (stack.length < 2) throw new Error('Malformed expression');
      const b = stack.pop()!;
      const a = stack.pop()!;

      switch (token.value) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b);
          break;
        case '%':
          stack.push(a % b);
          break;
        default:
          throw new Error(`Unknown operator: ${token.value}`);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error('Malformed expression');
  }

  return stack[0];
}
