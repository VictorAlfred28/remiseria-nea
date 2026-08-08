import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zzjraabnyqogxidhfuyl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6anJhYWJueXFvZ3hpZGhmdXlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3MzYxMywiZXhwIjoyMDkyMDQ5NjEzfQ.gA5waTC_04GipbghBW1ibnfNwd0xzpchnJ5dSkGnJrg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("=== INICIANDO PRUEBA DE REALTIME INSTRUMENTADA (FASE 0) ===\n");
  
  const { data: users } = await supabase.from('usuarios').select('id').limit(1);
  const cliente_id = users[0].id;

  const { data: orgs } = await supabase.from('organizaciones').select('id').limit(1);
  const org_id = orgs[0].id;

  console.log(`-> Creando viaje de prueba...`);
  const { data: insertData } = await supabase.from('viajes').insert({
    cliente_id: cliente_id,
    organizacion_id: org_id,
    estado: 'solicitado',
    precio: 1000,
    origen: { direccion: 'Test Origen' },
    destino: { direccion: 'Test Destino' }
  }).select('id').single();

  const viaje_id = insertData.id;
  console.log(`Viaje creado exitosamente: ${viaje_id}\n`);

  let logs = [];
  let subCount = 0;

  await new Promise((resolve) => {
    // Canal 1: Sin filtro
    supabase.channel('no_filter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, (payload) => {
        if (payload.new && payload.new.id === viaje_id) logs.push({ filter: 'Ninguno', payload });
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') { subCount++; if(subCount === 3) resolve(); } });

    // Canal 2: Filtro por cliente_id (como ClienteDashboard)
    supabase.channel('cliente_filter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes', filter: `cliente_id=eq.${cliente_id}` }, (payload) => {
        logs.push({ filter: `cliente_id=eq.${cliente_id}`, payload });
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') { subCount++; if(subCount === 3) resolve(); } });

    // Canal 3: Filtro por id (como LiveTracker)
    supabase.channel('id_filter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes', filter: `id=eq.${viaje_id}` }, (payload) => {
        logs.push({ filter: `id=eq.${viaje_id}`, payload });
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') { subCount++; if(subCount === 3) resolve(); } });
  });

  console.log("-> Suscripciones activadas. Realizando transiciones de estado...\n");

  const transitions = ['ACCEPTED', 'ARRIVED', 'STARTED', 'FINISHED'];
  
  for (const estado of transitions) {
    console.log(`Simulando transición -> ${estado}...`);
    await supabase.from('viajes').update({ estado: estado }).eq('id', viaje_id);
    await new Promise(r => setTimeout(r, 2000)); // Esperar a que lleguen los eventos
  }

  console.log("\n=== RESULTADOS DE LOS EVENTOS RECIBIDOS ===\n");
  
  if (logs.length === 0) {
    console.log("❌ ERROR CRÍTICO: No se recibió NINGÚN evento en NINGÚN canal.");
    console.log("Esto confirma que la tabla 'viajes' NO tiene habilitado el broadcast de Realtime.");
  } else {
    logs.forEach((log, index) => {
      console.log(`[Evento ${index + 1}] Filtro: ${log.filter}`);
      console.log(`Estado Nuevo: ${log.payload.new.estado}`);
      console.log(`Columnas en payload.old: ${JSON.stringify(Object.keys(log.payload.old || {}))}`);
      console.log(`Columnas en payload.new: ${JSON.stringify(Object.keys(log.payload.new || {}))}`);
      console.log(`¿Contiene cliente_id?: ${log.payload.new.cliente_id !== undefined ? 'SÍ (' + log.payload.new.cliente_id + ')' : 'NO'}`);
      console.log("--------------------------------------------------");
    });
  }

  // Limpiar
  await supabase.from('viajes').delete().eq('id', viaje_id);
  await supabase.removeAllChannels();
}

runTest();
