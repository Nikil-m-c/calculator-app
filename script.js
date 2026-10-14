const display = document.getElementById("display");
const buttons = document.getElementById("buttons");
const OPS = "+-*/%";
let expr = "";
let justEvaluated = false;

// Show the current expression on screen
function render() {
  display.textContent = expr === "" ? "0" : expr.replace(/\*/g, "×").replace(/\//g, "÷");
}

// Calculate without eval(): tokenize, then precedence with two stacks
function evaluate(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[0-9.]/.test(c)) {
      let n = "";
      while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
      tokens.push({ type: "num", value: parseFloat(n) });
    } else {
      // a minus at the start or after an operator means a negative number
      const prev = tokens[tokens.length - 1];
      if (c === "-" && (!prev || prev.type === "op")) tokens.push({ type: "num", value: 0 });
      tokens.push({ type: "op", value: c });
      i++;
    }
  }

  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
  const output = [], stack = [];
  for (const t of tokens) {
    if (t.type === "num") output.push(t);
    else {
      while (stack.length && prec[stack[stack.length - 1].value] >= prec[t.value]) {
        output.push(stack.pop());
      }
      stack.push(t);
    }
  }
  while (stack.length) output.push(stack.pop());

  const nums = [];
  for (const t of output) {
    if (t.type === "num") nums.push(t.value);
    else {
      const b = nums.pop(), a = nums.pop();
      if (a === undefined || b === undefined) throw new Error("Incomplete");
      if (t.value === "+") nums.push(a + b);
      if (t.value === "-") nums.push(a - b);
      if (t.value === "*") nums.push(a * b);
      if (t.value === "/") {
        if (b === 0) throw new Error("Cannot divide by 0");
        nums.push(a / b);
      }
      if (t.value === "%") nums.push(a % b);
    }
  }
  return nums[0];
}

// Handle every key press
function press(key) {
  if (key === "C") {
    expr = "";
  } else if (key === "Backspace") {
    expr = expr.slice(0, -1);
  } else if (key === "=" || key === "Enter") {
    if (!expr) return;
    try {
      expr = String(parseFloat(evaluate(expr).toPrecision(12)));
      justEvaluated = true;
    } catch (e) {
      expr = "";
      display.textContent = e.message;
      return;
    }
  } else if (OPS.includes(key)) {
    justEvaluated = false;
    if (expr === "") { if (key === "-") expr = "-"; }
    else if (OPS.includes(expr.slice(-1))) expr = expr.slice(0, -1) + key; // replace operator
    else expr += key;
  } else if (key === ".") {
    if (justEvaluated) { expr = ""; justEvaluated = false; }
    const lastNumber = expr.split(/[+\-*\/%]/).pop();
    if (!lastNumber.includes(".")) expr += lastNumber === "" ? "0." : ".";
  } else if (/^[0-9]$/.test(key)) {
    if (justEvaluated) { expr = ""; justEvaluated = false; }
    expr += key;
  }
  render();
}

// Mouse clicks on the buttons
buttons.addEventListener("click", (e) => {
  const key = e.target.dataset.key;
  if (key) press(key);
});

// Keyboard support
document.addEventListener("keydown", (e) => {
  if (/^[0-9.+\-*\/%]$/.test(e.key) || e.key === "Enter" || e.key === "Backspace") {
    press(e.key);
  } else if (e.key === "Escape") {
    press("C");
  }
});