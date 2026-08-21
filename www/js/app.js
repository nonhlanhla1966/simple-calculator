/* Simple Calculator - UI wiring. Uses the pure Calculator core (calculator.js). */
(function () {
  'use strict';

  var calc = new Calculator();
  var displayEl = document.getElementById('display');
  var expressionEl = document.getElementById('expression');
  var keypad = document.getElementById('keypad');

  function render() {
    var text = calc.display();
    displayEl.textContent = text;
    if (calc.error) {
      displayEl.classList.add('error');
      expressionEl.textContent = '';
    } else {
      displayEl.classList.remove('error');
      expressionEl.textContent = calc.expressionText();
    }
    fitDisplay();
  }

  /* Shrink font until long values fit - prevents overflow off-screen. */
  function fitDisplay() {
    var size = window.getComputedStyle(displayEl).fontSize;
    size = parseFloat(size);
    var min = 16;
    displayEl.style.fontSize = size + 'px';
    var guard = 64;
    while (displayEl.scrollWidth > displayEl.clientWidth && size > min && guard-- > 0) {
      size -= 1;
      displayEl.style.fontSize = size + 'px';
    }
  }

  function press(key) {
    calc.press(key);
    render();
  }

  keypad.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.key') : null;
    if (!btn) return;
    press(btn.getAttribute('data-key'));
  });

  /* Physical keyboard support (useful in emulators / WebViews with input). */
  window.addEventListener('keydown', function (ev) {
    var map = {
      'Enter': '=', '=': '=', '+': '+', '-': '\u2212', '*': '\u00d7',
      '/': '\u00f7', '%': '%', '.': '.', 'Backspace': 'DEL',
      'Escape': 'AC', 'Delete': 'AC'
    };
    var key = null;
    if (/^[0-9]$/.test(ev.key)) key = ev.key;
    else if (map[ev.key]) key = map[ev.key];
    if (key) {
      ev.preventDefault();
      press(key);
    }
  });

  window.addEventListener('resize', fitDisplay);
  render();
})();
