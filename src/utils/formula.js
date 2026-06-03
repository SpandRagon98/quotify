/**
 * Safe formula engine for Calculated Fields.
 *
 * NO eval / Function — formulas are tokenized and evaluated with a hand-written
 * shunting-yard parser. Supported: + - * / , parentheses, number literals, and
 * field references by label (which may contain spaces, e.g. "Door Qty").
 */

const OPS = { "+": 1, "-": 1, "*": 2, "/": 2 };

/** Coerce any value to a finite number (0 otherwise). */
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** A field whose value can be used inside a formula. */
export function isNumericField(field) {
  return field.calculated || field.type === "number" || field.type === "boolean";
}

/** Tokenize a formula into numbers, operators, parens and identifiers. */
function tokenize(formula) {
  const s = String(formula || "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if ("+-*/()".includes(c)) {
      tokens.push({ t: c === "(" || c === ")" ? "paren" : "op", v: c });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ t: "num", v: parseFloat(num) });
      continue;
    }
    // Identifier: read until the next operator/paren, then trim.
    let id = "";
    while (i < s.length && !"+-*/()".includes(s[i])) id += s[i++];
    const name = id.trim();
    if (name) tokens.push({ t: "id", v: name });
  }
  return tokens;
}

/** Convert tokens to RPN (shunting-yard), resolving identifiers to numbers. */
function toRpn(tokens, resolve) {
  const output = [];
  const ops = [];
  let prev = null; // 'val' | 'op' | 'open' | null

  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.t === "num") {
      output.push(tok.v);
      prev = "val";
    } else if (tok.t === "id") {
      output.push(resolve(tok.v));
      prev = "val";
    } else if (tok.t === "paren" && tok.v === "(") {
      ops.push("(");
      prev = "open";
    } else if (tok.t === "paren" && tok.v === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop());
      if (!ops.length) throw new Error("Mismatched parentheses");
      ops.pop();
      prev = "val";
    } else if (tok.t === "op") {
      // Unary minus/plus when an operator is expected.
      if ((tok.v === "-" || tok.v === "+") && (prev === null || prev === "op" || prev === "open")) {
        if (tok.v === "-") output.push(0);
        else {
          prev = "op";
          continue; // unary plus = no-op
        }
      }
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        OPS[ops[ops.length - 1]] >= OPS[tok.v]
      ) {
        output.push(ops.pop());
      }
      ops.push(tok.v);
      prev = "op";
    }
  }
  while (ops.length) {
    const op = ops.pop();
    if (op === "(") throw new Error("Mismatched parentheses");
    output.push(op);
  }
  return output;
}

function evalRpn(rpn) {
  const stack = [];
  for (const item of rpn) {
    if (typeof item === "number") {
      stack.push(item);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Invalid formula");
      let r;
      switch (item) {
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "*": r = a * b; break;
        case "/": r = b === 0 ? 0 : a / b; break; // guard divide-by-zero
        default: throw new Error("Unknown operator");
      }
      stack.push(r);
    }
  }
  if (stack.length !== 1) throw new Error("Invalid formula");
  return stack[0];
}

/** List the identifier names referenced by a formula. */
export function formulaIdentifiers(formula) {
  return tokenize(formula)
    .filter((t) => t.t === "id")
    .map((t) => t.v);
}

/**
 * Evaluate a formula against a context map (lowercased label → number).
 * Unknown identifiers resolve to 0; any error yields 0.
 */
export function evaluateFormula(formula, context) {
  try {
    const rpn = toRpn(tokenize(formula), (name) => {
      const v = context[name.trim().toLowerCase()];
      return Number.isFinite(v) ? v : 0;
    });
    const result = evalRpn(rpn);
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

/**
 * Validate a calculated field's formula.
 * @returns {{ok:boolean, error:string}}
 */
export function validateFormula(formula, allowedLabels) {
  const trimmed = String(formula || "").trim();
  if (!trimmed) return { ok: false, error: "Formula is empty" };

  const allowed = new Set(allowedLabels.map((l) => l.trim().toLowerCase()));
  const ids = formulaIdentifiers(trimmed);
  for (const id of ids) {
    if (!allowed.has(id.trim().toLowerCase())) {
      return { ok: false, error: `"${id}" is not a usable number field` };
    }
  }
  // Syntax check: fully compile AND evaluate with every identifier = 1, so
  // malformed expressions (e.g. "a * * b") are caught here, not just at runtime.
  try {
    const ctx = {};
    ids.forEach((id) => (ctx[id.trim().toLowerCase()] = 1));
    const rpn = toRpn(tokenize(trimmed), (name) => ctx[name.trim().toLowerCase()] ?? 1);
    evalRpn(rpn);
  } catch (err) {
    return { ok: false, error: err.message || "Invalid formula syntax" };
  }
  return { ok: true, error: "" };
}

/** Effective numeric value of an input field (gate-aware). */
function effectiveNumber(field, inputValues) {
  if (field.type === "boolean") return inputValues[field.id] ? 1 : 0;
  // A number gated by a toggle reads 0 when the toggle is off.
  if (field.gateFieldId && !inputValues[field.gateFieldId]) return 0;
  return safeNumber(inputValues[field.id]);
}

/**
 * Compute all calculated field values for a preset given the entered inputs.
 * Calculated fields are evaluated in document order, so a later one can use an
 * earlier one.
 * @returns {Object<string, number>} map of calculatedFieldId → number
 */
export function computeCalculatedValues(preset, inputValues) {
  const context = {};
  // Seed context with non-calculated numeric/boolean fields.
  preset.fields.forEach((f) => {
    if (!f.calculated && (f.type === "number" || f.type === "boolean")) {
      context[f.label.trim().toLowerCase()] = effectiveNumber(f, inputValues);
    }
  });

  const result = {};
  preset.fields.forEach((f) => {
    if (f.calculated) {
      const value = evaluateFormula(f.formula, context);
      result[f.id] = value;
      if (f.label) context[f.label.trim().toLowerCase()] = value;
    }
  });
  return result;
}

/** Format a calculated number per its formatting options. */
export function formatCalculated(value, field) {
  const fmt = field.format || "number";
  const decimals = Number.isFinite(Number(field.decimals))
    ? Number(field.decimals)
    : fmt === "currency" || fmt === "percentage"
    ? 2
    : 0;

  const n = Number(value) || 0;
  let body = n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (fmt === "percentage") body += "%";

  const prefix = field.prefix || (fmt === "currency" ? "₹ " : "");
  const suffix = field.suffix || "";
  return `${prefix}${body}${suffix}`;
}
