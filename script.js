const display = document.getElementById("display");
const buttons = document.getElementById("buttons");
const OPS = "+-*/%";
let expr = "";
let justEvaluated = false;

// Show the current expression on screen
function render() {
  display.textContent = expr === "" ? "0" : expr.replace(/\*/g, "×").replace(/\//g, "÷");
}

// Calculate without eval(): tokenize, then handle precedence with two stacks
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
    else if (OPS.includes(expr.slice(-1))) expr = expr.slice(0, -1) + key;
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

// ---------- Voice input (only runs if the mic button exists in index.html) ----------
function speechToExpr(t) {
  t = t.toLowerCase();
  const nums = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
  Object.keys(nums).forEach(w => { t = t.replace(new RegExp("\\b" + w + "\\b", "g"), nums[w]); });
  t = t.replace(/(\d+\.?\d*)\s*(percent|%)\s*of\s*(\d+\.?\d*)/g, "$3*$1/100");
  t = t.replace(/plus|add/g, "+")
       .replace(/minus|subtract/g, "-")
       .replace(/multiplied by|times|into| x /g, "*")
       .replace(/divided by|by/g, "/")
       .replace(/point/g, ".");
  return t.replace(/[^0-9.+\-*\/%]/g, "");
}

const mic = document.getElementById("mic");
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (mic) {
  if (!SR) {
    mic.disabled = true;
    mic.textContent = "Voice not supported";
  } else {
    const rec = new SR();
    rec.lang = "en-IN";
    mic.addEventListener("click", () => { rec.start(); mic.textContent = "Listening..."; });
    rec.onresult = (e) => {
      expr = speechToExpr(e.results[0][0].transcript);
      justEvaluated = false;
      render();
      press("=");
    };
    rec.onend = () => { mic.textContent = "🎤 Speak"; };
  }
}

// ---------- Smart suggestions: Markov chain on operator sequence ----------
let model = {};     // model[previousOp][nextOp] = how many times
let history = {};   // history[expression] = how many times
let lastOp = "START";
const SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷", "%": "%" };

try {
  model = JSON.parse(localStorage.getItem("model")) || {};
  history = JSON.parse(localStorage.getItem("history")) || {};
} catch (e) {}

function save() {
  try {
    localStorage.setItem("model", JSON.stringify(model));
    localStorage.setItem("history", JSON.stringify(history));
  } catch (e) {}
}

// Training: count one transition (previous operator -> this operator)
function learn(op) {
  model[lastOp] = model[lastOp] || {};
  model[lastOp][op] = (model[lastOp][op] || 0) + 1;
  lastOp = op;
  save();
}

function remember(expression) {
  history[expression] = (history[expression] || 0) + 1;
  save();
}

function addChip(box, text, onClick) {
  const b = document.createElement("button");
  b.className = "chip";
  b.textContent = text;
  b.addEventListener("click", onClick);
  box.appendChild(b);
}

// Prediction: show the most likely next operators with probabilities
function showSuggestions() {
  const box = document.getElementById("suggest");
  if (!box) return;
  box.innerHTML = "";

  if (expr === "") {
    Object.entries(history).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([e, c]) => {
      addChip(box, e.replace(/\*/g, "×").replace(/\//g, "÷") + " (" + c + "x)", () => {
        expr = e; lastOp = "START"; render(); showSuggestions();
      });
    });
    return;
  }

  if (/\d$/.test(expr)) {
    const counts = model[lastOp] || {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([op, c]) => {
      addChip(box, SYMBOL[op] + "  " + Math.round((c / total) * 100) + "%", () => press(op));
    });
  }
}

// Wrap press() so the model trains after every key
const basePress = press;
press = function (key) {
  const before = expr;
  basePress(key);

  if (OPS.includes(key) && expr.length > before.length && expr.length > 1) learn(key);

  if ((key === "=" || key === "Enter") && /\d[+\-*\/%]\d/.test(before) && justEvaluated) {
    remember(before);
    lastOp = "START";
  }
  if (key === "C") lastOp = "START";

  showSuggestions();
};

showSuggestions();