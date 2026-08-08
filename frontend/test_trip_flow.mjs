import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const API_URL = process.env.API_URL || 'https://api.viajesnea.agentech.ar/api/v1';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR CRÍTICO: Debes proveer SUPABASE_URL y SUPABASE_KEY en las variables de entorno.');
    process.exit(1);
}

if (API_URL.includes('api.viajesnea.agentech.ar') && process.env.E2E_ALLOW_PRODUCTION !== 'true') {
    console.error('ERROR CRÍTICO: Intento de ejecutar E2E en PRODUCCIÓN sin autorización.');
    console.error('Debes exportar E2E_ALLOW_PRODUCTION=true para ejecutar este test.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const e2eId = 'E2E_' + Date.now();
    let tripId = null;
    let driverUserId = null;
    let clientUserId = null;
    
    let initialChoferSaldo = 0;
    let initialClientPuntos = 0;
    let initialClientViajesGratis = 0;

    console.log('--- INICIANDO TEST E2E [' + e2eId + '] ---');

    try {
        console.log('1. Authenticating Client and Driver...');
        const clientAuth = await supabase.auth.signInWithPassword({ email: 'test_audit_1786153182635@test.com', password: 'password123' });
        const driverAuth = await supabase.auth.signInWithPassword({ email: 'chofer_audit_1@test.com', password: 'password123' });
        
        clientUserId = clientAuth.data.session.user.id;
        driverUserId = driverAuth.data.session.user.id;
        
        const clientToken = clientAuth.data.session.access_token;
        const driverToken = driverAuth.data.session.access_token;
        
        // FINANCIAL SNAPSHOT (PRE-TEST)
        const { data: choferStart } = await supabase.from('choferes').select('saldo').eq('usuario_id', driverUserId).single();
        const { data: clientStart } = await supabase.from('usuarios').select('puntos_actuales, viajes_gratis').eq('id', clientUserId).single();
        initialChoferSaldo = choferStart?.saldo || 0;
        initialClientPuntos = clientStart?.puntos_actuales || 0;
        initialClientViajesGratis = clientStart?.viajes_gratis || 0;
        
        console.log('2. Requesting Trip (Cliente)...');
        const payload = {
            origen: { direccion: 'Corrientes 123 [' + e2eId + ']', lat: -27.46, lng: -58.83 },
            destino: { direccion: 'San Martin 456', lat: -27.47, lng: -58.84 },
            tipo_viaje: 'PERSONAL',
            usar_viaje_gratis: false,
            distancia_km: 2,
            precio_estimado: 500
        };
        
        const tripRes = await fetch(API_URL + '/cliente/viaje', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + clientToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const tripData = await tripRes.json();
        
        if (!tripData.id) {
            throw new Error('Trip creation failed. HTTP ' + tripRes.status);
        }
        tripId = tripData.id;
        
        // CHECK DB STATE 1
        const { data: check1 } = await supabase.from('viajes').select('estado').eq('id', tripId).single();
        if (check1.estado !== 'SOLICITADO') throw new Error('Estado inválido tras creación: ' + check1.estado);
        
        console.log('3. Changing Driver state to activo...');
        await supabase.from('choferes').update({ estado: 'activo' }).eq('usuario_id', driverUserId);
        
        console.log('4. Driver Accepts Trip...');
        const { data: choferRow } = await supabase.from('choferes').select('id').eq('usuario_id', driverUserId).single();
        const cId = choferRow.id;
        
        const acceptRes = await supabase.from('viajes')
            .update({ chofer_id: cId, estado: 'ACEPTADO', accepted_at: new Date().toISOString() })
            .eq('id', tripId)
            .eq('estado', 'SOLICITADO')
            .select();
            
        if (acceptRes.error || acceptRes.data.length === 0) throw new Error('Fallo en ACEPTAR viaje vía base de datos.');
        
        // CHECK DB STATE 2
        const { data: check2 } = await supabase.from('viajes').select('estado').eq('id', tripId).single();
        if (check2.estado !== 'ACEPTADO') throw new Error('Estado inválido tras aceptación: ' + check2.estado);
        
        console.log('4.1. Driver triggers backend notification...');
        await fetch(API_URL + '/chofer/viajes/' + tripId + '/notificar-aceptacion', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + driverToken }
        });
        
        console.log('5. Driver notifies Arrival...');
        await fetch(API_URL + '/chofer/viajes/' + tripId + '/notificar-llegada', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + driverToken }
        });
        
        // CHECK DB STATE 3
        const { data: check3 } = await supabase.from('viajes').select('estado').eq('id', tripId).single();
        if (check3.estado !== 'EN_PUERTA') throw new Error('Estado inválido tras llegada: ' + check3.estado);
        
        console.log('6. Driver starts Trip...');
        await fetch(API_URL + '/chofer/viajes/' + tripId + '/iniciar', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + driverToken }
        });
        
        // CHECK DB STATE 4
        const { data: check4 } = await supabase.from('viajes').select('estado').eq('id', tripId).single();
        if (check4.estado !== 'INICIADO') throw new Error('Estado inválido tras iniciar: ' + check4.estado);
        
        console.log('7. Driver finishes Trip...');
        await fetch(API_URL + '/chofer/viajes/' + tripId + '/finalizar', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + driverToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: -27.47, lng: -58.84 })
        });
        
        // CHECK DB STATE 5
        const { data: check5 } = await supabase.from('viajes').select('estado').eq('id', tripId).single();
        if (check5.estado !== 'FINALIZADO') throw new Error('Estado inválido tras finalizar: ' + check5.estado);
        
        console.log('TEST COMPLETADO CORRECTAMENTE.');
        
    } catch (e) {
        console.error('ERROR EN TEST:', e.message);
    } finally {
        console.log('--- INICIANDO CLEANUP TRANSACCIONAL ---');
        
        try {
            // Restore financial balances
            if (driverUserId) {
                await supabase.from('choferes').update({ saldo: initialChoferSaldo }).eq('usuario_id', driverUserId);
                console.log('Cleanup: Saldo de chofer revertido.');
            }
            if (clientUserId) {
                await supabase.from('usuarios').update({ puntos_actuales: initialClientPuntos, viajes_gratis: initialClientViajesGratis }).eq('id', clientUserId);
                console.log('Cleanup: Puntos de cliente revertidos.');
            }
            
            // Delete trip and its points history
            if (tripId) {
                await supabase.from('historial_puntos').delete().eq('viaje_id', tripId);
                await supabase.from('viajes').delete().eq('id', tripId);
                console.log('Cleanup: Viaje y registros contables eliminados.');
            }
        } catch (cleanupErr) {
            console.error('ERROR CRÍTICO EN CLEANUP:', cleanupErr.message);
        }
        console.log('--- TEST FINALIZADO ---');
    }
}
run();
