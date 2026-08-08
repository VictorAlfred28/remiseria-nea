import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR CRÍTICO: Debes proveer SUPABASE_URL y SUPABASE_KEY en las variables de entorno.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAuth() {
  const email = `test_audit_${Date.now()}@test.com`;
  const password = 'password123';

  console.log(`Intentando crear usuario: ${email}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
        data: {
            nombre: 'Usuario Auditoría',
            telefono: '123456789'
        }
    }
  });

  if (error) {
    console.error('Error al crear usuario:', error.message);
  } else {
    console.log('Usuario creado exitosamente:', data.user?.id);
    console.log('Access Token:', data.session?.access_token ? "Yes" : "No");
  }
}

testAuth();
