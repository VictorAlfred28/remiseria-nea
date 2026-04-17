# Documentación: Funcionalidad del Grupo Familiar (Control Parental) - Viajes NEA

Esta sección permite a los usuarios con rol de **Tutor** (padres o responsables) crear un entorno seguro para supervisar y financiar los traslados de sus dependientes (**Adolescentes**).

## 1. Proceso de Invitación
Cuando un tutor decide invitar a un adolescente al grupo, el sistema realiza lo siguiente:

1.  **Registro de Invitación**: Se solicita el número de teléfono y el nombre del adolescente.
2.  **Invitación por WhatsApp**: El sistema envía automáticamente un mensaje al teléfono ingresado a través de la API de WhatsApp (Evolution API).
    *   **Mensaje enviado**: 
        > 🚗 *Viajes NEA - Control Familiar*
        > 
        > Hola [Nombre]! [Nombre Tutor] te ha invitado a unirte a su Grupo Familiar para abonar y supervisar tus viajes.
        > 
        > 👉 *Ingresa a la app y en tu perfil selecciona 'Vincular Tutor' usando su número de teléfono.*
3.  **Estado Pendiente**: En la base de datos se crea un registro con estado `pendiente` en la tabla `miembros_familiares` hasta que el adolescente confirme la vinculación.

## 2. Cómo se vincula el Adolescente?
Por seguridad, la vinculación requiere una acción consciente del adolescente:
1.  Debe tener su propia cuenta en la aplicación de Viajes NEA.
2.  Debe ir a su **Perfil**.
3.  Seleccionar la opción **"Vincular Tutor"**.
4.  Ingresar el **número de teléfono del tutor**.
5.  Una vez hecho esto, el sistema verifica la invitación pendiente y el estado cambia a `activo`. El adolescente pasa a ser un **Dependiente** del grupo.

## 3. ¿Qué puede hacer el Tutor? (Funciones Avanzadas)
Una vez vinculado, el tutor tiene control total sobre las reglas de uso a través de la sección de reglas (PRO):

### A. Reglas de Uso (Límites)
*   **Límite de Viajes Diarios**: Controla cuántos viajes puede realizar el dependiente por día.
*   **Monto Máximo por Viaje**: Define un presupuesto máximo para evitar gastos excesivos.
*   **Franjas Horarias**: Permite definir una hora de inicio y fin (ej. solo puede viajar de 07:00 a 22:00).

### B. Aprobación Estricta
*   **Aprobación Manual**: Si se activa, cada vez que el adolescente solicite un viaje, este quedará bloqueado en estado `esperando_tutor`. El viaje solo se confirma cuando el tutor lo aprueba desde su propia aplicación.

### C. Geofencing (Zonas)
*   **Zonas de Seguridad**: El tutor puede marcar ubicaciones en el mapa con un radio de acción.
*   **Tipos de Zonas**: Se pueden definir zonas "Permitidas" o "Restringidas", lo que ayuda a monitorear si el adolescente se desplaza a lugares no autorizados.

## 4. Beneficios Principales
*   **Pago Centralizado**: Los viajes se debitan de la cuenta del tutor.
*   **Monitoreo**: El tutor es registrado como `tutor_responsable_id` en cada viaje del dependiente.
*   **Seguridad**: Todo está protegido por políticas de RLS en la base de datos, garantizando la privacidad familiar.
