// Load environment variables from .env file
async function loadEnvVariables() {
    try {
        const response = await fetch('/.env');
        const text = await response.text();
        
        // Parse the .env file
        const envVars = {};
        text.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        });
        
        return envVars;
    } catch (error) {
        console.error('Error loading environment variables:', error);
        return {};
    }
}

export { loadEnvVariables }; 