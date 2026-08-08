-- MIGRACIÓN: AGREGAR CAMPO REQUIERE_CAMBIO_PASSWORD
-- Permite que los nuevos usuarios (creados desde admin) deban cambiar su clave
-- mientras que los usuarios existentes continúan funcionando normalmente.

ALTER TABLE usuarios
ADD COLUMN requiere_cambio_password BOOLEAN NOT NULL DEFAULT FALSE;
