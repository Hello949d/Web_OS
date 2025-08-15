function initCalculator() {
    const appId = 'calculator';
    const title = 'Calculator';

    const windowBody = createWindow(appId, title, '', { width: 300, height: 450 });
    if (!windowBody) return;

    let displayValue = '0';
    let firstOperand = null;
    let waitingForSecondOperand = false;
    let operator = null;

    function updateDisplay() {
        const display = windowBody.querySelector('#calc-display');
        display.textContent = displayValue;
    }

    function inputDigit(digit) {
        if (waitingForSecondOperand) {
            displayValue = digit;
            waitingForSecondOperand = false;
        } else {
            displayValue = displayValue === '0' ? digit : displayValue + digit;
        }
        updateDisplay();
    }

    function inputDecimal() {
        if (!displayValue.includes('.')) {
            displayValue += '.';
        }
        updateDisplay();
    }

    function handleOperator(nextOperator) {
        const inputValue = parseFloat(displayValue);

        if (operator && waitingForSecondOperand) {
            operator = nextOperator;
            return;
        }

        if (firstOperand === null) {
            firstOperand = inputValue;
        } else if (operator) {
            const result = performCalculation[operator](firstOperand, inputValue);
            displayValue = String(parseFloat(result.toPrecision(10)));
            firstOperand = result;
        }

        waitingForSecondOperand = true;
        operator = nextOperator;
        updateDisplay();
    }

    const performCalculation = {
        '/': (first, second) => first / second,
        '*': (first, second) => first * second,
        '+': (first, second) => first + second,
        '-': (first, second) => first - second,
        '=': (first, second) => second,
    };

    function resetCalculator() {
        displayValue = '0';
        firstOperand = null;
        waitingForSecondOperand = false;
        operator = null;
        updateDisplay();
    }

    // --- UI Setup ---
    windowBody.style.padding = '0';
    windowBody.innerHTML = `
        <div class="calculator h-full flex flex-col bg-gray-800">
            <div id="calc-display" class="display bg-gray-900 text-white text-4xl text-right p-4 font-light">${displayValue}</div>
            <div class="buttons grid grid-cols-4 gap-px bg-gray-700 flex-grow">
                <button class="btn-op p-4 text-2xl" data-key="clear">AC</button>
                <button class="btn-op p-4 text-2xl" data-key="negate">+/-</button>
                <button class="btn-op p-4 text-2xl" data-key="percent">%</button>
                <button class="btn-op-main p-4 text-2xl" data-key="/">÷</button>
                <button class="btn-num p-4 text-2xl" data-key="7">7</button>
                <button class="btn-num p-4 text-2xl" data-key="8">8</button>
                <button class="btn-num p-4 text-2xl" data-key="9">9</button>
                <button class="btn-op-main p-4 text-2xl" data-key="*">×</button>
                <button class="btn-num p-4 text-2xl" data-key="4">4</button>
                <button class="btn-num p-4 text-2xl" data-key="5">5</button>
                <button class="btn-num p-4 text-2xl" data-key="6">6</button>
                <button class="btn-op-main p-4 text-2xl" data-key="-">−</button>
                <button class="btn-num p-4 text-2xl" data-key="1">1</button>
                <button class="btn-num p-4 text-2xl" data-key="2">2</button>
                <button class="btn-num p-4 text-2xl" data-key="3">3</button>
                <button class="btn-op-main p-4 text-2xl" data-key="+">+</button>
                <button class="btn-num p-4 text-2xl col-span-2" data-key="0">0</button>
                <button class="btn-num p-4 text-2xl" data-key=".">.</button>
                <button class="btn-op-main p-4 text-2xl" data-key="=">=</button>
            </div>
        </div>
        <style>
            .calculator .btn-num { @apply bg-gray-600 hover:bg-gray-500; }
            .calculator .btn-op { @apply bg-gray-500 hover:bg-gray-400; }
            .calculator .btn-op-main { @apply bg-orange-500 hover:bg-orange-400 text-white; }
        </style>
    `;

    const buttons = windowBody.querySelector('.buttons');
    buttons.addEventListener('click', (e) => {
        const { target } = e;
        if (!target.matches('button')) return;

        const key = target.dataset.key;

        if (/\d/.test(key)) {
            inputDigit(key);
            return;
        }
        if (key === '.') {
            inputDecimal();
            return;
        }
        if (['+', '-', '*', '/','='].includes(key)) {
            handleOperator(key);
            return;
        }
        if (key === 'clear') {
            resetCalculator();
            return;
        }
        if (key === 'negate') {
            displayValue = String(parseFloat(displayValue) * -1);
            updateDisplay();
            return;
        }
        if (key === 'percent') {
            displayValue = String(parseFloat(displayValue) / 100);
            updateDisplay();
        }
    });
}
