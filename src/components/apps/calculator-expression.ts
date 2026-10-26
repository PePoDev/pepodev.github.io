// Evaluates the Calculator's expression as the JavaScript expression it
// is, without eval: the site's Content-Security-Policy allows no eval
// (scripts/security-headers.mjs). The grammar is what the Calculator can
// produce: decimal numbers (with exponents, as large results show them),
// unary + and -, then *, / and % before + and -, left to right, and
// parentheses (from percentages). What strict-mode JavaScript would throw
// on (05, 1.2.3, ++, a missing operand, or 2(3), which calls a number)
// throws, and every operation is JavaScript's own, so results match eval's
// to the last bit.

function invalid(): never {
  throw new SyntaxError("Invalid expression");
}

export function evaluateExpression(source: string): number {
  let index = 0;

  const peek = () => {
    while (source[index] === " ") index += 1;
    // ++ and -- are increment and decrement, which no number takes.
    if (source.startsWith("++", index) || source.startsWith("--", index)) invalid();
    return source[index];
  };

  const sum = (): number => {
    let value = product();
    for (let op = peek(); op === "+" || op === "-"; op = peek()) {
      index += 1;
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };

  const product = (): number => {
    let value = unary();
    for (let op = peek(); op === "*" || op === "/" || op === "%"; op = peek()) {
      index += 1;
      const right = unary();
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  };

  const unary = (): number => {
    const op = peek();
    if (op === "+" || op === "-") {
      index += 1;
      const value = unary();
      return op === "-" ? -value : value;
    }
    if (op === "(") {
      index += 1;
      const value = sum();
      if (peek() !== ")") invalid();
      index += 1;
      return value;
    }
    // A decimal literal: strict mode allows no leading 0 before a digit, and
    // a literal cannot run straight into a letter, a digit or a dot.
    const literal = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/.exec(source.slice(index))?.[0];
    if (!literal || /^0\d/.test(literal) || /^[\w.]/.test(source.slice(index + literal.length))) invalid();
    index += literal.length;
    return Number(literal);
  };

  const value = sum();
  if (peek() !== undefined) invalid();
  return value;
}
