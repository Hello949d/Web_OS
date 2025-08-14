function initCalculator() {
    const appId = 'calculator';
    const title = 'Calculator';

    const windowBody = createWindow(appId, title, '', { width: 300, height: 450 });
    if (!windowBody) return;

    let currentInput = '0';
    let operator = null;
    let previousInput = null;

    // --- UI Setup ---
    windowBody.style.padding = '0';
    windowBody.innerHTML = `
        <div class="calculator h-full flex flex-col bg-gray-800">
            <div id="calc-display" class="display bg-gray-900 text-white text-4xl text-right p-4">0</div>
            <div class="buttons grid grid-cols-4 gap-px bg-gray-700 flex-grow">
                <button class="btn-op p-4 text-2xl" data-action="clear">AC</button>
                <button class="btn-op p-4 text-2xl" data-action="negate">+/-</button>
                <button class="btn-op p-4 text-2xl" data-action="percent">%</button>
                <button class="btn-op-main p-4 text-2xl" data-action="divide">÷</button>
                <button class="btn-num p-4 text-2xl">7</button>
                <button class="btn-num p-4 text-2xl">8</button>
                <button class="btn-num p-4 text-2xl">9</button>
                <button class="btn-op-main p-4 text-2xl" data-action="multiply">×</button>
                <button class="btn-num p-4 text-2xl">4</button>
                <button class="btn-num p-4 text-2xl">5</button>
                <button class="btn-num p-4 text-2xl">6</button>
                <button class="btn-op-main p-4 text-2xl" data-action="subtract">−</button>
                <button class="btn-num p-4 text-2xl">1</button>
                <button class="btn-num p-4 text-2xl">2</button>
                <button class="btn-num p-4 text-2xl">3</button>
                <button class="btn-op-main p-4 text-2xl" data-action="add">+</button>
                <button class="btn-num p-4 text-2xl col-span-2">0</button>
                <button class="btn-num p-4 text-2xl" data-action="decimal">.</button>
                <button class="btn-op-main p-4 text-2xl" data-action="equals">=</button>
            </div>
        </div>
        <style>
            .calculator .btn-num { @apply bg-gray-600 hover:bg-gray-500; }
            .calculator .btn-op { @apply bg-gray-500 hover:bg-gray-400; }
            .calculator .btn-op-main { @apply bg-orange-500 hover:bg-orange-400 text-white; }
        </style>
    `;

    const display = windowBody.querySelector('#calc-display');
    const buttons = windowBody.querySelector('.buttons');

    buttons.addEventListener('click', (e) => {
        const key = e.target;
        const action = key.dataset.action;
        const keyContent = key.textContent.trim();

        if (!action) { // It's a number
            if (display.textContent === '0') {
                display.textContent = keyContent;
            } else {
                display.textContent += keyContent;
            }
        } else if (action === 'decimal') {
            if (!display.textContent.includes('.')) {
                display.textContent += '.';
            }
        } else if (action === 'clear') {
            display.textContent = '0';
        } else if (action === 'equals') {
            try {
                // Replace display symbols with JS operators
                let expression = display.textContent.replace(/×/g, '*').replace(/÷/g, '/');
                // Use eval for simplicity. Be cautious with eval in real-world apps.
                let result = eval(expression);
                display.textContent = parseFloat(result.toPrecision(10));
            } catch (error) {
                display.textContent = 'Error';
            }
        } else { // It's an operator
            display.textContent += ` ${keyContent} `;
        }
    });
}
