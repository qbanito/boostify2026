
/**
 * Environment configuration checker
 * Validates environment variables and provides diagnostic info
 */

export function checkEnvironment() {
  const criticalEnvVars = [
    { name: 'OPENAI_API_KEY', description: 'OpenAI API access' },
    { name: 'SESSION_SECRET', description: 'Secure session management' },
    { name: 'DATABASE_URL', description: 'Database connection' },
    { name: 'FAL_KEY', description: 'FAL API access' }
  ];

  const warnings: string[] = [];
  const ready: string[] = [];

  criticalEnvVars.forEach(({ name, description }) => {
    if (!process.env[name]) {
      warnings.push(`⚠️ Warning: ${name} environment variable is not set (${description})`);
    } else {
      ready.push(`✅ ${name} is configured and ready for use`);
    }
  });

  if (warnings.length > 0) {
    console.log('🔍 Environment Check Results:');
    warnings.forEach(warning => console.log(warning));
    ready.forEach(msg => console.log(msg));
    
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Warning: Missing critical environment variables in production mode');
    } else {
      console.log('ℹ️ Some environment variables are missing. This might be expected in development.');
    }
  } else {
    console.log('✅ All critical environment variables are properly configured');
  }
}
