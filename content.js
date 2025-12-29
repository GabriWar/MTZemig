// Content script for Cemig Login Autofill

console.log('Cemig Account Manager: Content script loaded.');

// Listen for messages from the injected script (interceptor.js running in MAIN world)
window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.type && event.data.type === 'CEMIG_BILL_DETAILS_CAPTURED') {
        console.log('Cemig Account Manager: Received captured data in content script');
        const billData = event.data.payload;

        // Save to storage - wrapped in try-catch to handle extension reload
        try {
            chrome.storage.local.set({ lastCapturedBill: billData }, () => {
                if (chrome.runtime.lastError) {
                    console.log('Cemig Account Manager: Extension was reloaded, refresh the page.');
                } else {
                    console.log('Cemig Account Manager: Bill data saved to storage.');

                    // Send message to background to notify popup
                    chrome.runtime.sendMessage({
                        action: 'NEW_BILL_DATA_CAPTURED'
                    }).catch(err => {
                        console.log('Could not notify popup:', err);
                    });
                }
            });
        } catch (e) {
            console.log('Cemig Account Manager: Extension context invalidated. Please refresh the page.');
        }
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fill_creds') {
        fillCredentials(request.user, request.pass);
        sendResponse({ status: 'ok' });
    }
});

function fillCredentials(user, pass) {
    // Heuristic to find fields
    // We look for a password field first, then a text/email field before it.
    const passwordField = document.querySelector('input[type="password"]');

    if (!passwordField) {
        console.log('Cemig Account Manager: Password field not found.');
        // Don't show alert - user might be on a different page
        return;
    }

    // Try to find the username field
    // 1. Look for input with name/id containing 'user', 'login', 'email'
    // 2. Look for the input immediately preceding the password field in the DOM
    let userField = document.querySelector('input[type="text"], input[type="email"]');

    // Refine user field search if multiple exist
    const inputs = Array.from(document.querySelectorAll('input'));
    const passIndex = inputs.indexOf(passwordField);

    if (passIndex > 0) {
        // Assume the input right before password is the username
        userField = inputs[passIndex - 1];
    }

    if (userField && passwordField) {
        console.log('Cemig Account Manager: Fields found. Autofilling...');

        // Set values
        userField.value = user;
        passwordField.value = pass;

        // Dispatch events to ensure frameworks (like React/Angular) detect the change
        userField.dispatchEvent(new Event('input', { bubbles: true }));
        userField.dispatchEvent(new Event('change', { bubbles: true }));
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`Cemig Account Manager: Autofilled for user ${user}`);
    } else {
        console.log('Cemig Account Manager: Could not identify both fields.');
        // Don't show alert - user might be on a different page
    }
}
