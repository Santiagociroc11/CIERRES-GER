#!/usr/bin/env node

/**
 * Script de diagnóstico para el servicio de mensajes programados
 * Ejecutar con: node test-scheduled-service.js
 */

const POSTGREST_URL = process.env.VITE_POSTGREST_URL || process.env.POSTGREST_URL || 'https://evolution-api-postgrest-api.wc2hpx.easypanel.host';

console.log('🔍 [DIAGNÓSTICO] Iniciando verificación del servicio de mensajes programados...\n');

async function testDatabaseConnection() {
  console.log('📊 [TEST] 1. Verificando conexión a base de datos...');
  
  try {
    const response = await fetch(`${POSTGREST_URL}/chat_scheduled_messages?select=*&limit=5`);
    
    if (!response.ok) {
      console.log(`❌ [TEST] Error HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ [TEST] Conexión exitosa. Encontrados ${data.length} mensajes programados`);
    
    if (data.length > 0) {
      console.log('📋 [TEST] Primeros mensajes:');
      data.forEach((msg, index) => {
        console.log(`   ${index + 1}. ID: ${msg.id}, Estado: ${msg.estado}, Fecha: ${msg.fecha_envio}`);
      });
    }
    
    return true;
  } catch (error) {
    console.log(`❌ [TEST] Error de conexión: ${error.message}`);
    return false;
  }
}

async function testPendingMessages() {
  console.log('\n📅 [TEST] 2. Verificando mensajes pendientes...');
  
  try {
    const now = new Date();
    const url = `${POSTGREST_URL}/chat_scheduled_messages?estado=eq.pendiente&fecha_envio=lte.${now.toISOString()}&order=fecha_envio.asc`;
    
    console.log(`🔗 [TEST] URL consultada: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ [TEST] Error HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ [TEST] Consulta exitosa. Encontrados ${data.length} mensajes pendientes`);
    
    if (data.length > 0) {
      console.log('📋 [TEST] Mensajes pendientes:');
      data.forEach((msg, index) => {
        console.log(`   ${index + 1}. ID: ${msg.id}, Cliente: ${msg.wha_cliente}, Fecha: ${msg.fecha_envio}`);
      });
    } else {
      console.log('📭 [TEST] No hay mensajes pendientes para enviar');
    }
    
    return true;
  } catch (error) {
    console.log(`❌ [TEST] Error consultando mensajes pendientes: ${error.message}`);
    return false;
  }
}

async function testAsesorQuery() {
  console.log('\n👤 [TEST] 3. Verificando consulta de asesores...');
  
  try {
    const response = await fetch(`${POSTGREST_URL}/GERSSON_ASESORES?select=ID,NOMBRE&limit=3`);
    
    if (!response.ok) {
      console.log(`❌ [TEST] Error HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ [TEST] Consulta exitosa. Encontrados ${data.length} asesores`);
    
    if (data.length > 0) {
      console.log('📋 [TEST] Primeros asesores:');
      data.forEach((asesor, index) => {
        console.log(`   ${index + 1}. ID: ${asesor.ID}, Nombre: ${asesor.NOMBRE}`);
      });
    }
    
    return true;
  } catch (error) {
    console.log(`❌ [TEST] Error consultando asesores: ${error.message}`);
    return false;
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔧 [TEST] 4. Verificando variables de entorno...');
  
  const vars = {
    'POSTGREST_URL': POSTGREST_URL,
    'VITE_EVOLUTIONAPI_URL': process.env.VITE_EVOLUTIONAPI_URL,
    'EVOLUTIONAPI_URL': process.env.EVOLUTIONAPI_URL,
    'VITE_EVOLUTIONAPI_TOKEN': process.env.VITE_EVOLUTIONAPI_TOKEN ? 'CONFIGURADO' : 'NO CONFIGURADO',
    'EVOLUTIONAPI_TOKEN': process.env.EVOLUTIONAPI_TOKEN ? 'CONFIGURADO' : 'NO CONFIGURADO'
  };
  
  let allConfigured = true;
  
  Object.entries(vars).forEach(([key, value]) => {
    if (value) {
      console.log(`✅ [TEST] ${key}: ${value}`);
    } else {
      console.log(`❌ [TEST] ${key}: NO CONFIGURADO`);
      allConfigured = false;
    }
  });
  
  return allConfigured;
}

async function runAllTests() {
  console.log('🚀 [DIAGNÓSTICO] Ejecutando todas las pruebas...\n');
  
  const results = {
    database: await testDatabaseConnection(),
    pendingMessages: await testPendingMessages(),
    asesores: await testAsesorQuery(),
    environment: await testEnvironmentVariables()
  };
  
  console.log('\n📊 [RESULTADOS] Resumen de pruebas:');
  console.log(`   Base de datos: ${results.database ? '✅ OK' : '❌ FALLO'}`);
  console.log(`   Mensajes pendientes: ${results.pendingMessages ? '✅ OK' : '❌ FALLO'}`);
  console.log(`   Consulta asesores: ${results.asesores ? '✅ OK' : '❌ FALLO'}`);
  console.log(`   Variables de entorno: ${results.environment ? '✅ OK' : '❌ FALLO'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 [DIAGNÓSTICO] Todas las pruebas pasaron. El servicio debería funcionar correctamente.');
  } else {
    console.log('\n⚠️  [DIAGNÓSTICO] Algunas pruebas fallaron. Revisar la configuración.');
  }
  
  return allPassed;
}

// Ejecutar diagnóstico
runAllTests().catch(error => {
  console.error('❌ [DIAGNÓSTICO] Error ejecutando diagnóstico:', error);
  process.exit(1);
});
