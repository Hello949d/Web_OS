function initTerminal(windowBody) {
    if (!windowBody) return;

    let cwd_id = null;
    let cwd_name = '~';
    let commandHistory = [];
    let historyIndex = -1;

    // --- UI Setup ---
    windowBody.style.padding = '0';
    windowBody.style.background = '#000';
    windowBody.style.fontFamily = 'monospace';
    windowBody.innerHTML = `
        <div class="terminal h-full flex flex-col p-2 text-white text-sm">
            <div id="terminal-output" class="flex-grow overflow-y-auto"></div>
            <div class="flex">
                <span id="terminal-prompt" class="mr-2"></span>
                <input type="text" id="terminal-input" class="flex-grow bg-transparent outline-none">
            </div>
        </div>
    `;

    const outputEl = windowBody.querySelector('#terminal-output');
    const inputEl = windowBody.querySelector('#terminal-input');
    const promptEl = windowBody.querySelector('#terminal-prompt');

    function updatePrompt() {
        promptEl.textContent = `WebOS:${cwd_name}$`;
    }

    function printToOutput(text) {
        const line = document.createElement('div');
        line.innerHTML = text.replace(/\n/g, '<br>'); // innerHTML to render <br>
        outputEl.appendChild(line);
        outputEl.scrollTop = outputEl.scrollHeight; // Scroll to bottom
    }

    async function executeCommand(commandStr) {
        if (!commandStr) return;

        // Add to history
        commandHistory.push(commandStr);
        historyIndex = commandHistory.length;

        // Print command to output
        printToOutput(`${promptEl.textContent} ${commandStr}`);

        try {
            const response = await fetch('/api/terminal/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ command: commandStr, cwd_id: cwd_id })
            });
            const data = await response.json();

            // Print command output
            if (data.output) {
                printToOutput(data.output);
            }

            // Update CWD if changed
            if (data.new_cwd && data.new_cwd.id !== undefined) {
                cwd_id = data.new_cwd.id;
                cwd_name = data.new_cwd.name;
                updatePrompt();
            }

        } catch (error) {
            printToOutput(`Error: ${error.message}`);
        }
    }

    // --- Event Listeners ---
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            executeCommand(inputEl.value);
            inputEl.value = '';
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                inputEl.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputEl.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                inputEl.value = '';
            }
        }
    });

    // Focus input on window click
    windowBody.addEventListener('click', () => inputEl.focus());

    // Initial setup
    updatePrompt();
    inputEl.focus();
    printToOutput('Welcome to WebOS Terminal. Type "help" for a list of commands.');
}
