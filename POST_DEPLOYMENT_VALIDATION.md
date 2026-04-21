# ✅ POST-DEPLOYMENT VALIDATION CHECKLIST

## 🚀 Antes de Deployar a Producción

### Pre-Deployment Checklist

- [ ] Código revisado en `backend/app/api/v1/endpoints/public.py`
- [ ] Middleware integrado en `backend/app/main.py`
- [ ] Validators mejorados en `backend/app/core/validators.py`
- [ ] Tests ejecutados localmente: `python backend/scripts/test_driver_registration.py`
- [ ] Todos los tests pasan (13/13)
- [ ] No hay errores de import
- [ ] No hay breaking changes

### Testing Local

```bash
# 1. Asegurarse que el servidor corre sin errores
cd backend
python -m uvicorn app.main:app --reload

# 2. En otra terminal, ejecutar tests
python scripts/test_driver_registration.py \
    --url http://localhost:8000 \
    --org-id <your-org-id>

# 3. Ver que todos los tests pasen
# Expected output: "Passed: 13" (o más si se agregan)
```

### Manual Testing

```bash
# Test 1: Valid request
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Test",
    "email": "test@test.com",
    "telefono": "1123456789",
    "dni": "12345678",
    "organizacion_id": "<your-org-id>",
    "tiene_vehiculo": false
  }'

# Expected: 200 OK with chofer data

# Test 2: Invalid phone
curl -X POST http://localhost:8000/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Test",
    "email": "test@test.com",
    "telefono": "123",
    "dni": "12345678",
    "organizacion_id": "<your-org-id>",
    "tiene_vehiculo": false
  }'

# Expected: 400 Bad Request with message about phone
```

---

## 🚀 Durante el Deployment

### Step 1: Deploy Backend Changes

```bash
# Assuming you're using git
git add backend/app/api/v1/endpoints/public.py
git add backend/app/core/validators.py
git add backend/app/core/middleware.py
git add backend/app/main.py
git commit -m "feat: Add granular logging for driver registration endpoint"
git push origin main
```

### Step 2: Verify Deployment

```bash
# Check that the application started without errors
curl http://<your-deployment-url>/

# Should return: {"message": "Bienvenido a la API de Remisería NEA"}
```

### Step 3: Test Endpoint Directly

```bash
# Test with valid data
curl -X POST http://<your-deployment-url>/api/v1/public/registro/chofer \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test User",
    "email": "test-deployment@test.com",
    "telefono": "1123456789",
    "dni": "test-dni-deployment",
    "organizacion_id": "<org-id>",
    "tiene_vehiculo": false
  }'

# Should return 200 with chofer data
```

---

## ✅ Post-Deployment Validation

### Functionality Verification

- [ ] **Endpoint Responds** - `/api/v1/public/registro/chofer` returns 200 for valid requests
- [ ] **Error Messages Clear** - 400 errors show specific field and what's wrong
- [ ] **Logging Active** - Check logs contain "DRIVER REGISTRATION REQUEST"
- [ ] **Middleware Working** - Check logs show "400 Bad Request" entries when applicable
- [ ] **Database Writes** - Verify new drivers are created in `choferes` table
- [ ] **Email/DNI Unique** - Verify duplicates are rejected (status 400)

### Error Handling Verification

Run these 5 tests and verify error messages are specific:

1. **Invalid Phone**
   ```bash
   curl ... -d '{"telefono": "123", ...}'
   # Should return: "Teléfono inválido (debe tener mínimo 10 dígitos..."
   ```

2. **Duplicate Email**
   ```bash
   curl ... -d '{"email": "existing@org.com", ...}'
   # Should return: "Email ya registrado en esta organización"
   ```

3. **Invalid Organization**
   ```bash
   curl ... -d '{"organizacion_id": "00000000-0000-0000-0000-000000000000"}'
   # Should return: "Organización no válida"
   ```

4. **Expired License**
   ```bash
   curl ... -d '{"licencia_vencimiento": "2020-01-01"}'
   # Should return: "Licencia vencida"
   ```

5. **Vehicle Without Plate**
   ```bash
   curl ... -d '{"tiene_vehiculo": true, "patente": null}'
   # Should return: "Patente es requerida"
   ```

### Logging Verification

Check server logs for:

```bash
# Log 1: Request captured
grep "=== DRIVER REGISTRATION REQUEST ===" /var/log/app/output.log

# Log 2: Validation steps
grep "Starting validation" /var/log/app/output.log

# Log 3: Success
grep "✅ New driver registered" /var/log/app/output.log

# Log 4: Errors
grep "❌" /var/log/app/output.log

# Log 5: Validation failed
grep "Validation failed on field" /var/log/app/output.log
```

### Performance Check

- [ ] Response time < 1 second for valid requests
- [ ] Response time < 500ms for validation failures
- [ ] No memory leaks (check memory usage over 1 hour)
- [ ] No connection pool issues (check database connections)

### Security Verification

- [ ] Error messages don't leak sensitive data
- [ ] No passwords logged
- [ ] Audit trail present (who registered, when, from where)
- [ ] Rate limiting working (if implemented)

---

## 📊 Monitoring Setup

### Logs to Monitor

```bash
# Critical: Unhandled exceptions
grep -i "error\|exception" /var/log/app/output.log

# Important: 400 Bad Request (should be < 5% of registration attempts)
grep "400 Bad Request" /var/log/app/output.log | wc -l

# Info: Successful registrations
grep "✅ New driver registered" /var/log/app/output.log | wc -l
```

### Alerts to Set Up

1. **Error Rate High**
   - Alert if: 400 errors > 10% of requests in 5 min window
   - Action: Review what changed, check database

2. **Endpoint Down**
   - Alert if: HTTP 5xx or timeout
   - Action: Check server health, database connection

3. **Performance Degradation**
   - Alert if: Response time > 5 seconds
   - Action: Check database queries, server load

---

## 🐛 Troubleshooting Post-Deployment

### Issue: Logging Not Appearing

**Solution:**
1. Check logging level in `backend/app/core/config.py`
2. Verify logger name matches: `logging.getLogger(__name__)`
3. Check log file permissions
4. Restart application

### Issue: Middleware Not Working

**Solution:**
1. Verify middleware is imported in `backend/app/main.py` line 9
2. Verify middleware is added before CORS: line 12
3. Check that middleware class is correct in `backend/app/core/middleware.py`
4. Restart application

### Issue: Error Messages Not Specific

**Solution:**
1. Verify `ValidacionError` includes `field` parameter
2. Check that `detail` field in HTTPException is passed
3. Verify validators are being called
4. Check logs for which validation is failing

### Issue: 500 Errors Instead of 400

**Solution:**
1. Check database connectivity
2. Verify table names are correct (`usuarios`, `choferes`)
3. Check Supabase credentials in `.env`
4. See server logs for actual error

---

## ✨ Success Criteria

All of these should be true:

- ✅ Valid registrations return 200 with driver data
- ✅ Invalid registrations return 400 with specific error message
- ✅ Error message includes which field is wrong
- ✅ Error message explains what to fix
- ✅ Server logs contain detailed request/response info
- ✅ Database reflects successful registrations
- ✅ No breaking changes to other endpoints
- ✅ Performance is acceptable (< 1 sec response time)
- ✅ Security is maintained (no data leaks)
- ✅ Audit trail is complete (logs track everything)

---

## 📈 Expected Metrics

After deployment, you should see:

| Metric | Expected Range | Note |
|--------|-----------------|------|
| Successful registrations | > 90% | Rest are validation errors |
| Response time (valid) | 300-500ms | Including DB operations |
| Response time (invalid) | 100-200ms | Validation failures are faster |
| Error rate | < 10% | Invalid input from users |
| 500 errors | < 0.1% | Only if DB connection issues |
| Logging overhead | < 5% | Minimal impact on perf |

---

## 🎓 Rollback Procedure

If something goes wrong:

```bash
# 1. Revert to previous version
git revert <commit-hash>

# 2. Deploy reverted version
git push origin main

# 3. Restart application
systemctl restart app  # or docker restart container

# 4. Verify it works
curl http://<your-url>/api/v1/public/registro/chofer

# 5. Investigate the issue (check logs)
```

---

## 📝 Sign-Off

Use this checklist to sign off on deployment:

```
Deployed by: ___________________
Date: _______________________
Reviewed by: __________________
All checks passed: ☐ YES ☐ NO

If NO, issues found:
_________________________________
_________________________________

Actions taken:
_________________________________
_________________________________

Sign-off date: __________________
```

---

## 📞 Contact

If something fails:

1. Check logs immediately: `grep ERROR /var/log/app/output.log`
2. Run local test: `python backend/scripts/test_driver_registration.py`
3. Compare response to expected in [GUIA_RAPIDA_ERROR_400.md](GUIA_RAPIDA_ERROR_400.md)
4. If still stuck, see [ANTES_DESPUES_COMPARACION.md](ANTES_DESPUES_COMPARACION.md)

---

## ✅ Final Checklist

- [ ] Code is deployed
- [ ] Tests pass (run script locally to verify)
- [ ] Error messages are specific
- [ ] Logs are appearing
- [ ] No performance degradation
- [ ] No breaking changes
- [ ] Monitoring is set up
- [ ] Team is notified
- [ ] Documentation is shared

**Status**: Ready for production ✅

