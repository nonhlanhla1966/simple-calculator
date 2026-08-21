/*
 * Simple Calculator - core logic.
 *
 * Safe token-based expression evaluator (NO JavaScript eval()).
 * Supports operator precedence (* and / bind tighter than + and -),
 * left-to-right associativity within the same tier, percentages,
 * decimals, negative results, and defensive input handling.
 *
 * Environment-agnostic UMD module: browser + Node.js tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Calculator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_ENTRY_LENGTH = 15;      // max characters while typing one number
  var OPS = { '\u00f7': '/', '\u00d7': '*', '\u2212': '-', '+': '+' };
  var SYMBOLS = { '/': '\u00f7', '*': '\u00d7', '-': '\u2212', '+': '+' };
  var ERROR_DIV_ZERO = "Can't divide by 0";
  var ERROR_GENERIC = 'Error';

  function isOpKey(key) {
    return Object.prototype.hasOwnProperty.call(OPS, key);
  }

  function isOpToken(t) {
    return typeof t === 'string' && Object.prototype.hasOwnProperty.call(SYMBOLS, t);
  }

  /* Round away binary floating point noise: 0.1+0.2 -> 0.3 */
  function cleanFloat(v) {
    if (!isFinite(v)) return NaN;
    return v === 0 ? 0 : Number(v.toPrecision(12));
  }

  /* Human-friendly display formatting for computed values. */
  function formatNumber(v) {
    if (typeof v !== 'number' || isNaN(v)) return ERROR_GENERIC;
    if (!isFinite(v)) return ERROR_DIV_ZERO;
    v = cleanFloat(v);
    var abs = Math.abs(v);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
      // scientific notation for very large/small magnitudes
      return v.toExponential(6)
        .replace(/(\.\d*?)0+e/, '$1e')
        .replace(/\.e/, 'e');
    }
    return String(v);
  }

  /* Internal evaluation error. */
  function EvalError_(msg) { this.message = msg; }
  EvalError_.prototype = Object.create(Error.prototype);

  /*
   * Evaluate [num, op, num, op, num...] honouring precedence:
   * pass 1 collapses * and /, pass 2 folds + and - left to right.
   */
  function evaluateTokens(tokens) {
    if (tokens.length < 3 || tokens.length % 2 === 0) {
      throw new EvalError_(ERROR_GENERIC);
    }
    for (var i = 0; i < tokens.length; i++) {
      var ok = i % 2 === 0
        ? typeof tokens[i] === 'string' && tokens[i] !== '' && !isNaN(parseFloat(tokens[i]))
        : isOpToken(tokens[i]);
      if (!ok) throw new EvalError_(ERROR_GENERIC);
    }

    // pass 1: multiplicative tier (no intermediate rounding - precision is
    // restored once on the final value)
    var flat = [parseFloat(tokens[0])];
    for (var j = 1; j < tokens.length; j += 2) {
      var op = tokens[j];
      var rhs = parseFloat(tokens[j + 1]);
      if (isNaN(rhs)) throw new EvalError_(ERROR_GENERIC);
      if (op === '*') {
        flat[flat.length - 1] = flat[flat.length - 1] * rhs;
      } else if (op === '/') {
        if (rhs === 0) throw new EvalError_(ERROR_DIV_ZERO);
        flat[flat.length - 1] = flat[flat.length - 1] / rhs;
      } else {
        flat.push(op, rhs);
      }
    }

    // pass 2: additive tier, left to right
    var acc = flat[0];
    for (var k = 1; k < flat.length; k += 2) {
      var o = flat[k];
      var x = flat[k + 1];
      acc = o === '+' ? acc + x : acc - x;
    }
    acc = cleanFloat(acc);
    if (isNaN(acc) || !isFinite(acc)) throw new EvalError_(ERROR_GENERIC);
    return acc;
  }

  /*
   * Calculator state machine.
   * Keys: 0-9, '00', '.', '+', '\u2212', '\u00d7', '\u00f7', '%', '=', 'AC', 'DEL'
   */
  function Calculator() {
    this.reset();
  }

  Calculator.prototype.reset = function () {
    this.expr = [];           // committed tokens awaiting '='
    this.cur = '';            // number being typed (or final result after '=')
    this.justEvaluated = false;
    this.error = null;
    this.lastExpression = '';
    return this;
  };

  Calculator.prototype.display = function () {
    if (this.error) return this.error;
    if (this.cur !== '') return this.cur;
    return '0';
  };

  /* Full pending calculation for the secondary display line. */
  Calculator.prototype.expressionText = function () {
    if (this.error) return '';
    if (this.expr.length) {
      var parts = this.expr.map(function (t) {
        return isOpToken(t) ? SYMBOLS[t] : t;
      });
      if (this.cur !== '') parts.push(this.cur);
      return parts.join(' ');
    }
    if (this.justEvaluated && this.lastExpression) {
      return this.lastExpression + ' =';
    }
    return '';
  };

  Calculator.prototype._setError = function (msg) {
    this.error = msg;
    this.expr = [];
    this.cur = '';
    this.justEvaluated = false;
  };

  Calculator.prototype._freshEntryIfNeeded = function () {
    if (this.justEvaluated) {
      this.justEvaluated = false;
      this.cur = '';
      this.lastExpression = '';
    }
  };

  Calculator.prototype._digit = function (d) {
    if (this.error) return;
    this._freshEntryIfNeeded();
    if (this.cur === '0') {
      if (d === '0') return;            // never grow leading zeros
      this.cur = d;                     // 0 + digit replaces the 0
      return;
    }
    if (this.cur.length >= MAX_ENTRY_LENGTH) return; // long-number protection
    this.cur += d;
  };

  Calculator.prototype._doubleZero = function () {
    if (this.error) return;
    this._freshEntryIfNeeded();
    if (this.cur === '' || this.cur === '0') {
      this.cur = '0';                   // "00" on empty/zero stays a single 0
      return;
    }
    if (this.cur.length + 2 > MAX_ENTRY_LENGTH) return;
    this.cur += '00';
  };

  Calculator.prototype._dot = function () {
    if (this.error) return;
    this._freshEntryIfNeeded();
    if (this.cur.indexOf('.') !== -1) return;   // only one decimal point
    if (this.cur === '') { this.cur = '0.'; return; }
    if (this.cur.length >= MAX_ENTRY_LENGTH) return;
    this.cur += '.';
  };

  Calculator.prototype._operator = function (opKey) {
    if (this.error) return;
    var op = OPS[opKey];
    // After '=', cur holds the result: it becomes the first operand of the
    // new expression (continue calculating from the result).
    this.justEvaluated = false;
    if (this.cur !== '') {
      this.expr.push(this.cur);         // commit operand
      this.cur = '';
    } else if (this.expr.length && isOpToken(this.expr[this.expr.length - 1])) {
      this.expr.pop();                  // replace a double operator press
    } else if (!this.expr.length) {
      return;                           // no leading operator from a blank state
    }
    this.expr.push(op);
  };

  Calculator.prototype._percent = function () {
    if (this.error) return;
    if (this.cur === '') return;
    var v = parseFloat(this.cur);
    if (isNaN(v)) { this._setError(ERROR_GENERIC); return; }
    var p = cleanFloat(v / 100);
    if (isNaN(p) || !isFinite(p)) { this._setError(ERROR_GENERIC); return; }
    this.cur = formatNumber(p);
    this.justEvaluated = false;
  };

  Calculator.prototype._equals = function () {
    if (this.error) return;
    if (this.cur !== '') {
      this.expr.push(this.cur);
      this.cur = '';
    }
    if (this.expr.length === 0) return;
    if (isOpToken(this.expr[this.expr.length - 1])) {
      this.expr.pop();                  // trailing operator with no operand
    }
    if (this.expr.length === 1) {       // lone number: just show it
      this.cur = formatNumber(parseFloat(this.expr[0]));
      this.expr = [];
      this.justEvaluated = true;
      return;
    }
    var tokens = this.expr.slice();
    var value;
    try {
      value = evaluateTokens(tokens);
    } catch (e) {
      this._setError(e.message || ERROR_GENERIC);
      return;
    }
    this.lastExpression = tokens.map(function (t) {
      return isOpToken(t) ? SYMBOLS[t] : t;
    }).join(' ');
    this.cur = formatNumber(value);
    this.expr = [];
    this.justEvaluated = true;
  };

  Calculator.prototype._clearAll = function () {
    this.reset();
  };

  Calculator.prototype._delete = function () {
    if (this.error) { this.reset(); return; }
    if (this.justEvaluated) { this.reset(); return; }
    if (this.cur !== '') {
      this.cur = this.cur.slice(0, -1);
      return;
    }
    if (this.expr.length) {
      this.expr.pop();                  // remove trailing operator or operand
    }
  };

  Calculator.prototype.press = function (key) {
    if (key === 'AC') { this._clearAll(); return this.display(); }
    if (key === 'DEL') { this._delete(); return this.display(); }
    if (this.error) return this.display();       // only AC/DEL recover from errors
    if (/^[0-9]$/.test(key)) this._digit(key);
    else if (key === '00') this._doubleZero();
    else if (key === '.') this._dot();
    else if (isOpKey(key)) this._operator(key);
    else if (key === '%') this._percent();
    else if (key === '=') this._equals();
    // unknown keys are ignored - invalid input can never crash the app
    return this.display();
  };

  // Expose helpers for tests
  Calculator.formatNumber = formatNumber;
  Calculator.evaluateTokens = evaluateTokens;
  Calculator.ERROR_DIV_ZERO = ERROR_DIV_ZERO;
  Calculator.ERROR_GENERIC = ERROR_GENERIC;

  return Calculator;
});
