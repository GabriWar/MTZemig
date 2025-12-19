// Intercept ALL Fetch requests - Read body BEFORE Apollo can abort
console.log('%c[CEMIG INTERCEPTOR] Script loaded!', 'color: green; font-weight: bold;');

const originalFetch = window.fetch;

// Override fetch - Read body synchronously before returning
window.fetch = async function (...args) {
    const url = args[0] instanceof Request ? args[0].url : (args[0] ? args[0].toString() : '');

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // For GraphQL requests, we need to intercept the body
    if (url.includes('graphql')) {
        console.log('%c[CEMIG INTERCEPTOR] GraphQL request:', 'color: blue;', url);

        try {
            // Read the entire body as ArrayBuffer BEFORE returning
            // This prevents Apollo from aborting before we read it
            const bodyBuffer = await response.arrayBuffer();
            const bodyText = new TextDecoder().decode(bodyBuffer);

            // Try to parse and log
            try {
                const data = JSON.parse(bodyText);
                console.log('%c[CEMIG INTERCEPTOR] GraphQL response:', 'color: orange;', data);

                // Check for billDetails
                if (data && data.data && data.data.billDetails) {
                    console.log('%c[CEMIG INTERCEPTOR] ✓ FOUND billDetails!', 'color: lime; font-weight: bold; font-size: 16px;', data);
                    window.postMessage({
                        type: 'CEMIG_BILL_DETAILS_CAPTURED',
                        payload: data
                    }, '*');
                }

                // Broadcast all GraphQL for debugging
                window.postMessage({
                    type: 'CEMIG_GRAPHQL_CAPTURED',
                    payload: data,
                    url: url
                }, '*');

            } catch (parseErr) {
                console.log('%c[CEMIG INTERCEPTOR] Response not JSON:', 'color: gray;', bodyText.substring(0, 100));
            }

            // Create a NEW Response with the same body (since we consumed the original)
            const newResponse = new Response(bodyBuffer, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });

            return newResponse;

        } catch (err) {
            console.error('%c[CEMIG INTERCEPTOR] Error reading response:', 'color: red;', err);
            // If we can't read it, return original (though it's likely consumed)
            return response;
        }
    }

    // For non-GraphQL requests, return as-is
    return response;
};

console.log('%c[CEMIG INTERCEPTOR] Fetch is now intercepted!', 'color: green; font-weight: bold;');
